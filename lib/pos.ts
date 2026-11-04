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

export function getSaleTotalValidationError(subtotal: number, discountAmount: number): string | null {
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return "Diskon harus berupa nilai yang valid.";
  }
  if (!Number.isFinite(subtotal) || subtotal < 0 || discountAmount > subtotal) {
    return "Diskon tidak boleh melebihi subtotal.";
  }
  if (subtotal - discountAmount <= 0) {
    return "Total transaksi harus lebih dari Rp0.";
  }
  return null;
}

export type PosProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  selling_price: number | null;
  image_path: string | null;
  image_url?: string | null;
};

export type PosActionState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      saleId: string;
      invoiceNumber: string;
      total: number;
      amountPaid: number;
      change: number;
      customerName: string | null;
    };

export type SaleSuccessDetails = {
  saleId: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  change: number;
  customerName: string | null;
};

export const initialPosActionState: PosActionState = {
  status: "idle",
  message: "",
};