"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { paymentMethods } from "@/lib/pos";
import {
  returnConditions,
  type ReturnActionState,
  type ReturnableSale,
  type ReturnableSaleItem,
} from "@/lib/returns";
import { createClient } from "@/lib/supabase/server";

type SupabaseError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type RecordValue = Record<string, unknown>;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function logSupabaseError(statement: string, error: SupabaseError) {
  if (process.env.NODE_ENV !== "development") return;

  console.error(
    `[GemFlow Retur] ${statement} ${JSON.stringify({
      code: error.code ?? "unknown",
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })}`,
  );
}

function readGrantError(table: "sales" | "sale_items", error: SupabaseError) {
  logSupabaseError(`public.${table}.select`, error);
  if (error.code === "42501" || /permission denied for table/i.test(error.message)) {
    return `Akses baca public.${table} belum diberikan. Jika hak tabel yang kurang, administrator dapat menjalankan: GRANT SELECT ON TABLE public.${table} TO authenticated; Kebijakan RLS tetap harus mengizinkan pembacaan.`;
  }
  return `Data retur dari public.${table} tidak dapat dimuat. Coba lagi atau hubungi administrator.`;
}

function recordOf(value: unknown): RecordValue {
  return value && typeof value === "object" ? value as RecordValue : {};
}

function firstValue(record: RecordValue, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value !== null && value !== undefined);
}

function textValue(record: RecordValue, keys: string[], fallback = "") {
  const value = firstValue(record, keys);
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function numberValue(record: RecordValue, keys: string[], fallback = 0) {
  const value = firstValue(record, keys);
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeItem(value: unknown): ReturnableSaleItem {
  const record = recordOf(value);
  const quantity = numberValue(record, ["quantity", "qty"], 1);
  const snapshotPrice = numberValue(record, ["selling_price_snapshot"]);
  const finalPrice = numberValue(record, ["final_price"], snapshotPrice);
  const productId = textValue(record, ["product_id"]);

  return {
    id: textValue(record, ["id"]),
    productId: productId || null,
    sku: textValue(record, ["sku", "product_sku", "sku_snapshot", "product_sku_snapshot"], "SKU tidak tersedia"),
    productName: textValue(
      record,
      ["product_name", "name", "product_name_snapshot", "name_snapshot"],
      "Produk tidak tersedia",
    ),
    quantity,
    unitPrice: finalPrice,
    refundableAmount: finalPrice,
    returnStatus: textValue(record, ["return_status"], "not_returned"),
  };
}

function normalizeSales(sales: RecordValue[], itemRows: unknown[]): ReturnableSale[] {
  const itemsBySale = new Map<string, ReturnableSaleItem[]>();
  for (const row of itemRows) {
    const record = recordOf(row);
    const saleId = textValue(record, ["sale_id"]);
    const items = itemsBySale.get(saleId) ?? [];
    items.push(normalizeItem(row));
    itemsBySale.set(saleId, items);
  }

  return sales.map((sale) => {
    const id = textValue(sale, ["id"]);
    const items = itemsBySale.get(id) ?? [];
    return {
      id,
      invoiceNumber: textValue(sale, ["invoice_number", "invoice_no", "invoice"], id),
      customerName: textValue(sale, ["customer_name", "customer"], "") || null,
      createdAt: textValue(sale, ["created_at", "sold_at"], "") || null,
      items,
    };
  });
}

export async function searchReturnSales(query: string): Promise<{
  sales: ReturnableSale[];
  error?: string;
}> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { sales: [], error: "Akun ini tidak memiliki akses ke retur." };
  }

  const search = query.trim().slice(0, 100);
  if (search.length < 2) return { sales: [] };

  const supabase = await createClient();
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const [invoiceResult, customerResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, invoice_number, customer_name, created_at")
      .ilike("invoice_number", pattern)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("sales")
      .select("id, invoice_number, customer_name, created_at")
      .ilike("customer_name", pattern)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const salesError = invoiceResult.error ?? customerResult.error;
  if (salesError) {
    return { sales: [], error: readGrantError("sales", salesError) };
  }

  const salesById = new Map<string, RecordValue>();
  for (const sale of [...(invoiceResult.data ?? []), ...(customerResult.data ?? [])]) {
    salesById.set(sale.id, sale as RecordValue);
  }
  const sales = [...salesById.values()]
    .sort((left, right) => textValue(right, ["created_at"]).localeCompare(textValue(left, ["created_at"])))
    .slice(0, 20);

  if (!sales.length) return { sales: [] };

  const saleIds = sales.map((sale) => textValue(sale, ["id"]));
  const { data: itemRows, error: itemsError } = await supabase
    .from("sale_items")
    .select("*")
    .in("sale_id", saleIds);

  if (itemsError) {
    return { sales: [], error: readGrantError("sale_items", itemsError) };
  }

  return { sales: normalizeSales(sales, itemRows ?? []) };
}

function readReturnReceipt(data: unknown, fallback: {
  refundAmount: number;
  productStatus: string;
}): NonNullable<ReturnActionState["receipt"]> {
  let result: unknown = Array.isArray(data) ? data[0] : data;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return {
        returnNumber: String(result),
        refundAmount: fallback.refundAmount,
        itemStatus: "returned",
        productStatus: fallback.productStatus,
      };
    }
  }

  const record = recordOf(result);
  const nested = recordOf(record.return ?? record.return_record ?? record.create_return);
  const values = { ...record, ...nested };
  const returnNumber = textValue(
    values,
    ["return_number", "return_no", "return_code", "invoice_number", "id"],
    "Nomor retur tidak dikembalikan RPC",
  );

  return {
    returnNumber,
    refundAmount: numberValue(values, ["refund_amount", "amount_refunded", "total_refund"], fallback.refundAmount),
    itemStatus: textValue(values, ["item_status", "return_status", "sale_item_status"], "returned"),
    productStatus: textValue(
      values,
      ["product_status", "resulting_product_status"],
      fallback.productStatus,
    ),
  };
}

export async function createReturn(
  _previousState: ReturnActionState,
  formData: FormData,
): Promise<ReturnActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { status: "error", message: "Akun ini tidak memiliki akses ke retur." };
  }

  const saleItemId = field(formData, "sale_item_id");
  const refundAmount = Number(field(formData, "refund_amount"));
  const refundMethod = field(formData, "refund_method");
  const reason = field(formData, "reason");
  const itemCondition = field(formData, "item_condition");
  const restock = formData.get("restock") === "true";
  const notes = field(formData, "notes");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(saleItemId)) {
    return { status: "error", message: "Barang penjualan yang dipilih tidak valid." };
  }
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { status: "error", message: "Jumlah pengembalian dana harus lebih besar dari nol." };
  }
  if (!paymentMethods.some((method) => method === refundMethod)) {
    return { status: "error", message: "Pilih metode pengembalian dana yang valid." };
  }
  if (!reason || reason.length > 300) {
    return { status: "error", message: "Alasan retur wajib diisi dan maksimal 300 karakter." };
  }
  if (!returnConditions.some((condition) => condition === itemCondition)) {
    return { status: "error", message: "Pilih kondisi barang yang valid." };
  }
  if (notes.length > 500) {
    return { status: "error", message: "Catatan maksimal 500 karakter." };
  }

  const supabase = await createClient();
  const { data: itemData, error: itemError } = await supabase
    .from("sale_items")
    .select("*")
    .eq("id", saleItemId)
    .maybeSingle();

  if (itemError) {
    return { status: "error", message: readGrantError("sale_items", itemError) };
  }
  if (!itemData) {
    return { status: "error", message: "Detail barang penjualan tidak ditemukan." };
  }

  const item = normalizeItem(itemData);
  if (item.returnStatus !== "not_returned") {
    return { status: "error", message: "Barang ini sudah pernah diretur dan tidak dapat diproses kembali." };
  }
  if (item.refundableAmount > 0 && refundAmount > item.refundableAmount) {
    return { status: "error", message: "Jumlah pengembalian dana melebihi nilai barang." };
  }

  const { data, error } = await supabase.rpc("create_return", {
    p_sale_item_id: saleItemId,
    p_refund_amount: refundAmount,
    p_refund_method: refundMethod,
    p_reason: reason,
    p_item_condition: itemCondition,
    p_restock: restock,
    p_notes: notes || null,
  });

  if (error) {
    logSupabaseError("rpc(create_return)", error);
    return { status: "error", message: "Retur gagal diproses. Periksa kembali data retur lalu coba lagi." };
  }

  revalidatePath("/returns");
  revalidatePath("/inventory");
  return {
    status: "success",
    message: "Retur berhasil diproses.",
    receipt: readReturnReceipt(data, {
      refundAmount,
      productStatus: restock && itemCondition === "resellable" ? "available" : "returned",
    }),
  };
}