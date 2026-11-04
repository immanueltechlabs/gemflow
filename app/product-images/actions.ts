"use server";

import { getCurrentProfile } from "@/lib/auth";
import { isProductImagePath, signProductImage } from "@/lib/product-images";

export async function getProductPhotoPreviewUrl(productId: string, imagePath: string) {
  if (
    typeof productId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) ||
    typeof imagePath !== "string" ||
    !isProductImagePath(imagePath, productId)
  ) {
    return { url: null, error: "Foto produk tidak valid." };
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { url: null, error: "Anda tidak memiliki akses untuk melihat foto produk." };
  }

  const result = await signProductImage(productId, imagePath);
  if (result.error || !result.url) {
    console.error("[GemFlow Product Photo] Preview signing failed.", {
      code: result.error?.code ?? "SIGNED_URL_MISSING",
      message: result.error?.message ?? "Storage did not return a signed URL.",
    });
    return { url: null, error: "Foto produk tidak dapat dimuat. Silakan coba lagi." };
  }

  return { url: result.url, error: null };
}
