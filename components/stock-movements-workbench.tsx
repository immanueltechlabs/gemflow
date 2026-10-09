"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, CircleAlert, FilterX, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  movementTypeLabel,
  referenceTypeLabel,
  stockMovementTypes,
  type StockMovement,
  type StockMovementFilters,
  type StockMovementPagination,
  type StockMovementStaffOption,
} from "@/lib/stock-movements";

const inputClass = "h-11 rounded-lg shadow-none focus-visible:ring-2 focus-visible:ring-primary/25";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function MovementType({ value }: { value: string }) {
  const emphasis = value === "stock_in" || value === "return_in"
    ? "border-primary/20 bg-primary/[0.07] text-primary"
    : "border-border bg-muted/70 text-foreground";
  return (
    <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-md border px-2.5 text-xs font-medium ${emphasis}`}>
      {movementTypeLabel(value)}
    </span>
  );
}

function ProductIdentity({ movement }: { movement: StockMovement }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{movement.productName || "Nama produk tidak tersedia"}</p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        SKU {movement.sku || "—"}{movement.barcode ? ` · Barcode ${movement.barcode}` : ""}
      </p>
    </div>
  );
}

function ReferenceIdentity({ movement }: { movement: StockMovement }) {
  return (
    <div className="min-w-0">
      <p className="text-sm">{referenceTypeLabel(movement.referenceType)}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{movement.referenceId || "—"}</p>
    </div>
  );
}

function MovementRows({ movements }: { movements: StockMovement[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-muted/55 text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3.5 font-medium">Tanggal/waktu</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Produk</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Jenis pergerakan</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Referensi</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Catatan</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Staf</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movements.map((movement) => (
              <tr key={movement.id} className="align-top hover:bg-muted/20">
                <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums text-muted-foreground">{formatDateTime(movement.createdAt)}</td>
                <td className="max-w-64 px-4 py-4"><ProductIdentity movement={movement} /></td>
                <td className="px-4 py-4"><MovementType value={movement.movementType} /></td>
                <td className="max-w-52 px-4 py-4"><ReferenceIdentity movement={movement} /></td>
                <td className="max-w-64 px-4 py-4 text-sm text-muted-foreground">{movement.notes || "—"}</td>
                <td className="max-w-48 px-4 py-4 text-sm">{movement.staffName ?? "Nama staf tidak tersedia"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y xl:hidden">
        {movements.map((movement) => (
          <li key={movement.id} className="space-y-3 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <time className="text-xs tabular-nums text-muted-foreground" dateTime={movement.createdAt}>{formatDateTime(movement.createdAt)}</time>
              <MovementType value={movement.movementType} />
            </div>
            <ProductIdentity movement={movement} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 text-sm">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Jenis referensi</dt><dd className="mt-1 truncate">{referenceTypeLabel(movement.referenceType)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">ID referensi</dt><dd className="mt-1 break-all font-mono text-xs">{movement.referenceId || "—"}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Staf</dt><dd className="mt-1 truncate">{movement.staffName ?? "Nama staf tidak tersedia"}</dd></div>
              <div className="col-span-2 min-w-0"><dt className="text-xs text-muted-foreground">Catatan</dt><dd className="mt-1 break-words">{movement.notes || "—"}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StockMovementsWorkbench({
  movements,
  filters,
  pagination,
  staffOptions,
  relationWarning,
  filterError,
}: {
  movements: StockMovement[];
  filters: StockMovementFilters;
  pagination: StockMovementPagination;
  staffOptions: StockMovementStaffOption[];
  relationWarning: string;
  filterError: string;
}) {
  const filtersActive = Boolean(filters.dateFrom || filters.dateTo || filters.movementType || filters.productQuery || filters.performedBy);
  const firstRow = pagination.totalCount ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastRow = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <>
      {relationWarning ? (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4 text-sm">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="leading-6 text-muted-foreground">{relationWarning}</p>
        </div>
      ) : null}

      {filterError ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4 text-sm">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="leading-6 text-muted-foreground">{filterError}</p>
        </div>
      ) : null}

      <section aria-label="Filter riwayat pergerakan stok" className="mb-5 border-y bg-card py-4 sm:rounded-lg sm:border sm:px-5">
        <form method="get" action="/stock-movements" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.4fr)_repeat(2,minmax(130px,0.8fr))_minmax(160px,1fr)_minmax(170px,1fr)_auto]">
          <div className="space-y-2">
            <label htmlFor="movement-search" className="text-sm font-medium">SKU, barcode, atau nama produk</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="movement-search" name="productQuery" defaultValue={filters.productQuery} placeholder="Cari produk" className={`${inputClass} pl-9`} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="movement-date-from" className="text-sm font-medium">Dari tanggal</label>
            <Input id="movement-date-from" name="dateFrom" type="date" defaultValue={filters.dateFrom} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="movement-date-to" className="text-sm font-medium">Sampai tanggal</label>
            <Input id="movement-date-to" name="dateTo" type="date" defaultValue={filters.dateTo} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="movement-type" className="text-sm font-medium">Jenis pergerakan</label>
            <select id="movement-type" name="movementType" defaultValue={filters.movementType} className={`${inputClass} w-full border border-input bg-background px-3 text-sm focus-visible:outline-none`}>
              <option value="">Semua jenis</option>
              {stockMovementTypes.map((value) => <option key={value} value={value}>{movementTypeLabel(value)}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="movement-staff" className="text-sm font-medium">Staf</label>
            <select id="movement-staff" name="performedBy" defaultValue={filters.performedBy} className={`${inputClass} w-full border border-input bg-background px-3 text-sm focus-visible:outline-none`}>
              <option value="">Semua staf</option>
              {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="flex w-full gap-2">
              <Button type="submit" className="h-11 flex-1"><Search aria-hidden="true" />Terapkan</Button>
              {filtersActive ? <Button asChild variant="ghost" className="h-11 flex-1"><Link href="/stock-movements"><FilterX aria-hidden="true" />Hapus filter</Link></Button> : null}
            </div>
          </div>
        </form>
      </section>

      <section aria-labelledby="movement-list-heading" className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col justify-between gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 id="movement-list-heading" className="font-semibold">Riwayat pergerakan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Menampilkan {firstRow}–{lastRow} dari {pagination.totalCount} catatan</p>
          </div>
          {pagination.totalCount ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeftRight aria-hidden="true" className="size-4" />Urutan terbaru</p> : null}
        </div>

        {movements.length ? (
          <MovementRows movements={movements} />
        ) : (
          <div className="flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center">
            <ArrowDownLeft aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">{filtersActive ? "Tidak ada pergerakan yang cocok" : "Belum ada pergerakan stok"}</p>
            <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
              {filtersActive ? "Ubah filter atau rentang tanggal untuk melihat catatan lainnya." : "Pergerakan akan tercatat saat stok masuk, penjualan, atau retur menambah stok."}
            </p>
            {filtersActive ? <Button asChild variant="outline" className="mt-4 h-10"><Link href="/stock-movements">Hapus filter</Link></Button> : null}
          </div>
        )}
        <div className="flex flex-col justify-between gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:px-5">
          <span className="text-muted-foreground">Halaman {pagination.page} dari {pagination.totalPages}</span>
          <div className="flex gap-2">
            {pagination.previousHref ? <Button asChild type="button" variant="outline" className="h-10"><Link href={pagination.previousHref}>Sebelumnya</Link></Button> : <Button type="button" variant="outline" disabled className="h-10">Sebelumnya</Button>}
            {pagination.nextHref ? <Button asChild type="button" variant="outline" className="h-10"><Link href={pagination.nextHref}>Berikutnya</Link></Button> : <Button type="button" variant="outline" disabled className="h-10">Berikutnya</Button>}
          </div>
        </div>
      </section>
    </>
  );
}
