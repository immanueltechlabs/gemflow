"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { productStatuses, type InventoryActionState, type ProductStatus } from "@/lib/inventory";
import { productSelect } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

type ProductInput = {
  barcode: string;
  name: string;
  category: string;
  grade: string;
  weight_grams: number;
  supplier_name: string;
  cost_price: number;
  selling_price: number;
  status: ProductStatus;
  received_at: string;
};

function textField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberField(formData: FormData, name: string) {
  const raw = textField(formData, name);
  return raw === "" ? Number.NaN : Number(raw);
}

function parseProductInput(formData: FormData): ProductInput | string {
  const name = textField(formData, "name");
  const category = textField(formData, "category");
  const grade = textField(formData, "grade");
  const supplierName = textField(formData, "supplier_name");
  const barcode = textField(formData, "barcode");
  const receivedAt = textField(formData, "received_at");
  const weightGrams = numberField(formData, "weight_grams");
  const costPrice = numberField(formData, "cost_price");
  const sellingPrice = numberField(formData, "selling_price");
  const status = textField(formData, "status");

  if (!name || !category || !grade || !supplierName || !receivedAt) {
    return "Lengkapi semua detail produk yang wajib diisi.";
  }
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return "Berat harus lebih besar dari nol.";
  }
  if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
    return "Harga modal dan harga jual harus berupa nilai positif yang valid.";
  }
  if (sellingPrice < costPrice) {
    return "Harga jual tidak boleh lebih rendah dari harga modal.";
  }
  const productStatus = productStatuses.find((allowedStatus) => allowedStatus === status);
  if (!productStatus) {
    return "Pilih status produk yang valid.";
  }

  const receivedDate = new Date(receivedAt);
  if (Number.isNaN(receivedDate.getTime())) {
    return "Pilih tanggal penerimaan yang valid.";
  }

  return {
    barcode,
    name,
    category,
    grade,
    weight_grams: weightGrams,
    supplier_name: supplierName,
    cost_price: costPrice,
    selling_price: sellingPrice,
    status: productStatus,
    received_at: receivedDate.toISOString(),
  };
}

type SupabaseMutationError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function logSupabaseError(statement: string, error: SupabaseMutationError) {
  if (process.env.NODE_ENV === "development") {
    console.error(
      `[GemFlow Supabase] ${statement} ${JSON.stringify({
        code: error.code ?? "unknown",
        message: error.message,
        details: error.details ?? null,
        hint: error.hint ?? null,
      })}`,
    );
  }
}

function mutationError(
  operation: string,
  error: SupabaseMutationError,
  statement = operation,
) {
  logSupabaseError(statement, error);
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return `${operation} diblokir oleh keamanan basis data. Peran Admin yang terautentikasi memerlukan kebijakan RLS yang mengizinkan operasi ini dengan syarat profiles.role = 'admin'.`;
  }
  return `${operation} gagal. Coba lagi atau hubungi administrator.`;
}

export async function createProduct(
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    return { status: "error", message: "Hanya Admin yang dapat menambahkan produk." };
  }

  const input = parseProductInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_inventory_product", {
    p_name: input.name,
    p_category: input.category,
    p_grade: input.grade,
    p_weight_grams: input.weight_grams,
    p_supplier_name: input.supplier_name,
    p_cost_price: input.cost_price,
    p_selling_price: input.selling_price,
    p_received_at: input.received_at,
    p_status: input.status,
  });

  if (error) {
    logSupabaseError("rpc(create_inventory_product)", error);
    return {
      status: "error",
      message: "Pembuatan produk gagal. Coba lagi atau hubungi administrator.",
    };
  }

  revalidatePath("/inventory");
  return { status: "success", message: "Produk berhasil ditambahkan ke inventaris." };
}

export async function updateProduct(
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    return { status: "error", message: "Hanya Admin yang dapat mengedit produk." };
  }

  const productId = textField(formData, "product_id");
  if (!productId) return { status: "error", message: "Identitas produk tidak ditemukan." };

  const input = parseProductInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  const supabase = await createClient();
  if (!input.barcode) {
    const { data: currentProduct, error: lookupError } = await supabase
      .from("products")
      .select("sku")
      .eq("id", productId)
      .single();
    if (lookupError) {
      return {
        status: "error",
        message: mutationError("Pencarian produk", lookupError, "products.select(sku)"),
      };
    }
    input.barcode = currentProduct.sku;
  }
  const { error } = await supabase
    .from("products")
    .update(input)
    .eq("id", productId)
    .select(productSelect)
    .single();

  if (error) {
    return {
      status: "error",
      message: mutationError("Pembaruan produk", error, "products.update"),
    };
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}/label`);
  return { status: "success", message: "Detail produk berhasil diperbarui." };
}
