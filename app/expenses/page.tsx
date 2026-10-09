import type { Metadata } from "next";
import { CircleAlert, ReceiptText } from "lucide-react";

import { ExpensesWorkbench } from "@/components/expenses-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import type { Expense, ExpenseFilters, ExpensePagination } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pengeluaran | GemFlow" };
export const instant = false;

const pageSize = 50;

type ExpenseSearchParams = {
  dateFrom?: string | string[];
  dateTo?: string | string[];
  category?: string | string[];
  query?: string | string[];
  page?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function descriptionPattern(value: string) {
  return value ? `%${value.replace(/[\\%_]/g, "\\$&")}%` : null;
}

function buildPageHref(filters: ExpenseFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.category) params.set("category", filters.category);
  if (filters.query) params.set("query", filters.query);
  params.set("page", String(page));
  return `/expenses?${params.toString()}`;
}

function logReadError(error: { code?: string; message: string; details?: string | null; hint?: string | null }) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[GemFlow Pengeluaran] expenses.select ${JSON.stringify({
    code: error.code ?? "unknown",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseSearchParams>;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;
  const filters: ExpenseFilters = {
    dateFrom: firstParam(params.dateFrom).trim(),
    dateTo: firstParam(params.dateTo).trim(),
    category: firstParam(params.category).trim().slice(0, 80),
    query: firstParam(params.query).trim().slice(0, 240),
  };
  const requestedPage = Number(firstParam(params.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  let filterError = "";
  if ((filters.dateFrom && !isValidDate(filters.dateFrom)) || (filters.dateTo && !isValidDate(filters.dateTo))) {
    filterError = "Pilih rentang tanggal yang valid.";
  } else if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    filterError = "Tanggal awal tidak boleh melewati tanggal akhir.";
  }
  if (filterError) page = 1;

  const supabase = await createClient();
  const pattern = descriptionPattern(filters.query);
  const loadExpenses = (targetPage: number) => {
    let query = supabase
      .from("expenses")
      .select("id, expense_date, category, description, amount, notes, created_by", { count: "exact" });
    if (filters.dateFrom) query = query.gte("expense_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("expense_date", filters.dateTo);
    if (filters.category) query = query.eq("category", filters.category);
    if (pattern) query = query.ilike("description", pattern);
    const from = (targetPage - 1) * pageSize;
    return query
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);
  };

  const [expenseResult, totalResult] = filterError
    ? [null, null]
    : await Promise.all([
        loadExpenses(page),
        supabase.rpc("get_expense_total", {
          p_start_date: filters.dateFrom || null,
          p_end_date: filters.dateTo || null,
          p_category: filters.category || null,
          p_description_pattern: pattern,
        }),
      ]);

  if (expenseResult?.error) logReadError(expenseResult.error);
  if (totalResult?.error && process.env.NODE_ENV === "development") {
    console.error(`[GemFlow Pengeluaran] rpc.get_expense_total ${JSON.stringify({
      code: totalResult.error.code ?? "unknown",
      message: totalResult.error.message,
      details: totalResult.error.details ?? null,
      hint: totalResult.error.hint ?? null,
    })}`);
  }

  const totalCount = expenseResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  let currentResult = expenseResult;
  if (currentResult && !currentResult.error && page > totalPages) {
    page = totalPages;
    currentResult = await loadExpenses(page);
    if (currentResult.error) logReadError(currentResult.error);
  }
  const error = currentResult?.error ?? null;

  const expenses: Expense[] = (currentResult?.data ?? []).map((expense) => ({
    ...expense,
    amount: Number(expense.amount),
    creator_label: expense.created_by === profile.userId
      ? `${profile.fullName} (Anda)`
      : expense.created_by,
  }));
  const totalExpense = typeof totalResult?.data === "number" || typeof totalResult?.data === "string"
    ? Number(totalResult.data)
    : null;
  const pagination: ExpensePagination = {
    page,
    pageSize,
    totalCount,
    totalPages,
    previousHref: page > 1 ? buildPageHref(filters, page - 1) : null,
    nextHref: page < totalPages ? buildPageHref(filters, page + 1) : null,
  };

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ReceiptText aria-hidden="true" className="size-4" />
            Biaya operasional
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Pengeluaran</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Catat dan tinjau pengeluaran operasional GemFlow.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ReceiptText aria-hidden="true" className="size-4 text-primary" />
          {profile.role === "admin" ? "Akses Admin" : "Akses Kasir"}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Pengeluaran tidak dapat dimuat</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Periksa akses baca pengeluaran untuk akun terautentikasi, lalu muat ulang halaman.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ExpensesWorkbench
          expenses={expenses}
          role={profile.role}
          filters={filters}
          pagination={pagination}
          totalExpense={Number.isFinite(totalExpense) ? totalExpense : null}
          totalError={totalResult?.error ? "Total pengeluaran belum dapat dihitung. Fungsi ringkasan database perlu tersedia." : ""}
          filterError={filterError}
        />
      )}
    </WorkspaceShell>
  );
}