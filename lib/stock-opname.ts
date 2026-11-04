export const stockOpnameStatuses = ["in_progress", "completed", "cancelled"] as const;
export type StockOpnameStatus = (typeof stockOpnameStatuses)[number];

export const stockOpnameSections = ["matched", "missing", "unexpected", "duplicate", "unknown"] as const;
export type StockOpnameSection = (typeof stockOpnameSections)[number];

export const stockOpnameSectionLabels: Record<StockOpnameSection, string> = {
  matched: "Sesuai",
  missing: "Belum ditemukan",
  unexpected: "Tidak diharapkan",
  duplicate: "Duplikat",
  unknown: "Barcode tidak dikenal",
};

export type StockOpnameSession = {
  id: string;
  started_by: string;
  completed_by: string | null;
  started_at: string;
  completed_at: string | null;
  status: StockOpnameStatus;
  expected_count: number;
  matched_count: number;
  missing_count: number;
  unexpected_count: number;
  duplicate_count: number;
  unknown_count: number;
  notes: string | null;
};

export type StockOpnameScan = {
  id: string;
  product_id: string | null;
  scanned_code: string;
  barcode: string | null;
  sku: string | null;
  product_name: string | null;
  image_path: string | null;
  image_url?: string | null;
  result: "matched" | "duplicate" | "unexpected" | "unknown";
  scanned_at: string;
};

export type StockOpnameItem = {
  id: string;
  product_id: string;
  barcode: string | null;
  sku: string;
  product_name: string;
  image_path: string | null;
  image_url?: string | null;
  scanned: boolean;
  scan_count: number;
  scanned_at: string | null;
};

export type StockOpnamePageMeta = {
  page: number;
  totalPages: number;
  totalCount: number;
  previousHref: string | null;
  nextHref: string | null;
};

export function formatOpnameDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function opnameStatusLabel(status: StockOpnameStatus) {
  if (status === "completed") return "Selesai";
  if (status === "cancelled") return "Dibatalkan";
  return "Berlangsung";
}
