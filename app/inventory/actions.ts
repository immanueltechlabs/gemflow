"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import type { InventoryActionState } from "@/lib/inventory";
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
  status: "active" | "inactive";
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
  if (status !== "active" && status !== "inactive") {
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
    status,
    received_at: receivedDate.toISOString(),
  };
}

function mutationError(operation: string, error: { code?: string; message: string }) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[GemFlow inventaris] ${operation}: ${error.code ?? "unknown"} ${error.message}`);
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return `${operation} diblokir oleh keamanan basis data. Peran Admin yang terautentikasi memerlukan kebijakan RLS yang mengizinkan operasi ini dengan syarat profiles.role = 'admin'.`;
  }
  return `${operation} gagal. Coba lagi atau hubungi administrator.`;
}

function nextSku(previousSku?: string | null) {
  const match = previousSku?.match(/^GEM-(\d{6})$/);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  return `GEM-${String(nextNumber).padStart(6, "0")}`;
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
  let createdProduct: { id: string; sku: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: latest } = await supabase
      .from("products")
      .select("sku")
      .like("sku", "GEM-%")
      .order("sku", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sku = nextSku(latest?.sku);
    const { data, error } = await supabase
      .from("products")
      .insert({ ...input, sku, barcode: input.barcode || sku })
      .select("id, sku")
      .single();

    if (!error) {
      createdProduct = data;
      break;
    }
    if (error.code !== "23505" || input.barcode) {
      return { status: "error", message: mutationError("Pembuatan produk", error) };
    }
  }

  if (!createdProduct) {
    return { status: "error", message: "SKU unik tidak dapat dibuat setelah beberapa percobaan. Coba lagi." };
  }

  const { error: movementError } = await supabase.from("stock_movements").insert({
    product_id: createdProduct.id,
    movement_type: "stock_in",
    performed_by: profile.userId,
  });

  if (movementError) {
    const { error: deactivateError } = await supabase
      .from("products")
      .update({ status: "inactive" })
      .eq("id", createdProduct.id);
    return {
      status: "error",
      message: deactivateError
        ? `${mutationError("Pergerakan stok awal", movementError)} Produk berhasil dibuat, tetapi penonaktifan otomatis juga diblokir. Kebijakan UPDATE pada products dan INSERT pada stock_movements harus mengizinkan Admin yang terautentikasi.`
        : `${mutationError("Pergerakan stok awal", movementError)} Produk ditandai tidak aktif agar tidak digunakan tanpa catatan stok.`,
    };
  }

  revalidatePath("/inventory");
  return { status: "success", message: `${createdProduct.sku} berhasil ditambahkan ke inventaris.` };
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
      return { status: "error", message: mutationError("Pencarian produk", lookupError) };
    }
    input.barcode = currentProduct.sku;
  }
  const { error } = await supabase
    .from("products")
    .update(input)
    .eq("id", productId)
    .select(productSelect)
    .single();

  if (error) return { status: "error", message: mutationError("Pembaruan produk", error) };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}/label`);
  return { status: "success", message: "Detail produk berhasil diperbarui." };
}
