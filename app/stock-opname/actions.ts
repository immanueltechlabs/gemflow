"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { signProductImages } from "@/lib/product-images";
import { createClient } from "@/lib/supabase/server";
import type { StockOpnameScan } from "@/lib/stock-opname";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

function logOpnameError(operation: string, error: { code?: string; message: string }) {
  console.error(`[GemFlow Stock Opname] ${operation}`, {
    code: error.code ?? "unknown",
    message: error.message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScanResult(value: unknown): Omit<StockOpnameScan, "image_url"> | null {
  if (!isRecord(value)) return null;
  const result = value.result;
  if (
    result !== "matched" &&
    result !== "duplicate" &&
    result !== "unexpected" &&
    result !== "unknown"
  ) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.scanned_code !== "string" ||
    typeof value.scanned_at !== "string"
  ) return null;

  return {
    id: value.id,
    product_id: typeof value.product_id === "string" ? value.product_id : null,
    scanned_code: value.scanned_code,
    barcode: typeof value.barcode === "string" ? value.barcode : null,
    sku: typeof value.sku === "string" ? value.sku : null,
    product_name: typeof value.product_name === "string" ? value.product_name : null,
    image_path: typeof value.image_path === "string" ? value.image_path : null,
    result,
    scanned_at: value.scanned_at,
  };
}

export async function startStockOpname(notes: string): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { data: null, error: "Akun ini tidak memiliki akses untuk memulai Stock Opname." };
  }
  if (typeof notes !== "string" || notes.length > 1000) {
    return { data: null, error: "Catatan maksimal 1.000 karakter." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_stock_opname", {
    p_notes: notes.trim() || null,
  });
  if (error) {
    logOpnameError("rpc(start_stock_opname)", error);
    if (error.message.includes("Masih ada Stock Opname yang sedang berjalan")) {
      return { data: null, error: "Masih ada Stock Opname yang sedang berjalan" };
    }
    return {
      data: null,
      error: "Stock Opname belum dapat dimulai. Pastikan konfigurasi database yang diperlukan sudah diterapkan.",
    };
  }

  const id = typeof data === "string"
    ? data
    : isRecord(data) && typeof data.id === "string"
      ? data.id
      : null;
  if (!id || !uuidPattern.test(id)) {
    console.error("[GemFlow Stock Opname] start RPC returned an invalid session ID.");
    return { data: null, error: "Stock Opname gagal dimulai karena identitas sesi tidak valid." };
  }

  revalidatePath("/stock-opname");
  return { data: { id }, error: null };
}

export async function scanStockOpname(
  opnameId: string,
  identifier: string,
): Promise<ActionResult<StockOpnameScan>> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { data: null, error: "Akun ini tidak memiliki akses untuk memindai Stock Opname." };
  }
  if (!uuidPattern.test(opnameId)) return { data: null, error: "Identitas sesi tidak valid." };
  const scannedCode = identifier.trim().slice(0, 100);
  if (!scannedCode) return { data: null, error: "Barcode atau SKU kosong." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scan_stock_opname", {
    p_stock_opname_id: opnameId,
    p_identifier: scannedCode,
  });
  if (error) {
    logOpnameError("rpc(scan_stock_opname)", error);
    return {
      data: null,
      error: "Pemindaian gagal dicatat. Pastikan sesi masih berlangsung, lalu coba lagi.",
    };
  }

  const scan = parseScanResult(data);
  if (!scan) {
    console.error("[GemFlow Stock Opname] scan RPC returned an invalid scan record.");
    return { data: null, error: "Respons pemindaian tidak valid. Muat ulang sesi." };
  }

  let imageUrl: string | null = null;
  if (scan.product_id && scan.image_path) {
    const imageResult = await signProductImages([{
      id: scan.product_id,
      image_path: scan.image_path,
    }]);
    if (imageResult.error) {
      logOpnameError("storage.product_image.sign_urls", imageResult.error);
    } else {
      imageUrl = imageResult.urls.get(scan.image_path) ?? null;
    }
  }

  revalidatePath(`/stock-opname/${opnameId}`);
  return {
    data: { ...scan, image_url: imageUrl },
    error: null,
  };
}

export async function cancelStockOpname(opnameId: string): Promise<ActionResult<null>> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { data: null, error: "Akun ini tidak memiliki akses untuk membatalkan Stock Opname." };
  }
  if (!uuidPattern.test(opnameId)) return { data: null, error: "Identitas sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_stock_opname", {
    p_stock_opname_id: opnameId,
  });
  if (error) {
    logOpnameError("rpc(cancel_stock_opname)", error);
    return {
      data: null,
      error: "Stock Opname tidak dapat dibatalkan. Pastikan sesi masih berlangsung dan Anda memiliki akses.",
    };
  }

  revalidatePath("/stock-opname");
  revalidatePath(`/stock-opname/${opnameId}`);
  return { data: null, error: null };
}

export async function completeStockOpname(opnameId: string): Promise<ActionResult<null>> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { data: null, error: "Akun ini tidak memiliki akses untuk menyelesaikan Stock Opname." };
  }
  if (!uuidPattern.test(opnameId)) return { data: null, error: "Identitas sesi tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_stock_opname", {
    p_stock_opname_id: opnameId,
  });
  if (error) {
    logOpnameError("rpc(complete_stock_opname)", error);
    return {
      data: null,
      error: "Stock Opname tidak dapat diselesaikan. Pastikan sesi masih berlangsung, lalu coba lagi.",
    };
  }

  revalidatePath("/stock-opname");
  revalidatePath(`/stock-opname/${opnameId}`);
  return { data: null, error: null };
}
