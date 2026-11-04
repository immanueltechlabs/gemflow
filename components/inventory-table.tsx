"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  FilterX,
  History,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react";

import { Barcode } from "@/components/barcode";
import { ProductPhotoLightbox } from "@/components/product-photo-lightbox";
import { ProductForm } from "@/components/product-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/lib/auth";
import {
  formatReceivedAt,
  formatRupiah,
  productStatuses,
  productStatusLabels,
  type InventoryFilters,
  type InventoryListingProduct,
  type InventoryPagination,
  type Product,
} from "@/lib/inventory";

const selectClass = "h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25";

export function InventoryTable({
  products,
  role,
  filters,
  pagination,
  imageError,
}: {
  products: InventoryListingProduct[];
  role: UserRole;
  filters: InventoryFilters;
  pagination: InventoryPagination;
  imageError: string;
}) {
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [feedback, setFeedback] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openEditor = (product: InventoryListingProduct | "new") => {
    if (product !== "new" && product.cost_price === undefined) return;
    setEditing(product === "new" ? "new" : { ...product, cost_price: product.cost_price ?? null });
    requestAnimationFrame(() => dialogRef.current?.showModal());
  };
  const closeEditor = useCallback(() => {
    dialogRef.current?.close();
    setEditing(null);
  }, []);
  const handleSuccess = useCallback((message: string) => {
    setFeedback(message);
    dialogRef.current?.close();
    setEditing(null);
  }, []);
  const filtersActive = Boolean(filters.q || filters.status || filters.category || filters.supplier || filters.showSold);
  const firstRow = pagination.totalCount ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastRow = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <>
      {feedback ? (
        <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-4 text-primary" />{feedback}</span>
          <button type="button" onClick={() => setFeedback("")} className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Tutup notifikasi"><X aria-hidden="true" className="size-4" /></button>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card">
        {imageError ? (
          <p role="status" className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">{imageError}</p>
        ) : null}
        <div className="border-b p-4 sm:p-5">
          <form method="get" action="/inventory" className="space-y-3">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.5fr)_repeat(3,minmax(120px,1fr))_auto_auto]">
              <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
                <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={filters.q} placeholder="Cari SKU, barcode, atau nama" aria-label="Cari SKU, barcode, atau nama produk" className="h-11 w-full rounded-lg pl-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25" />
              </div>
              <Input name="category" defaultValue={filters.category} placeholder="Kategori" aria-label="Filter kategori" className={`${selectClass} w-full min-w-0`} />
              <Input name="supplier" defaultValue={filters.supplier} placeholder="Pemasok" aria-label="Filter pemasok" className={`${selectClass} w-full min-w-0`} />
              <select name="status" defaultValue={filters.status} aria-label="Filter berdasarkan status" className={`${selectClass} w-full min-w-0`}>
                <option value="">Semua status</option>
                {productStatuses.map((productStatus) => (
                  <option key={productStatus} value={productStatus}>{productStatusLabels[productStatus]}</option>
                ))}
              </select>
              <Button type="submit" className="h-11 w-full sm:w-auto"><Search aria-hidden="true" />Cari</Button>
              {role === "admin" ? (
                <Button type="button" onClick={() => openEditor("new")} className="h-11 w-full rounded-lg px-4 shadow-none sm:w-auto xl:justify-self-end">
                  <Plus aria-hidden="true" />Tambah produk
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="showSold"
                  value="1"
                  defaultChecked={filters.showSold}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                Tampilkan produk terjual
              </label>
              {filtersActive ? (
                <Button asChild variant="ghost" className="h-11 w-full text-muted-foreground sm:w-auto">
                  <Link href="/inventory"><FilterX aria-hidden="true" />Hapus filter</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {products.length ? (
          <ul className="divide-y border-t xl:hidden">
            {products.map((product) => (
              <li key={product.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <ProductPhotoLightbox
                    productId={product.id}
                    productName={product.name}
                    sku={product.sku}
                    imagePath={product.image_path}
                    thumbnailSrc={product.image_url}
                    className="size-14"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-semibold">{product.name}</p>
                        <p className="mt-1 truncate text-sm font-medium text-primary">{product.sku}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={product.status === "available" ? "border-primary/20 bg-primary/[0.07] text-primary" : "border-border bg-muted text-muted-foreground"}
                      >
                        {productStatusLabels[product.status]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold tabular-nums">{formatRupiah(product.selling_price)}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Kategori · mutu</dt>
                    <dd className="truncate">{[product.category, product.grade].filter(Boolean).join(" · ") || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Berat</dt>
                    <dd className="truncate tabular-nums">{product.weight_grams == null ? "—" : `${Number(product.weight_grams).toLocaleString("id-ID", { maximumFractionDigits: 3 })} g`}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Pemasok</dt>
                    <dd className="truncate">{product.supplier_name || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Diterima</dt>
                    <dd className="truncate">{formatReceivedAt(product.received_at)}</dd>
                  </div>
                  {role === "admin" ? (
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Modal</dt>
                      <dd className="truncate tabular-nums">{formatRupiah(product.cost_price ?? null)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  Barcode {product.barcode || product.sku}
                </p>

                <div className="flex items-center gap-2 border-t pt-3">
                  <Button asChild variant="outline" className="min-h-11 flex-1 justify-start">
                    <Link href={`/inventory/${product.id}/label`}>
                      <Printer aria-hidden="true" />Cetak label
                    </Link>
                  </Button>
                  {role === "admin" ? (
                    <>
                      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0" title="Riwayat perubahan" aria-label={`Lihat riwayat perubahan ${product.name}`}>
                        <Link href={`/inventory/${product.id}/audit`}><History aria-hidden="true" /></Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        onClick={() => openEditor(product)}
                        title="Edit produk"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Edit3 aria-hidden="true" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center border-t px-6 text-center xl:hidden">
            <p className="font-medium">Tidak ada produk yang sesuai</p>
            <p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau filter untuk melihat produk lainnya.</p>
          </div>
        )}

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1560px] border-collapse text-left text-sm">
            <caption className="sr-only">Produk inventaris batu mulia</caption>
            <thead>
              <tr className="border-b bg-muted/45 text-xs font-medium text-muted-foreground">
                <th scope="col" className="px-4 py-3">Foto</th><th scope="col" className="px-5 py-3">SKU</th><th scope="col" className="px-4 py-3">Barcode</th><th scope="col" className="px-4 py-3">Produk</th><th scope="col" className="px-4 py-3">Kategori</th><th scope="col" className="px-4 py-3">Mutu</th><th scope="col" className="px-4 py-3 text-right">Berat</th><th scope="col" className="px-4 py-3">Pemasok</th>{role === "admin" ? <th scope="col" className="px-4 py-3 text-right">Modal</th> : null}<th scope="col" className="px-4 py-3 text-right">Harga jual</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Diterima</th><th scope="col" className="sticky right-0 bg-muted px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.length ? products.map((product) => (
                <tr key={product.id} className="bg-card transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3"><ProductPhotoLightbox productId={product.id} productName={product.name} sku={product.sku} imagePath={product.image_path} thumbnailSrc={product.image_url} className="size-12" /></td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-primary">{product.sku}</td>
                  <td className="px-4 py-3"><div className="w-32"><Barcode value={product.barcode || product.sku} compact /><p className="mt-1 truncate text-[11px] text-muted-foreground">{product.barcode || product.sku}</p></div></td>
                  <td className="max-w-64 px-4 py-4 font-medium"><span className="line-clamp-2">{product.name}</span></td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{product.category || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4">{product.grade || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{product.weight_grams == null ? "—" : `${Number(product.weight_grams).toLocaleString("id-ID", { maximumFractionDigits: 3 })} g`}</td>
                  <td className="max-w-48 px-4 py-4 text-muted-foreground"><span className="line-clamp-2">{product.supplier_name || "—"}</span></td>
                  {role === "admin" ? <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-muted-foreground">{formatRupiah(product.cost_price ?? null)}</td> : null}
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums">{formatRupiah(product.selling_price)}</td>
                  <td className="px-4 py-4"><Badge variant="outline" className={product.status === "available" ? "border-primary/20 bg-primary/[0.07] text-primary" : "border-border bg-muted text-muted-foreground"}>{productStatusLabels[product.status]}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatReceivedAt(product.received_at)}</td>
                  <td className="sticky right-0 bg-card px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="size-10">
                        <Link
                          href={`/inventory/${product.id}/label`}
                          aria-label="Cetak label"
                          title="Cetak label"
                        >
                          <Printer aria-hidden="true" />
                        </Link>
                      </Button>
                      {role === "admin" ? (
                        <>
                          <Button asChild variant="ghost" size="icon" className="size-10" title="Riwayat perubahan" aria-label="Lihat riwayat perubahan"><Link href={`/inventory/${product.id}/audit`}><History aria-hidden="true" /></Link></Button>
                          <Button type="button" variant="ghost" size="icon" className="size-10" onClick={() => openEditor(product)} title="Edit produk"><Edit3 aria-hidden="true" /><span className="sr-only">Edit {product.name}</span></Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={role === "admin" ? 13 : 12} className="px-6 py-16 text-center"><p className="font-medium">Tidak ada produk yang sesuai</p><p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau filter untuk melihat produk lainnya.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:px-5">
          <p className="text-muted-foreground">Menampilkan {firstRow}–{lastRow} dari {pagination.totalCount} produk</p>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-muted-foreground">Halaman {pagination.page} dari {pagination.totalPages}</span>
            <div className="flex gap-2">
              {pagination.previousHref ? <Button asChild type="button" variant="outline" className="min-h-11"><Link href={pagination.previousHref}>Sebelumnya</Link></Button> : <Button type="button" variant="outline" disabled className="min-h-11">Sebelumnya</Button>}
              {pagination.nextHref ? <Button asChild type="button" variant="outline" className="min-h-11"><Link href={pagination.nextHref}>Berikutnya</Link></Button> : <Button type="button" variant="outline" disabled className="min-h-11">Berikutnya</Button>}
            </div>
          </div>
        </div>
      </div>

      <dialog ref={dialogRef} onClose={() => setEditing(null)} className="m-auto max-h-[calc(100svh-2rem)] w-[min(720px,calc(100%-2rem))] overflow-y-auto rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50">
        {editing ? (
          <div>
            <div className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6">
              <div><h2 className="text-xl font-semibold tracking-[-0.025em]">{editing === "new" ? "Tambah produk batu mulia" : "Edit produk"}</h2><p className="mt-1 text-sm text-muted-foreground">{editing === "new" ? "SKU dan barcode Code 128 akan dibuat secara otomatis." : `${editing.sku} · Perbarui data induk produk atau tandai sebagai tidak aktif.`}</p></div>
              <button type="button" onClick={closeEditor} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Tutup editor produk"><X aria-hidden="true" className="size-5" /></button>
            </div>
            <div className="p-5 sm:p-6"><ProductForm key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} onCancel={closeEditor} onSuccess={handleSuccess} /></div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
