"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import {
  getSaleTotalValidationError,
  paymentMethods,
  type PosActionState,
  type PosProduct,
  type SaleSuccessDetails,
} from "@/lib/pos";
import { signProductImages } from "@/lib/product-images";
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

function readSaleResult(data: unknown): {
  saleId: string | null;
  invoiceNumber: string | undefined;
  total: number | undefined;
  amountPaid: number | undefined;
  change: number | undefined;
  customerName: string | null | undefined;
} {
  let result: unknown = data;
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(result)) {
      result = result[0];
      continue;
    }
    if (typeof result === "string") {
      const rawResult = result;
      try {
        result = JSON.parse(rawResult);
        continue;
      } catch {
        const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawResult);
        return {
          saleId: isId ? rawResult : null,
          invoiceNumber: isId ? undefined : rawResult,
          total: undefined,
          amountPaid: undefined,
          change: undefined,
          customerName: undefined,
        };
      }
    }
    if (!result || typeof result !== "object") break;

    const wrapped = result as Record<string, unknown>;
    const nested = ["sale", "sales", "create_sale", "result", "data"]
      .map((key) => wrapped[key])
      .find((value) => value != null);
    if (nested === undefined) break;
    result = nested;
  }

  if (!result || typeof result !== "object") {
    return {
      saleId: null,
      invoiceNumber: undefined,
      total: undefined,
      amountPaid: undefined,
      change: undefined,
      customerName: undefined,
    };
  }

  const record = result as Record<string, unknown>;
  const values = record;
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
    "transaction_number",
  ]);
  const saleIdValue = findValue(["sale_id", "transaction_id", "id"]);
  const customerValue = findValue(["customer_name", "customer"]);

  return {
    saleId: typeof saleIdValue === "string" ? saleIdValue : null,
    invoiceNumber: typeof invoiceValue === "string" || typeof invoiceValue === "number"
      ? String(invoiceValue)
      : undefined,
    total: numberValue(["total", "total_amount", "grand_total", "final_total", "amount_total"]),
    amountPaid: numberValue(["amount_paid", "paid_amount"]),
    change: numberValue(["change", "change_amount", "change_due", "cash_change"]),
    customerName: typeof customerValue === "string" ? customerValue : null,
  };
}

const posProductSelect = "id, sku, barcode, name, category, selling_price, image_path";

async function withProductImage(product: PosProduct) {
  const imageResult = await signProductImages([product]);
  if (imageResult.error) {
    logSupabaseError("storage.product_image.sign_url", imageResult.error);
  }
  return {
    product: {
      ...product,
      image_url: product.image_path ? imageResult.urls.get(product.image_path) ?? null : null,
    },
    imageError: imageResult.error ? "Foto produk tidak dapat dimuat." : undefined,
  };
}

export async function findAvailableProduct(identifier: string): Promise<{
  product: PosProduct | null;
  error?: string;
  imageError?: string;
}> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { product: null, error: "Akun ini tidak memiliki akses ke kasir." };
  }

  const value = identifier.trim().slice(0, 100);
  if (!value) return { product: null };

  const supabase = await createClient();
  const barcodeResult = await supabase
    .from("products")
    .select(posProductSelect)
    .eq("barcode", value)
    .eq("status", "available")
    .maybeSingle();

  if (barcodeResult.error) {
    logSupabaseError("products.exact_barcode_lookup", barcodeResult.error);
    return { product: null, error: "Produk tidak dapat dicari. Coba lagi atau hubungi Admin." };
  }
  if (barcodeResult.data) return withProductImage(barcodeResult.data as PosProduct);

  const skuResult = await supabase
    .from("products")
    .select(posProductSelect)
    .eq("sku", value)
    .eq("status", "available")
    .maybeSingle();

  if (skuResult.error) {
    logSupabaseError("products.exact_sku_lookup", skuResult.error);
    return { product: null, error: "Produk tidak dapat dicari. Coba lagi atau hubungi Admin." };
  }

  return skuResult.data ? withProductImage(skuResult.data as PosProduct) : { product: null };
}

export async function searchAvailableProducts(query: string): Promise<{
  products: PosProduct[];
  error?: string;
  imageError?: string;
}> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { products: [], error: "Akun ini tidak memiliki akses ke kasir." };
  }

  const value = query.trim().slice(0, 100);
  if (value.length < 3) return { products: [] };

  const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(posProductSelect)
    .eq("status", "available")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(20);

  if (error) {
    logSupabaseError("products.name_search", error);
    return { products: [], error: "Pencarian produk gagal. Coba lagi atau hubungi Admin." };
  }

  const products = (data ?? []) as PosProduct[];
  const imageResult = await signProductImages(products);
  if (imageResult.error) logSupabaseError("storage.product_images.sign_urls", imageResult.error);
  return {
    products: products.map((product) => ({
      ...product,
      image_url: product.image_path ? imageResult.urls.get(product.image_path) ?? null : null,
    })),
    ...(imageResult.error ? { imageError: "Foto produk tidak dapat dimuat." } : {}),
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
  const totalValidationError = getSaleTotalValidationError(subtotal, discountAmount);
  if (totalValidationError) {
    return { status: "error", message: totalValidationError };
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

  const result = readSaleResult(data);
  let saleId = result.saleId;
  if (saleId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId)) {
    saleId = null;
  }
  let invoiceNumber = result.invoiceNumber;
  if (!saleId || !invoiceNumber) {
    if (saleId) {
      const { data: sale, error: saleLookupError } = await supabase
        .from("sales")
        .select("id, invoice_number")
        .eq("id", saleId)
        .maybeSingle();
      if (saleLookupError) {
        logSupabaseError("sales.lookup_created_sale", saleLookupError);
        return { status: "error", message: "Transaksi tersimpan, tetapi detail invoice tidak dapat dimuat." };
      }
      saleId ??= sale?.id ?? null;
      invoiceNumber ??= sale?.invoice_number ?? undefined;
    } else if (invoiceNumber) {
      const { data: sale, error: saleLookupError } = await supabase
        .from("sales")
        .select("id, invoice_number")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();
      if (saleLookupError) {
        logSupabaseError("sales.lookup_created_sale", saleLookupError);
        return { status: "error", message: "Transaksi tersimpan, tetapi detail invoice tidak dapat dimuat." };
      }
      saleId = sale?.id ?? null;
      invoiceNumber ??= sale?.invoice_number ?? undefined;
    }
  }
  if (!saleId || !invoiceNumber) {
    console.error("[GemFlow POS] Successful checkout returned incomplete identifiers", JSON.stringify({
      saleIdPresent: Boolean(saleId),
      invoiceNumberPresent: Boolean(invoiceNumber),
    }));
    return { status: "error", message: "Transaksi tersimpan, tetapi nomor invoice tidak dapat dimuat." };
  }
  const successDetails: SaleSuccessDetails = {
    saleId,
    invoiceNumber,
    total: result.total ?? total,
    amountPaid: result.amountPaid ?? amountPaid,
    change: result.change ?? Math.max(0, amountPaid - total),
    customerName: result.customerName ?? (field(formData, "customer_name") || null),
  };

  revalidatePath("/inventory");
  return {
    status: "success",
    message: "Transaksi berhasil disimpan.",
    saleId: successDetails.saleId,
    invoiceNumber: successDetails.invoiceNumber,
    total: successDetails.total,
    amountPaid: successDetails.amountPaid,
    change: successDetails.change,
    customerName: successDetails.customerName,
  };
}
