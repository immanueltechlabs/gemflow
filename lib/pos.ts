export const paymentMethods = ["cash", "transfer", "qris", "debit", "credit", "other"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Tunai",
  transfer: "Transfer bank",
  qris: "QRIS",
  debit: "Kartu debit",
  credit: "Kartu kredit",
  other: "Lainnya",
};

export type PosProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  selling_price: number | null;
};

export type SaleReceipt = {
  invoiceNumber: string;
  total: number;
  change: number;
};

export type PosActionState = {
  status: "idle" | "success" | "error";
  message: string;
  receipt?: SaleReceipt;
};

export const initialPosActionState: PosActionState = {
  status: "idle",
  message: "",
};