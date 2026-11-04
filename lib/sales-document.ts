import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RecordValue = Record<string, unknown>;

export type SalesDocumentItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  originalPrice: number;
  finalPrice: number;
  discount: number;
};

export type SalesDocument = {
  id: string;
  invoiceNumber: string;
  createdAt: string | null;
  cashierName: string;
  customerName: string | null;
  items: SalesDocumentItem[];
  subtotal: number;
  transactionDiscount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  notes: string | null;
};

function recordOf(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function valueOf(record: RecordValue, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value !== null && value !== undefined);
}

function textOf(record: RecordValue, keys: string[], fallback = "") {
  const value = valueOf(record, keys);
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function numberOf(record: RecordValue, keys: string[], fallback = 0) {
  const value = valueOf(record, keys);
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItem(value: unknown): SalesDocumentItem {
  const record = recordOf(value);
  const originalPrice = numberOf(record, ["selling_price_snapshot"]);
  const finalPrice = numberOf(record, ["final_price"], originalPrice);
  const quantity = numberOf(record, ["quantity", "qty"], 1);

  return {
    id: textOf(record, ["id"]),
    name: textOf(record, ["product_name", "name", "product_name_snapshot", "name_snapshot"], "Produk tidak tersedia"),
    sku: textOf(record, ["sku", "product_sku", "sku_snapshot", "product_sku_snapshot"], "—"),
    quantity,
    originalPrice,
    finalPrice,
    discount: Math.max(0, originalPrice - finalPrice),
  };
}

export async function getSalesDocument(saleId: string): Promise<SalesDocument> {
  noStore();
  const profile = await getCurrentProfile();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .maybeSingle();

  if (saleError) throw new Error("Data transaksi tidak dapat dimuat.");
  if (!sale) notFound();

  const [{ data: itemRows, error: itemsError }, staffResult] = await Promise.all([
    supabase.from("sale_items").select("*").eq("sale_id", saleId),
    supabase.rpc("get_staff_directory"),
  ]);
  if (itemsError) throw new Error("Rincian produk transaksi tidak dapat dimuat.");
  if (staffResult.error) throw new Error("Nama kasir transaksi tidak dapat dimuat.");

  const saleRecord = sale as RecordValue;
  const items = (itemRows ?? []).map(normalizeItem);
  const subtotalFromItems = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const itemFinalTotal = items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const transactionDiscount = numberOf(
    saleRecord,
    ["discount_amount", "transaction_discount", "discount_total"],
    Math.max(0, subtotalFromItems - itemFinalTotal),
  );
  const total = numberOf(saleRecord, ["total_amount", "total", "grand_total", "final_total", "amount_total"], itemFinalTotal);
  const amountPaid = numberOf(saleRecord, ["amount_paid", "paid_amount"], total);
  const staffRows: unknown = staffResult.data;
  const staff = Array.isArray(staffRows)
    ? staffRows.map(recordOf).find((row) => textOf(row, ["id"]) === textOf(saleRecord, ["created_by", "cashier_id", "user_id"]))
    : undefined;
  const cashierUserId = textOf(saleRecord, ["created_by", "cashier_id", "user_id"]);
  const cashierName = staff
    ? textOf(staff, ["full_name"], "Nama kasir tidak tersedia")
    : cashierUserId === profile.userId
      ? profile.fullName
      : "Nama kasir tidak tersedia";

  return {
    id: saleId,
    invoiceNumber: textOf(saleRecord, ["invoice_number", "invoice_no", "invoice"], saleId),
    createdAt: textOf(saleRecord, ["created_at", "sold_at"]) || null,
    cashierName,
    customerName: textOf(saleRecord, ["customer_name", "customer"]) || null,
    items,
    subtotal: numberOf(saleRecord, ["subtotal", "sub_total"], subtotalFromItems),
    transactionDiscount,
    total,
    paymentMethod: textOf(saleRecord, ["payment_method"], "—"),
    amountPaid,
    change: numberOf(saleRecord, ["change_amount", "change", "cash_change"], Math.max(0, amountPaid - total)),
    notes: textOf(saleRecord, ["notes", "note"]) || null,
  };
}
