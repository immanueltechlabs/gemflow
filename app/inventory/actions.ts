"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { productStatuses, type InventoryActionState, type ProductStatus } from "@/lib/inventory";
import {
  isProductImagePath,
  removeProductImage,
  uploadProductImage,
  validateProductImage,
} from "@/lib/product-images";
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

function readCreatedProductId(value: unknown): string | null {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let current = value;
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) {
      current = current[0];
      continue;
    }
    if (typeof current === "string") return uuidPattern.test(current) ? current : null;
    if (!current || typeof current !== "object") return null;
    const record = current as Record<string, unknown>;
    const id = record.product_id ?? record.id;
    if (typeof id === "string" && uuidPattern.test(id)) return id;
    current = record.product ?? record.result ?? record.data ?? record.create_inventory_product;
  }
  return null;
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
  const image = await validateProductImage(formData.get("image_file"));
  if (typeof image === "string") return { status: "error", message: image };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_inventory_product", {
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

  if (image) {
    const productId = readCreatedProductId(data);
    if (!productId) {
      console.error("[GemFlow Inventaris] Product created without an ID in the RPC response; image upload skipped.");
      revalidatePath("/inventory");
      return {
        status: "success",
        message: "Produk berhasil ditambahkan, tetapi foto belum dapat dipasang. Edit produk untuk mencoba kembali.",
      };
    }

    const uploaded = await uploadProductImage(productId, image);
    if (uploaded.error || !uploaded.path) {
      logSupabaseError("storage.product_image.upload", uploaded.error ?? {
        message: "Upload tidak menghasilkan path file.",
      });
      revalidatePath("/inventory");
      return {
        status: "success",
        message: "Produk berhasil ditambahkan, tetapi foto gagal diunggah. Edit produk untuk mencoba kembali.",
      };
    }

    const { error: imageError } = await supabase.rpc("update_product_image_with_audit", {
      p_product_id: productId,
      p_new_image_path: uploaded.path,
    });
    if (imageError) {
      const cleanup = await removeProductImage(uploaded.path);
      if (cleanup.error) logSupabaseError("storage.product_image.cleanup", cleanup.error);
      logSupabaseError("rpc(update_product_image_with_audit)", imageError);
      revalidatePath("/inventory");
      return {
        status: "success",
        message: "Produk berhasil ditambahkan, tetapi foto gagal disimpan. Periksa konfigurasi foto produk sebelum mencoba lagi.",
      };
    }
  }

  revalidatePath("/inventory");
  return {
    status: "success",
    message: image ? "Produk dan foto berhasil ditambahkan ke inventaris." : "Produk berhasil ditambahkan ke inventaris.",
  };
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return { status: "error", message: "Identitas produk tidak valid." };
  }

  const input = parseProductInput(formData);
  if (typeof input === "string") return { status: "error", message: input };
  const image = await validateProductImage(formData.get("image_file"));
  if (typeof image === "string") return { status: "error", message: image };
  const removeImage = formData.get("remove_image") === "true";
  if (image && removeImage) return { status: "error", message: "Pilih unggah foto baru atau hapus foto saat ini." };

  const supabase = await createClient();
  let previousImagePath: string | null = null;
  if (image || removeImage) {
    const { data: currentProduct, error: imageLookupError } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", productId)
      .maybeSingle();
    if (imageLookupError || !currentProduct) {
      return {
        status: "error",
        message: imageLookupError
          ? mutationError("Pencarian foto produk", imageLookupError, "products.select(image_path)")
          : "Produk yang akan diperbarui tidak ditemukan.",
      };
    }
    previousImagePath = currentProduct.image_path;
  }

  let newImagePath: string | null | undefined;
  if (image) {
    const uploaded = await uploadProductImage(productId, image);
    if (uploaded.error || !uploaded.path) {
      logSupabaseError("storage.product_image.upload", uploaded.error ?? {
        message: "Upload tidak menghasilkan path file.",
      });
      return { status: "error", message: "Foto gagal diunggah. Periksa akses penyimpanan lalu coba lagi." };
    }
    newImagePath = uploaded.path;
  } else if (removeImage) {
    newImagePath = null;
  }

  if (!input.barcode) {
    const { data: currentProduct, error: lookupError } = await supabase
      .from("products")
      .select("sku")
      .eq("id", productId)
      .single();
    if (lookupError) {
      if (image && newImagePath) {
        const cleanup = await removeProductImage(newImagePath);
        if (cleanup.error) logSupabaseError("storage.product_image.cleanup", cleanup.error);
      }
      return {
        status: "error",
        message: mutationError("Pencarian produk", lookupError, "products.select(sku)"),
      };
    }
    input.barcode = currentProduct.sku;
  }
  const { error } = await supabase.rpc("update_product_with_audit", {
    p_product_id: productId,
    p_barcode: input.barcode,
    p_name: input.name,
    p_category: input.category,
    p_grade: input.grade,
    p_weight_grams: input.weight_grams,
    p_supplier_name: input.supplier_name,
    p_cost_price: input.cost_price,
    p_selling_price: input.selling_price,
    p_status: input.status,
    p_received_at: input.received_at,
  });

  if (error) {
    if (image && newImagePath) {
      const cleanup = await removeProductImage(newImagePath);
      if (cleanup.error) logSupabaseError("storage.product_image.cleanup", cleanup.error);
    }
    return {
      status: "error",
      message: mutationError("Pembaruan produk", error, "rpc(update_product_with_audit)"),
    };
  }

  let imageWarning = "";
  if (newImagePath !== undefined) {
    const { error: imageError } = await supabase.rpc("update_product_image_with_audit", {
      p_product_id: productId,
      p_new_image_path: newImagePath,
    });
    if (imageError) {
      if (image && newImagePath) {
        const cleanup = await removeProductImage(newImagePath);
        if (cleanup.error) logSupabaseError("storage.product_image.cleanup", cleanup.error);
      }
      logSupabaseError("rpc(update_product_image_with_audit)", imageError);
      imageWarning = " Detail produk tersimpan, tetapi foto gagal diperbarui.";
    } else if (
      previousImagePath &&
      previousImagePath !== newImagePath &&
      isProductImagePath(previousImagePath, productId)
    ) {
      const removal = await removeProductImage(previousImagePath);
      if (removal.error) {
        logSupabaseError("storage.product_image.remove_old", removal.error);
        imageWarning = " Foto baru tersimpan, tetapi file foto lama belum berhasil dihapus.";
      }
    } else if (previousImagePath && !isProductImagePath(previousImagePath, productId)) {
      console.error("[GemFlow Inventaris] Existing product image path was not eligible for deletion.");
      imageWarning = " Foto diperbarui, tetapi file foto lama tidak dihapus karena path tidak valid.";
    }
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}/label`);
  revalidatePath(`/inventory/${productId}/audit`);
  const successMessage = newImagePath === null
    ? "Detail produk berhasil diperbarui dan foto dihapus."
    : image
      ? "Detail produk dan foto berhasil diperbarui."
      : "Detail produk berhasil diperbarui.";
  return {
    status: "success",
    message: `${successMessage}${imageWarning}`,
  };
}
