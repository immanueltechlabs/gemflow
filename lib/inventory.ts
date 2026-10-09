export const productStatuses = ["available", "reserved", "sold", "returned", "inactive"] as const;

export type ProductStatus = (typeof productStatuses)[number];

export const productStatusLabels: Record<ProductStatus, string> = {
  available: "Aktif",
  reserved: "Dipesan",
  sold: "Terjual",
  returned: "Diretur",
  inactive: "Nonaktif",
};

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  grade: string | null;
  weight_grams: number | null;
  supplier_name: string | null;
  cost_price: number | null;
  selling_price: number | null;
  status: ProductStatus;
  received_at: string | null;
};

export type InventoryActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialInventoryActionState: InventoryActionState = {
  status: "idle",
  message: "",
};

export const productSelect =
  "id, sku, barcode, name, category, grade, weight_grams, supplier_name, cost_price, selling_price, status, received_at";

export function formatRupiah(value: number | null) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatReceivedAt(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}
