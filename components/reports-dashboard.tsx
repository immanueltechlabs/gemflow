"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CalendarDays, ChartNoAxesCombined, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";

import { getFinancialReport } from "@/app/reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/inventory";
import { firstOfMonth, getJakartaDate, shiftDate } from "@/lib/report-dates";
import type { FinancialReport, FinancialReportResult } from "@/lib/reports";

type PeriodPreset = "today" | "last7" | "month" | "custom";

const periodLabels: Record<PeriodPreset, string> = {
  today: "Hari ini",
  last7: "7 hari terakhir",
  month: "Bulan ini",
  custom: "Rentang khusus",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function PeriodButton({
  preset,
  active,
  onClick,
}: {
  preset: PeriodPreset;
  active: boolean;
  onClick: (preset: PeriodPreset) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(preset)}
      aria-pressed={active}
      className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {periodLabels[preset]}
    </button>
  );
}

function MoneyCard({
  title,
  value,
  emphasis = "normal",
}: {
  title: string;
  value: number;
  emphasis?: "normal" | "positive" | "negative";
}) {
  const isLoss = title === "Laba Bersih" && value < 0;
  return (
    <article className={`rounded-lg border bg-card p-4 sm:p-5 ${isLoss ? "border-destructive/30 bg-destructive/[0.035]" : ""}`}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className={`mt-3 text-xl font-semibold tabular-nums sm:text-2xl ${isLoss || emphasis === "negative" ? "text-destructive" : emphasis === "positive" ? "text-primary" : "text-foreground"}`}>
        {formatRupiah(value)}
      </p>
      {isLoss ? <p className="mt-1 text-xs font-medium text-destructive">Rugi bersih pada periode ini</p> : null}
    </article>
  );
}

function SummaryCards({ report }: { report: FinancialReport }) {
  const metrics = [
    { title: "Omzet Kotor", value: report.gross_sales },
    { title: "Retur", value: report.total_returns },
    { title: "Omzet Bersih", value: report.net_sales, emphasis: "positive" as const },
    { title: "HPP", value: report.cogs },
    { title: "Laba Kotor", value: report.gross_profit, emphasis: report.gross_profit < 0 ? "negative" as const : "normal" as const },
    { title: "Pengeluaran", value: report.expenses },
    { title: "Laba Bersih", value: report.net_profit, emphasis: report.net_profit < 0 ? "negative" as const : "positive" as const },
  ];

  return (
    <section aria-labelledby="financial-summary-heading" className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <ChartNoAxesCombined aria-hidden="true" className="size-4 text-primary" />
        <h2 id="financial-summary-heading" className="font-semibold">Ringkasan keuangan</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MoneyCard key={metric.title} {...metric} />)}
      </div>
    </section>
  );
}

function OperationalSummary({ report }: { report: FinancialReport }) {
  const metrics = [
    { title: "Jumlah transaksi", value: report.transaction_count },
    { title: "Barang terjual", value: report.items_sold },
    { title: "Jumlah retur", value: report.return_count },
  ];

  return (
    <section aria-labelledby="operational-summary-heading" className="mt-7">
      <h2 id="operational-summary-heading" className="mb-3 font-semibold">Ringkasan operasional</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ title, value }) => (
          <article key={title} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-4 sm:px-5">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <p className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat("id-ID").format(value)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReportsDashboard({
  initialStartDate,
  initialEndDate,
  initialResult,
}: {
  initialStartDate: string;
  initialEndDate: string;
  initialResult: FinancialReportResult;
}) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [report, setReport] = useState(initialResult.report);
  const [error, setError] = useState(initialResult.error ?? "");
  const [pending, startTransition] = useTransition();

  const requestReport = (start: string, end: string) => {
    setError("");
    startTransition(async () => {
      const result = await getFinancialReport(start, end);
      setReport(result.report);
      setError(result.error ?? "");
    });
  };

  const choosePreset = (selected: PeriodPreset) => {
    setPreset(selected);
    if (selected === "custom") return;

    const today = getJakartaDate();
    const range = selected === "today"
      ? [today, today]
      : selected === "last7"
        ? [shiftDate(today, -6), today]
        : [firstOfMonth(today), today];
    setStartDate(range[0]);
    setEndDate(range[1]);
    requestReport(range[0], range[1]);
  };

  const applyCustomRange = () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError("Pilih rentang tanggal yang valid. Tanggal awal tidak boleh melewati tanggal akhir.");
      setReport(null);
      return;
    }
    requestReport(startDate, endDate);
  };

  return (
    <div>
      <section aria-label="Filter periode laporan" className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="font-semibold">Periode laporan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {report ? `${formatDate(report.start_date)} – ${formatDate(report.end_date)}` : "Pilih periode untuk melihat ringkasan."}
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/45 p-1" role="group" aria-label="Pilihan periode">
            {(["today", "last7", "month", "custom"] as const).map((value) => (
              <PeriodButton key={value} preset={value} active={preset === value} onClick={choosePreset} />
            ))}
          </div>
        </div>

        {preset === "custom" ? (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label htmlFor="report-start-date" className="text-sm font-medium">Tanggal awal</label>
              <Input id="report-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full sm:w-48" />
            </div>
            <div className="space-y-2">
              <label htmlFor="report-end-date" className="text-sm font-medium">Tanggal akhir</label>
              <Input id="report-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full sm:w-48" />
            </div>
            <Button type="button" disabled={pending} onClick={applyCustomRange} className="h-11 sm:min-w-36">
              {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Memuat</> : <><CalendarDays aria-hidden="true" />Terapkan</>}
            </Button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div role="alert" className="mt-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{error}</span>
        </div>
      ) : null}

      {pending ? (
        <div role="status" className="mt-8 flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />Memuat laporan
        </div>
      ) : report ? (
        <>
          <SummaryCards report={report} />
          <OperationalSummary report={report} />

          {report.net_profit < 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.045] p-4 text-sm">
              <TrendingDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="font-medium text-destructive">Pengeluaran pada periode ini melebihi laba kotor. Periode ini mencatat rugi bersih sebesar {formatRupiah(report.net_profit)}.</p>
            </div>
          ) : null}

          <section aria-labelledby="report-formulas-heading" className="mt-7 border-t pt-5">
            <div className="mb-3 flex items-center gap-2">
              {report.net_profit < 0 ? <TrendingDown aria-hidden="true" className="size-4 text-destructive" /> : <TrendingUp aria-hidden="true" className="size-4 text-primary" />}
              <h2 id="report-formulas-heading" className="font-semibold">Cara membaca laporan</h2>
            </div>
            <div className="grid gap-x-8 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
              <p><span className="font-medium text-foreground">Omzet Bersih</span> = Penjualan - Retur</p>
              <p><span className="font-medium text-foreground">Laba Kotor</span> = Omzet Bersih - HPP</p>
              <p><span className="font-medium text-foreground">Laba Bersih</span> = Laba Kotor - Pengeluaran</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}