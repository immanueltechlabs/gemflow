"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Search,
  RotateCcw,
  Undo2,
} from "lucide-react";

import { createReturn, searchReturnSales } from "@/app/returns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/inventory";
import { paymentMethodLabels, paymentMethods, type PaymentMethod } from "@/lib/pos";
import {
  initialReturnActionState,
  returnConditionLabels,
  returnConditions,
  type ReturnableSale,
  type ReturnableSaleItem,
  type ReturnCondition,
  type ReturnReceipt,
} from "@/lib/returns";

function saleDate(value: string | null) {
  if (!value) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function itemStatusLabel(status: string) {
  if (status === "not_returned") return "Belum diretur";
  if (status === "returned") return "Sudah diretur";
  return status;
}

function productStatusLabel(status: string) {
  if (status === "available") return "Tersedia";
  if (status === "returned") return "Diretur";
  return status;
}

export function ReturnsWorkbench() {
  const router = useRouter();
  const [returnState, returnAction, returnPending] = useActionState(createReturn, initialReturnActionState);
  const [searchPending, startSearch] = useTransition();
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [sales, setSales] = useState<ReturnableSale[]>([]);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedItem, setSelectedItem] = useState<ReturnableSaleItem | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("cash");
  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState<ReturnCondition>("resellable");
  const [restock, setRestock] = useState(true);
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<ReturnReceipt | null>(null);

  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? null;

  const runSearch = (value: string) => {
    const searchTerm = value.trim();
    if (searchTerm.length < 2) {
      setSearchError("Masukkan minimal 2 karakter untuk mencari invoice atau nama pelanggan.");
      setSales([]);
      setSelectedSaleId("");
      setSelectedItem(null);
      setHasSearched(false);
      return;
    }

    setSearchedQuery(searchTerm);
    setSearchError("");
    setHasSearched(true);
    startSearch(async () => {
      const result = await searchReturnSales(searchTerm);
      setSales(result.sales);
      setSearchError(result.error ?? "");
      setSelectedSaleId("");
      setSelectedItem(null);
    });
  };

  useEffect(() => {
    if (returnState.status !== "success" || !returnState.receipt) return;

    setReceipt(returnState.receipt);
    setSelectedItem(null);
    setRefundAmount("");
    setReason("");
    setNotes("");
    setCondition("resellable");
    setRestock(true);
    router.refresh();

    let cancelled = false;
    void searchReturnSales(searchedQuery).then((result) => {
      if (cancelled) return;
      setSales(result.sales);
      setSearchError(result.error ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [returnState, router, searchedQuery]);

  const chooseItem = (item: ReturnableSaleItem) => {
    setSelectedItem(item);
    setRefundAmount(String(item.refundableAmount));
    setRefundMethod("cash");
    setReason("");
    setCondition("resellable");
    setRestock(true);
    setNotes("");
  };

  const handleConditionChange = (value: string) => {
    const nextCondition = returnConditions.find((allowed) => allowed === value);
    if (!nextCondition) return;
    setCondition(nextCondition);
    setRestock(nextCondition === "resellable");
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="return-search-heading" className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 id="return-search-heading" className="font-semibold">Cari transaksi penjualan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cari berdasarkan nomor invoice atau nama pelanggan.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(query);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Contoh: INV-2026-001 atau nama pelanggan"
              aria-label="Nomor invoice atau nama pelanggan"
              className="h-11 rounded-lg pl-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </div>
          <Button type="submit" disabled={searchPending} className="h-11 min-w-32">
            {searchPending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Mencari</> : <><Search aria-hidden="true" />Cari transaksi</>}
          </Button>
        </form>
      </section>

      {receipt ? (
        <section aria-labelledby="return-receipt-heading" role="status" className="rounded-xl border border-primary/25 bg-primary/[0.045] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 id="return-receipt-heading" className="font-semibold">Retur berhasil diproses</h2>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <p><span className="text-muted-foreground">Nomor retur</span><br /><span className="font-semibold">{receipt.returnNumber}</span></p>
                <p><span className="text-muted-foreground">Pengembalian dana</span><br /><span className="font-semibold tabular-nums">{formatRupiah(receipt.refundAmount)}</span></p>
                <p><span className="text-muted-foreground">Status barang penjualan</span><br /><span className="font-semibold">{itemStatusLabel(receipt.itemStatus)}</span></p>
                <p><span className="text-muted-foreground">Status produk</span><br /><span className="font-semibold">{productStatusLabel(receipt.productStatus)}</span></p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {searchError ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2.5">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="break-words">{searchError}</p>
          </div>
        </div>
      ) : null}

      {returnState.status === "error" ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2.5">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>{returnState.message}</p>
          </div>
        </div>
      ) : null}

      {hasSearched && !searchError ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
          <section aria-labelledby="sales-results-heading" className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b p-4 sm:p-5">
              <div>
                <h2 id="sales-results-heading" className="font-semibold">Hasil pencarian</h2>
                <p className="mt-1 text-sm text-muted-foreground">{sales.length} transaksi</p>
              </div>
              <RotateCcw aria-hidden="true" className="size-5 text-primary" />
            </div>
            {sales.length ? (
              <ul className="divide-y">
                {sales.map((sale) => {
                  const active = sale.id === selectedSaleId;
                  return (
                    <li key={sale.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSaleId(sale.id);
                          setSelectedItem(null);
                        }}
                        aria-pressed={active}
                        className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${active ? "bg-primary/[0.06]" : ""}`}
                      >
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                          <RotateCcw aria-hidden="true" className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{sale.invoiceNumber}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{sale.customerName || "Pelanggan umum"} · {sale.items.length} barang</span>
                        </span>
                        <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">{saleDate(sale.createdAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-12 text-center">
                <Search aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 font-medium">Transaksi tidak ditemukan</p>
                <p className="mt-1 text-sm text-muted-foreground">Periksa nomor invoice atau nama pelanggan.</p>
              </div>
            )}
          </section>

          <section aria-labelledby="sale-details-heading" className="overflow-hidden rounded-xl border bg-card">
            {selectedSale ? (
              <>
                <div className="border-b p-4 sm:p-5">
                  <h2 id="sale-details-heading" className="font-semibold">Detail penjualan</h2>
                  <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-lg font-semibold">{selectedSale.invoiceNumber}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedSale.customerName || "Pelanggan umum"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{saleDate(selectedSale.createdAt)}</p>
                  </div>
                </div>
                <ul className="divide-y px-4 sm:px-5">
                  {selectedSale.items.map((item) => {
                    const returnable = item.returnStatus === "not_returned";
                    const activeItem = selectedItem?.id === item.id;
                    return (
                      <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.sku} · {item.quantity} barang · {formatRupiah(item.unitPrice)} per barang
                          </p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">Nilai barang {formatRupiah(item.refundableAmount)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className={`text-xs font-medium ${returnable ? "text-muted-foreground" : "text-primary"}`}>
                            {itemStatusLabel(item.returnStatus)}
                          </span>
                          {returnable ? (
                            <Button
                              type="button"
                              variant={activeItem ? "secondary" : "outline"}
                              onClick={() => chooseItem(item)}
                              className="h-10 min-w-28"
                            >
                              {activeItem ? <><CircleCheck aria-hidden="true" />Dipilih</> : <><Undo2 aria-hidden="true" />Pilih retur</>}
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {selectedSale.items.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Detail barang untuk transaksi ini tidak tersedia.</p>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
                <RotateCcw aria-hidden="true" className="size-6 text-muted-foreground" />
                <h2 id="sale-details-heading" className="mt-3 font-medium">Pilih transaksi</h2>
                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Detail penjualan dan barang yang dapat diretur akan tampil di sini.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {selectedItem && selectedSale ? (
        <section aria-labelledby="return-form-heading" className="rounded-xl border bg-card">
          <div className="border-b p-4 sm:p-5">
            <h2 id="return-form-heading" className="font-semibold">Proses retur barang</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selectedItem.productName} · {selectedSale.invoiceNumber}</p>
          </div>
          <form action={returnAction} className="space-y-5 p-4 sm:p-5">
            <input type="hidden" name="sale_item_id" value={selectedItem.id} />
            <input type="hidden" name="restock" value={restock ? "true" : "false"} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="return-refund-amount" className="text-sm font-medium">Jumlah pengembalian dana</label>
                <Input
                  id="return-refund-amount"
                  name="refund_amount"
                  type="number"
                  inputMode="numeric"
                  min={Math.min(1, Math.max(0, selectedItem.refundableAmount))}
                  max={Math.max(0, selectedItem.refundableAmount)}
                  step="1"
                  required
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="h-11 tabular-nums"
                />
                <p className="text-xs text-muted-foreground">Maksimal {formatRupiah(selectedItem.refundableAmount)}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="return-refund-method" className="text-sm font-medium">Metode pengembalian dana</label>
                <select
                  id="return-refund-method"
                  name="refund_method"
                  value={refundMethod}
                  onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{paymentMethodLabels[method]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="return-condition" className="text-sm font-medium">Kondisi barang</label>
                <select
                  id="return-condition"
                  name="item_condition"
                  value={condition}
                  onChange={(event) => handleConditionChange(event.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {returnConditions.map((itemCondition) => (
                    <option key={itemCondition} value={itemCondition}>{returnConditionLabels[itemCondition]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2 xl:col-span-3">
                <label htmlFor="return-reason" className="text-sm font-medium">Alasan retur</label>
                <Input
                  id="return-reason"
                  name="reason"
                  required
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Contoh: ukuran tidak sesuai"
                  className="h-11"
                />
              </div>
            </div>

            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5">
              <input
                type="checkbox"
                checked={restock}
                onChange={(event) => setRestock(event.target.checked)}
                className="size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Masukkan kembali ke inventaris</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Produk layak jual akan tersedia kembali jika opsi ini dipilih.</span>
              </span>
            </label>

            <div className="space-y-2">
              <label htmlFor="return-notes" className="text-sm font-medium">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></label>
              <textarea
                id="return-notes"
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Catatan tambahan untuk retur ini"
                className="flex min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSelectedItem(null)} disabled={returnPending} className="h-11">Batal</Button>
              <Button type="submit" disabled={returnPending || !refundAmount || !reason.trim()} className="h-11 min-w-44">
                {returnPending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Memproses retur</> : <><RotateCcw aria-hidden="true" />Simpan retur</>}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}