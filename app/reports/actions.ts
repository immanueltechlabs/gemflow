"use server";

import { getCurrentProfile } from "@/lib/auth";
import type { FinancialReport, FinancialReportResult } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

type ReportError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function logReportError(error: ReportError) {
  if (process.env.NODE_ENV !== "development") return;

  console.error(`[GemFlow Laporan] rpc(get_financial_report) ${JSON.stringify({
    code: error.code ?? "unknown",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeReport(value: unknown): FinancialReport | null {
  let result = Array.isArray(value) ? value[0] : value;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return null;
    }
  }
  if (!result || typeof result !== "object") return null;

  const outer = result as Record<string, unknown>;
  const nested = outer.get_financial_report;
  const record = nested && typeof nested === "object"
    ? nested as Record<string, unknown>
    : outer;
  const number = (key: string) => {
    const value = record[key];
    if (typeof value !== "number" && typeof value !== "string") return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };
  const startDate = record.start_date;
  const endDate = record.end_date;
  const report: FinancialReport = {
    gross_sales: number("gross_sales"),
    total_returns: number("total_returns"),
    net_sales: number("net_sales"),
    cogs: number("cogs"),
    gross_profit: number("gross_profit"),
    expenses: number("expenses"),
    net_profit: number("net_profit"),
    transaction_count: number("transaction_count"),
    items_sold: number("items_sold"),
    return_count: number("return_count"),
    start_date: typeof startDate === "string" ? startDate : "",
    end_date: typeof endDate === "string" ? endDate : "",
  };

  return Object.values(report).every((entry) => typeof entry === "string" || Number.isFinite(entry))
    ? report
    : null;
}

export async function getFinancialReport(
  startDate: string,
  endDate: string,
): Promise<FinancialReportResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    return { report: null, error: "Laporan hanya dapat diakses oleh Admin." };
  }
  if (!parseDate(startDate) || !parseDate(endDate) || startDate > endDate) {
    return { report: null, error: "Pilih rentang tanggal laporan yang valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_financial_report", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    logReportError(error);
    return { report: null, error: "Laporan tidak dapat dimuat. Coba lagi atau hubungi administrator." };
  }

  const report = normalizeReport(data);
  if (!report) {
    if (process.env.NODE_ENV === "development") {
      console.error("[GemFlow Laporan] RPC returned an unexpected financial report shape.");
    }
    return { report: null, error: "Format laporan tidak dapat dibaca. Hubungi administrator." };
  }

  return { report };
}