import type { PaymentMethod } from "@/lib/pos";

export const returnConditions = ["resellable", "damaged", "other"] as const;

export type ReturnCondition = (typeof returnConditions)[number];

export const returnConditionLabels: Record<ReturnCondition, string> = {
  resellable: "Layak jual",
  damaged: "Rusak",
  other: "Lainnya",
};

export type ReturnableSaleItem = {
  id: string;
  productId: string | null;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  refundableAmount: number;
  returnStatus: string;
};

export type ReturnableSale = {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  createdAt: string | null;
  items: ReturnableSaleItem[];
};

export type ReturnReceipt = {
  returnNumber: string;
  refundAmount: number;
  itemStatus: string;
  productStatus: string;
};

export type ReturnActionState = {
  status: "idle" | "success" | "error";
  message: string;
  receipt?: ReturnReceipt;
};

export type RefundMethod = PaymentMethod;

export const initialReturnActionState: ReturnActionState = {
  status: "idle",
  message: "",
};