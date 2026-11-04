import { Gem } from "lucide-react";

import { SalesDocumentClose } from "@/components/sales-document-close";
import { SalesDocumentPrint } from "@/components/sales-document-print";
import { formatRupiah } from "@/lib/inventory";
import { getSalesDocument } from "@/lib/sales-document";

type Props = {
  saleId: string;
};

function formatDate(value: string | null) {
  if (!value) return "Waktu tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tidak tersedia"
    : new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(date);
}

export async function SalesDocumentPage({ saleId }: Props) {
  const sale = await getSalesDocument(saleId);

  return (
    <main className="sales-document-page sales-document-invoice mx-auto min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="no-print mx-auto mb-5 flex max-w-4xl items-center justify-between gap-3">
        <SalesDocumentClose />
        <SalesDocumentPrint />
      </div>

      <article className="sales-document-card mx-auto bg-white text-slate-900 invoice-card">
        <header className="sales-document-header invoice-header">
          <div className="flex items-center gap-2">
            <Gem aria-hidden="true" className="size-7 text-emerald-700" />
            <div>
              <p className="text-xl font-bold tracking-tight">GemFlow</p>
              <p className="text-sm text-slate-500">Invoice Penjualan</p>
            </div>
          </div>
          <div className="invoice-number-block">
            <p className="text-xs uppercase tracking-wider text-slate-500">Nomor invoice</p>
            <p className="font-semibold">{sale.invoiceNumber}</p>
          </div>
        </header>

        <section className="sales-document-meta grid gap-3 border-b border-slate-200 py-4 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Tanggal</span><br /><strong>{formatDate(sale.createdAt)}</strong></p>
          <p><span className="text-slate-500">Kasir</span><br /><strong>{sale.cashierName}</strong></p>
          {sale.customerName ? <p><span className="text-slate-500">Pelanggan</span><br /><strong>{sale.customerName}</strong></p> : null}
        </section>

        <section className="sales-document-items py-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Produk</th><th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Harga awal</th><th className="px-2 py-2 text-right">Diskon/item</th>
                <th className="py-2 pl-2 text-right">Harga akhir/item</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-3"><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.sku}</p></td>
                  <td className="px-2 py-3 text-right">{item.quantity}</td>
                  <td className="px-2 py-3 text-right">{formatRupiah(item.originalPrice)}</td>
                  <td className="px-2 py-3 text-right">{formatRupiah(item.discount)}</td>
                  <td className="py-3 pl-2 text-right">{formatRupiah(item.finalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="sales-document-totals ml-auto space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between gap-4"><span>Subtotal</span><span>{formatRupiah(sale.subtotal)}</span></div>
          <div className="flex justify-between gap-4"><span>Diskon transaksi</span><span>−{formatRupiah(sale.transactionDiscount)}</span></div>
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{formatRupiah(sale.total)}</span></div>
          <div className="flex justify-between gap-4"><span>Metode pembayaran</span><span className="capitalize">{sale.paymentMethod.replaceAll("_", " ")}</span></div>
          <div className="flex justify-between gap-4"><span>Dibayar</span><span>{formatRupiah(sale.amountPaid)}</span></div>
          <div className="flex justify-between gap-4"><span>Kembalian</span><span>{formatRupiah(sale.change)}</span></div>
        </section>

        {sale.notes ? (
          <section className="sales-document-notes mt-5 border-t border-slate-200 pt-3 text-sm">
            <p className="font-semibold">Catatan</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-600">{sale.notes}</p>
          </section>
        ) : null}
        <footer className="sales-document-footer mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          Terima kasih telah berbelanja di GemFlow.
        </footer>
      </article>
    </main>
  );
}
