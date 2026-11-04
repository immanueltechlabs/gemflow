"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  ScanBarcode,
  Search,
} from "lucide-react";

import { cancelStockOpname, completeStockOpname, scanStockOpname } from "@/app/stock-opname/actions";
import { ProductPhoto } from "@/components/product-photo";
import { ProductPhotoLightbox } from "@/components/product-photo-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatOpnameDate,
  opnameStatusLabel,
  stockOpnameSectionLabels,
  stockOpnameSections,
  type StockOpnameItem,
  type StockOpnamePageMeta,
  type StockOpnameScan,
  type StockOpnameSection,
  type StockOpnameSession,
} from "@/lib/stock-opname";

type OpnameRecord = StockOpnameItem | StockOpnameScan;
type Summary = Pick<
  StockOpnameSession,
  "expected_count" | "matched_count" | "missing_count" | "unexpected_count" | "duplicate_count" | "unknown_count"
>;

function isSnapshotItem(record: OpnameRecord): record is StockOpnameItem {
  return "scanned" in record;
}

function scanStatus(result: StockOpnameScan["result"]) {
  if (result === "matched") return { label: "Sesuai", color: "border-primary/25 bg-primary/10 text-primary" };
  if (result === "duplicate") return { label: "Duplikat", color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  if (result === "unexpected") return { label: "Tidak diharapkan", color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: "Tidak dikenal", color: "border-destructive/25 bg-destructive/10 text-destructive" };
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const toneClass = tone === "warning"
    ? "text-amber-700 dark:text-amber-300"
    : tone === "danger"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

function ProductScanPhoto({
  id,
  name,
  sku,
  imagePath,
  imageUrl,
}: {
  id: string | null;
  name: string | null;
  sku: string | null;
  imagePath: string | null;
  imageUrl: string | null | undefined;
}) {
  const productName = name || "Produk tidak diketahui";
  if (!id || !imagePath || !imageUrl) {
    return <ProductPhoto src={null} alt={`Foto ${productName}`} className="size-14" />;
  }
  return (
    <ProductPhotoLightbox
      productId={id}
      productName={productName}
      sku={sku}
      imagePath={imagePath}
      thumbnailSrc={imageUrl}
      className="size-14"
    />
  );
}

function ScanCard({ scan }: { scan: StockOpnameScan }) {
  const status = scanStatus(scan.result);
  return (
    <li className={`rounded-xl border p-3 sm:p-4 ${
      scan.result === "matched"
        ? "border-primary/20 bg-primary/[0.035]"
        : scan.result === "unknown"
          ? "border-destructive/20 bg-destructive/[0.035]"
          : "border-amber-500/20 bg-amber-500/[0.035]"
    }`}>
      <div className="flex min-w-0 items-start gap-3">
        <ProductScanPhoto
          id={scan.product_id}
          name={scan.product_name}
          sku={scan.sku}
          imagePath={scan.image_path}
          imageUrl={scan.image_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-semibold">{scan.product_name || "Barcode tidak dikenal"}</p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            {scan.sku ? <span>SKU {scan.sku}</span> : null}
            <span>Barcode {scan.barcode || scan.scanned_code}</span>
          </div>
          <time className="mt-2 block text-xs text-muted-foreground" dateTime={scan.scanned_at}>
            {formatOpnameDate(scan.scanned_at)}
          </time>
        </div>
      </div>
    </li>
  );
}

function ResultCard({ record }: { record: OpnameRecord }) {
  if (isSnapshotItem(record)) {
    return (
      <li className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <ProductScanPhoto
          id={record.product_id}
          name={record.product_name}
          sku={record.sku}
          imagePath={record.image_path}
          imageUrl={record.image_url}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{record.product_name}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span>SKU {record.sku}</span>
            <span>Barcode {record.barcode || "—"}</span>
          </p>
          {record.scanned ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dipindai {formatOpnameDate(record.scanned_at)} · jumlah scan {record.scan_count}
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">Belum ditemukan saat opname</p>
          )}
        </div>
        {record.scanned ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-label="Sesuai">
            <Check aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </li>
    );
  }
  return <ScanCard scan={record} />;
}

export function StockOpnameWorkbench({
  session,
  section,
  records,
  pagination,
  imageError,
  dataError,
  canModify,
  canCancel,
}: {
  session: StockOpnameSession;
  section: StockOpnameSection;
  records: OpnameRecord[];
  pagination: StockOpnamePageMeta;
  imageError: string;
  dataError: string;
  canModify: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [scans, setScans] = useState<StockOpnameScan[]>(
    session.status === "in_progress" ? records.filter((record): record is StockOpnameScan => !isSnapshotItem(record)) : [],
  );
  const [summary, setSummary] = useState<Summary>({
    expected_count: session.expected_count,
    matched_count: session.matched_count,
    missing_count: session.status === "completed"
      ? session.missing_count
      : Math.max(session.expected_count - session.matched_count, 0),
    unexpected_count: session.unexpected_count,
    duplicate_count: session.duplicate_count,
    unknown_count: session.unknown_count,
  });
  const [feedback, setFeedback] = useState<StockOpnameScan | null>(null);
  const [scanError, setScanError] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isScanning, startScan] = useTransition();
  const [isCompleting, startComplete] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const inProgress = session.status === "in_progress";
  const resultRecords = inProgress ? [] : records;

  useEffect(() => {
    setSummary({
      expected_count: session.expected_count,
      matched_count: session.matched_count,
      missing_count: inProgress
        ? Math.max(session.expected_count - session.matched_count, 0)
        : session.missing_count,
      unexpected_count: session.unexpected_count,
      duplicate_count: session.duplicate_count,
      unknown_count: session.unknown_count,
    });
    if (inProgress) {
      setScans(records.filter((record): record is StockOpnameScan => !isSnapshotItem(record)));
    }
  }, [
    inProgress,
    records,
    session.expected_count,
    session.matched_count,
    session.missing_count,
    session.unexpected_count,
    session.duplicate_count,
    session.unknown_count,
  ]);

  const handleScan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inProgress || isScanning) return;
    const scannedCode = identifier.trim().slice(0, 100);
    if (!scannedCode) return;

    setScanError("");
    startScan(async () => {
      const response = await scanStockOpname(session.id, scannedCode);
      if (response.error || !response.data) {
        setScanError(response.error ?? "Pemindaian gagal dicatat. Coba lagi.");
        inputRef.current?.focus();
        return;
      }

      const scan = response.data;
      setIdentifier("");
      setFeedback(scan);
      setScans((current) => [scan, ...current].slice(0, 30));
      setSummary((current) => {
        if (scan.result === "matched") {
          const matched = current.matched_count + 1;
          return {
            ...current,
            matched_count: matched,
            missing_count: Math.max(current.expected_count - matched, 0),
          };
        }
        if (scan.result === "duplicate") return { ...current, duplicate_count: current.duplicate_count + 1 };
        if (scan.result === "unexpected") return { ...current, unexpected_count: current.unexpected_count + 1 };
        return { ...current, unknown_count: current.unknown_count + 1 };
      });
      router.refresh();
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  const handleComplete = () => {
    if (!window.confirm("Selesaikan Stock Opname ini? Stok produk tidak akan diubah.")) return;
    setCompleteError("");
    startComplete(async () => {
      const response = await completeStockOpname(session.id);
      if (response.error) {
        setCompleteError(response.error);
        return;
      }
      router.refresh();
    });
  };

  const handleCancel = () => {
    if (!window.confirm("Batalkan Stock Opname ini? Stok produk tidak akan diubah dan seluruh riwayat pindai akan tetap tersimpan.")) return;
    setCancelError("");
    startCancel(async () => {
      const response = await cancelStockOpname(session.id);
      if (response.error) {
        setCancelError(response.error);
        return;
      }
      router.push("/stock-opname");
    });
  };

  const headingStatus = inProgress ? "Sesi berlangsung" : opnameStatusLabel(session.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/stock-opname" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft aria-hidden="true" className="size-4" />Riwayat Stock Opname
          </Link>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
            <ScanBarcode aria-hidden="true" className="size-4" />{headingStatus}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
            Stock Opname · {formatOpnameDate(session.started_at)}
          </h1>
          {session.notes ? <p className="mt-2 text-sm text-muted-foreground">{session.notes}</p> : null}
        </div>
        {!inProgress ? (
          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Hasil hanya untuk pemeriksaan. Tidak ada penyesuaian stok otomatis.
          </p>
        ) : null}
      </div>

      {imageError ? (
        <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{imageError}</p>
      ) : null}
      {dataError ? (
        <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{dataError}</p>
      ) : null}

      <section aria-label="Ringkasan Stock Opname" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Diharapkan" value={summary.expected_count} />
        <SummaryCard label="Sesuai" value={summary.matched_count} />
        <SummaryCard label="Belum ditemukan" value={summary.missing_count} tone="warning" />
        <SummaryCard label="Duplikat" value={summary.duplicate_count} tone="warning" />
        <SummaryCard label="Tidak diharapkan" value={summary.unexpected_count} tone="warning" />
        <SummaryCard label="Tak dikenal" value={summary.unknown_count} tone={summary.unknown_count ? "danger" : "default"} />
      </section>

      {inProgress && canModify ? (
        <section aria-labelledby="opname-scanner-heading" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Barcode aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="opname-scanner-heading" className="font-semibold">Pindai barcode produk</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Arahkan scanner ke barcode; pemindaian akan dicatat saat scanner mengirim Enter.
              </p>
            </div>
          </div>
          <form onSubmit={handleScan} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              ref={inputRef}
              autoFocus
              autoComplete="off"
              value={identifier}
              maxLength={100}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={isScanning}
              placeholder="Pindai barcode atau masukkan SKU"
              aria-label="Pindai barcode atau masukkan SKU produk"
              className="h-14 min-w-0 rounded-xl text-lg sm:flex-1"
            />
            <Button type="submit" disabled={isScanning || !identifier.trim()} className="h-14 w-full rounded-xl px-6 sm:w-auto">
              {isScanning ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
              Catat pindai
            </Button>
          </form>
          {scanError ? (
            <p role="alert" className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{scanError}</p>
          ) : null}
          {feedback ? (
            <div
              role="status"
              aria-live="assertive"
              className={`mt-4 flex min-h-20 items-center gap-3 rounded-xl border p-4 ${
                feedback.result === "matched"
                  ? "border-primary/25 bg-primary/10"
                  : feedback.result === "unknown"
                    ? "border-destructive/25 bg-destructive/10"
                    : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              {feedback.result === "matched"
                ? <CircleCheck aria-hidden="true" className="size-7 shrink-0 text-primary" />
                : feedback.result === "unknown"
                  ? <CircleAlert aria-hidden="true" className="size-7 shrink-0 text-destructive" />
                  : <CircleAlert aria-hidden="true" className="size-7 shrink-0 text-amber-700 dark:text-amber-300" />}
              <div className="min-w-0">
                <p className="font-semibold">{scanStatus(feedback.result).label}</p>
                <p className="mt-0.5 truncate text-sm">{feedback.product_name || feedback.scanned_code}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{feedback.sku ? `SKU ${feedback.sku} · ` : ""}Barcode {feedback.barcode || feedback.scanned_code}</p>
              </div>
            </div>
          ) : null}
          {completeError ? <p role="alert" className="mt-3 text-sm text-destructive">{completeError}</p> : null}
          <div className="mt-5 flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Sisa {Math.max(summary.expected_count - summary.matched_count, 0)} dari {summary.expected_count} barang yang diharapkan.
            </p>
            <Button type="button" onClick={handleComplete} disabled={isCompleting} variant="default" className="h-11 w-full sm:w-auto">
              {isCompleting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              Selesaikan Stock Opname
            </Button>
          </div>
        </section>
      ) : null}

      {inProgress && canCancel ? (
        <section aria-labelledby="cancel-opname-heading" className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 id="cancel-opname-heading" className="font-medium">Batalkan sesi aktif</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Pembatalan tidak mengubah stok. Snapshot dan seluruh riwayat pindai akan tetap tersimpan.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
              className="mt-3 min-h-11 w-full shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:mt-0 sm:w-auto"
            >
              {isCancelling ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              Batalkan Stock Opname
            </Button>
          </div>
          {cancelError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">{cancelError}</p>
          ) : null}
        </section>
      ) : null}

      {inProgress && !canModify ? (
        <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Sesi ini dibuat oleh staf lain. Anda dapat melihat progres, tetapi hanya pembuat sesi yang dapat memindai atau menyelesaikannya.
        </p>
      ) : null}

      {inProgress ? (
        <section aria-labelledby="recent-scans-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="recent-scans-heading" className="text-lg font-semibold">Pindai terbaru</h2>
              <p className="mt-1 text-sm text-muted-foreground">Maksimal 30 hasil terakhir ditampilkan.</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{scans.length} hasil</span>
          </div>
          {scans.length ? (
            <ul className="space-y-2">
              {scans.map((scan) => <ScanCard key={scan.id} scan={scan} />)}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed bg-card px-5 py-9 text-center">
              <ScanBarcode aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada barcode dipindai</p>
              <p className="mt-1 text-sm text-muted-foreground">Scanner siap menerima barcode atau SKU.</p>
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="opname-results-heading">
          <div className="mb-4">
            <h2 id="opname-results-heading" className="text-lg font-semibold">Hasil Stock Opname</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hasil snapshot sesi, tanpa perubahan status produk maupun stok.</p>
          </div>
          <nav aria-label="Kategori hasil Stock Opname" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
            {stockOpnameSections.map((resultSection) => {
              const count = resultSection === "matched"
                ? session.matched_count
                : resultSection === "missing"
                  ? session.missing_count
                  : resultSection === "unexpected"
                    ? session.unexpected_count
                    : resultSection === "duplicate"
                      ? session.duplicate_count
                      : session.unknown_count;
              const active = section === resultSection;
              return (
                <Link
                  key={resultSection}
                  href={`/stock-opname/${session.id}?section=${resultSection}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {stockOpnameSectionLabels[resultSection]}
                  <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs tabular-nums">{count}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{stockOpnameSectionLabels[section]}</h3>
            {pagination.totalPages > 1 ? (
              <span className="text-xs tabular-nums text-muted-foreground">Halaman {pagination.page} dari {pagination.totalPages}</span>
            ) : null}
          </div>
          {resultRecords.length ? (
            <ul className="space-y-2">
              {resultRecords.map((record) => <ResultCard key={record.id} record={record} />)}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed bg-card px-5 py-9 text-center">
              <p className="font-medium">Tidak ada hasil pada kategori ini</p>
            </div>
          )}
          {pagination.totalPages > 1 ? (
            <nav aria-label="Halaman hasil Stock Opname" className="mt-4 flex items-center justify-between gap-3">
              {pagination.previousHref ? (
                <Button asChild variant="outline" className="min-h-11"><Link href={pagination.previousHref}><ArrowLeft aria-hidden="true" />Sebelumnya</Link></Button>
              ) : <span />}
              {pagination.nextHref ? (
                <Button asChild variant="outline" className="min-h-11"><Link href={pagination.nextHref}>Berikutnya<ArrowRight aria-hidden="true" /></Link></Button>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
