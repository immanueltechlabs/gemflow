export type StockMovement = {
  id: string;
  movementType: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  productId: string | null;
  performedBy: string | null;
  createdAt: string;
  sku: string | null;
  barcode: string | null;
  productName: string | null;
  staffName: string | null;
};

export type StockMovementFilters = {
  dateFrom: string;
  dateTo: string;
  movementType: string;
  performedBy: string;
  productQuery: string;
};

export type StockMovementStaffOption = {
  id: string;
  fullName: string;
};

export type StockMovementPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
};

export const stockMovementTypes = [
  "stock_in",
  "sale",
  "return_in",
  "stock_out",
  "adjustment",
  "damage",
  "transfer",
] as const;

const movementLabels: Record<string, string> = {
  stock_in: "Stok masuk",
  sale: "Penjualan",
  return_in: "Retur masuk",
  stock_out: "Stok keluar",
  adjustment: "Penyesuaian stok",
  damage: "Barang rusak",
  transfer: "Perpindahan stok",
};

const referenceLabels: Record<string, string> = {
  product: "Produk",
  sale: "Penjualan",
  return: "Retur",
  adjustment: "Penyesuaian",
};

function readableValue(value: string) {
  return value.replaceAll("_", " ");
}

export function movementTypeLabel(value: string) {
  return movementLabels[value] ?? `Pergerakan lainnya (${readableValue(value)})`;
}

export function referenceTypeLabel(value: string | null) {
  if (!value) return "—";
  return referenceLabels[value] ?? `Referensi lainnya (${readableValue(value)})`;
}
