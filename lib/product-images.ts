import "server-only";

import { createClient } from "@/lib/supabase/server";

export const productImageBucket = "product-images";
const maxProductImageBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
]);

export type ValidatedProductImage = {
  file: File;
  contentType: string;
  extension: string;
};

type StorageError = {
  message: string;
  code?: string;
};

export async function validateProductImage(value: FormDataEntryValue | null): Promise<ValidatedProductImage | string | null> {
  if (!(value instanceof File) || !value.name.trim() || value.size === 0) return null;
  if (value.size > maxProductImageBytes) return "Ukuran foto maksimal 5 MB.";

  const extension = value.name.slice(value.name.lastIndexOf(".")).toLowerCase();
  const extensions = allowedMimeTypes.get(value.type);
  if (!extensions?.has(extension)) {
    return "Gunakan foto JPG, PNG, atau WebP dengan tipe file yang sesuai.";
  }

  const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  const validSignature = value.type === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : value.type === "image/png"
      ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
      : bytes.slice(0, 4).join(",") === "82,73,70,70" &&
        bytes.slice(8, 12).join(",") === "87,69,66,80";

  if (!validSignature) return "Isi file tidak cocok dengan format foto yang dipilih.";

  return {
    file: value,
    contentType: value.type,
    extension: value.type === "image/jpeg" ? ".jpg" : extension,
  };
}

export function isProductImagePath(path: string | null, productId: string) {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return path !== null &&
    new RegExp(`^products/${productId}/${uuid}\\.(jpg|png|webp)$`, "i").test(path);
}

export async function signProductImage(productId: string, path: string): Promise<{
  url: string | null;
  error: StorageError | null;
}> {
  if (!isProductImagePath(path, productId)) {
    return {
      url: null,
      error: { code: "INVALID_IMAGE_PATH", message: "Stored product image path is invalid." },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(productImageBucket)
    .createSignedUrl(path, 900);

  if (error) return { url: null, error };
  return { url: data.signedUrl, error: null };
}

export async function signProductImages(products: { id: string; image_path: string | null }[]): Promise<{
  urls: Map<string, string>;
  error: StorageError | null;
}> {
  if (products.some((product) => product.image_path && !isProductImagePath(product.image_path, product.id))) {
    return {
      urls: new Map(),
      error: { code: "INVALID_IMAGE_PATH", message: "Stored product image path is invalid." },
    };
  }
  const uniquePaths = [...new Set(products
    .filter((product) => isProductImagePath(product.image_path, product.id))
    .map((product) => product.image_path as string))];
  if (!uniquePaths.length) return { urls: new Map(), error: null };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(productImageBucket)
    .createSignedUrls(uniquePaths, 3600);

  if (error) return { urls: new Map(), error };

  const urls = new Map<string, string>();
  for (const image of data ?? []) {
    if (image.error) {
      return {
        urls: new Map(),
        error: { code: "SIGNED_URL_ERROR", message: image.error },
      };
    }
    if (!image.path || !image.signedUrl) continue;
    urls.set(image.path, image.signedUrl);
  }
  return { urls, error: null };
}

export async function uploadProductImage(
  productId: string,
  image: ValidatedProductImage,
): Promise<{ path: string | null; error: StorageError | null }> {
  const path = `products/${productId}/${crypto.randomUUID()}${image.extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(productImageBucket)
    .upload(path, image.file, {
      contentType: image.contentType,
      cacheControl: "3600",
      upsert: false,
    });

  return { path: error ? null : path, error };
}

export async function removeProductImage(path: string) {
  const supabase = await createClient();
  return supabase.storage.from(productImageBucket).remove([path]);
}
