import type { Metadata } from "next";

import { SalesDocumentPage } from "../sales-document-page";

export const metadata: Metadata = { title: "Invoice Penjualan | GemFlow" };
export const instant = false;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesDocumentPage saleId={id} />;
}
