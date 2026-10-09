"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { paymentMethods, type PosActionState, type SaleReceipt } from "@/lib/pos";
import { createClient } from "@/lib/supabase/server";

type SupabaseError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function logSupabaseError(statement: string, error: SupabaseError) {
  if (process.env.NODE_ENV !== "development") return;

  console.error(
    `[GemFlow POS] ${statement} ${JSON.stringify({
      code: error.code ?? "unknown",
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })}`,
  );
}

function readReceiptValues(data: unknown) {
  let result: unknown = Array.isArray(data) ? data[0] : data;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return { invoiceNumber: String(result), total: undefined, change: undefined };
    }
  }

  if (!result || typeof result !== "object") {
    return { invoiceNumber: undefined, total: undefined, change: undefined };
  }

  const record = result as Record<string, unknown>;
  const nested = record.receipt ?? record.sale ?? record.create_sale;
  const values = nested && typeof nested === "object"
    ? { ...record, ...(nested as Record<string, unknown>) }
    : record;
  const findValue = (keys: string[]) => keys.map((key) => values[key]).find((value) => value != null);
  const numberValue = (keys: string[]) => {
    const value = findValue(keys);
    if (typeof value !== "number" && typeof value !== "string") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  };
  const invoiceValue = findValue([
    "invoice_number",
    "invoice_no",
    "invoice",
    "sale_number",
    "receipt_number",
    "receipt_no",
    "transaction_number",
  ]);

  return {
    invoiceNumber: typeof invoiceValue === "string" || typeof invoiceValue === "number"
      ? String(invoiceValue)
      : undefined,
    total: numberValue(["total", "total_amount", "grand_total", "final_total", "amount_total"]),
    change: numberValue(["change", "change_amount", "change_due", "cash_change"]),
  };
}

export async function checkoutSale(
  _previousState: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { status: "error", message: "Akun ini tidak memiliki akses ke kasir." };
  }

  let productIds: unknown;
  try {
    productIds = JSON.parse(field(formData, "product_ids"));
  } catch {
    return { status: "error", message: "Keranjang tidak valid. Periksa kembali produk yang dipilih." };
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !Array.isArray(productIds) ||
    productIds.length === 0 ||
    productIds.length > 100 ||
    !productIds.every((id) => typeof id === "string" && uuidPattern.test(id)) ||
    new Set(productIds).size !== productIds.length
  ) {
    return { status: "error", message: "Keranjang kosong atau berisi produk yang tidak valid." };
  }

  const discountAmount = Number(field(formData, "discount_amount") || 0);
  const paymentMethodValue = field(formData, "payment_method");
  const paymentMethod = paymentMethods.find((method) => method === paymentMethodValue);
  if (!paymentMethod) {
    return { status: "error", message: "Pilih metode pembayaran yang valid." };
  }
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { status: "error", message: "Diskon harus berupa nilai yang valid." };
  }

  const supabase = await createClient();
  const { data: availableProducts, error: productsError } = await supabase
    .from("products")
    .select("id, selling_price")
    .in("id", productIds)
    .eq("status", "available");

  if (productsError) {
    logSupabaseError("products.select(available for checkout)", productsError);
    return { status: "error", message: "Produk tidak dapat diverifikasi. Muat ulang kasir lalu coba lagi." };
  }

  if (!availableProducts || availableProducts.length !== productIds.length) {
    return { status: "error", message: "Ada produk yang sudah tidak tersedia. Muat ulang kasir sebelum melanjutkan." };
  }

  const subtotal = availableProducts.reduce(
    (sum, product) => sum + Number(product.selling_price ?? 0),
    0,
  );
  if (!Number.isFinite(subtotal) || subtotal < 0 || discountAmount > subtotal) {
    return { status: "error", message: "Diskon tidak boleh melebihi subtotal." };
  }

  const total = subtotal - discountAmount;
  const amountPaid = paymentMethod === "cash" ? Number(field(formData, "amount_paid")) : total;
  if (!Number.isFinite(amountPaid) || amountPaid < total) {
    return { status: "error", message: "Jumlah uang tunai belum mencukupi total transaksi." };
  }

  const { data, error } = await supabase.rpc("create_sale", {
    p_product_ids: productIds,
    p_discount_amount: discountAmount,
    p_payment_method: paymentMethod,
    p_amount_paid: amountPaid,
    p_customer_name: field(formData, "customer_name") || null,
    p_notes: field(formData, "notes") || null,
  });

  if (error) {
    logSupabaseError("rpc(create_sale)", error);
    return { status: "error", message: "Transaksi gagal. Periksa data pembayaran lalu coba lagi." };
  }

  const result = readReceiptValues(data);
  const receipt: SaleReceipt = {
    invoiceNumber: result.invoiceNumber ?? "Tidak dikembalikan RPC",
    total: result.total ?? total,
    change: result.change ?? Math.max(0, amountPaid - total),
  };

  revalidatePath("/pos");
  revalidatePath("/inventory");
  return {
    status: "success",
    message: "Transaksi berhasil disimpan.",
    receipt,
  };
}