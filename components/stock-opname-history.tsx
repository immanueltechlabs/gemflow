"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, ScanBarcode } from "lucide-react";

import { startStockOpname } from "@/app/stock-opname/actions";
import { Button } from "@/components/ui/button";
import {
  formatOpnameDate,
  opnameStatusLabel,
  type StockOpnamePageMeta,
  type StockOpnameSession,
} from "@/lib/stock-opname";

export function StockOpnameHistory({
  sessions,
  staffById,
  pagination,
}: {
  sessions: StockOpnameSession[];
  staffById: Record<string, string>;
  pagination: Pick<StockOpnamePageMeta, "page" | "totalPages" | "previousHref" | "nextHref">;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const beginOpname = () => {
    setError("");
    startTransition(async () => {
      const result = await startStockOpname(notes);
      if (result.error || !result.data) {
        setError(result.error ?? "Stock Opname gagal dimulai.");
        return;
      }
      router.push(`/stock-opname/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="start-opname-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScanBarcode aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="start-opname-heading" className="font-semibold">Mulai sesi baru</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Produk berstatus tersedia akan disimpan sebagai snapshot. Produk yang berubah setelah sesi dimulai tidak mengubah daftar yang diharapkan.
            </p>
            <label htmlFor="opname-notes" className="mt-4 block text-sm font-medium">Catatan (opsional)</label>
            <textarea
              id="opname-notes"
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contoh: Opname lemari display"
              className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
            {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
            <Button type="button" onClick={beginOpname} disabled={isPending} className="mt-4 min-h-11 w-full sm:w-auto">
              {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ScanBarcode aria-hidden="true" />}
              Mulai Stock Opname
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="opname-history-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="opname-history-heading" className="text-lg font-semibold">Riwayat Stock Opname</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sesi aktif dan hasil opname sebelumnya.</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
        </div>

        {sessions.length ? (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/stock-opname/${session.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{formatOpnameDate(session.started_at)}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          session.status === "completed"
                            ? "bg-primary/10 text-primary"
                            : session.status === "cancelled"
                              ? "border border-border bg-muted/80 text-muted-foreground"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}>
                          {opnameStatusLabel(session.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Dimulai oleh {staffById[session.started_by] ?? "Staf GemFlow"}
                      </p>
                      {session.completed_by ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.status === "cancelled" ? "Dibatalkan oleh" : "Diselesaikan oleh"}{" "}
                          {staffById[session.completed_by] ?? "Staf GemFlow"}
                        </p>
                      ) : null}
                      {session.notes ? <p className="mt-2 line-clamp-2 text-sm">{session.notes}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:min-w-72">
                      <span className="text-muted-foreground">Diharapkan</span><span className="text-right font-medium tabular-nums">{session.expected_count}</span>
                      <span className="text-muted-foreground">Sesuai</span><span className="text-right font-medium tabular-nums">{session.matched_count}</span>
                      <span className="text-muted-foreground">Belum ditemukan</span><span className="text-right font-medium tabular-nums">{session.status === "completed" ? session.missing_count : Math.max(session.expected_count - session.matched_count, 0)}</span>
                      <span className="text-muted-foreground">Tidak diharapkan</span><span className="text-right font-medium tabular-nums">{session.unexpected_count}</span>
                      {session.status === "completed" ? (
                        <>
                          <span className="text-muted-foreground">Duplikat / tak dikenal</span>
                          <span className="text-right font-medium tabular-nums">{session.duplicate_count} / {session.unknown_count}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed bg-card px-5 py-10 text-center">
            <ScanBarcode aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Belum ada sesi Stock Opname</p>
            <p className="mt-1 text-sm text-muted-foreground">Mulai sesi untuk membuat snapshot stok yang akan dihitung.</p>
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <nav aria-label="Halaman riwayat Stock Opname" className="mt-4 flex items-center justify-between">
            {pagination.previousHref ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={pagination.previousHref}><ArrowLeft aria-hidden="true" />Sebelumnya</Link>
              </Button>
            ) : <span />}
            {pagination.nextHref ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={pagination.nextHref}>Berikutnya<ArrowRight aria-hidden="true" /></Link>
              </Button>
            ) : <span />}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
