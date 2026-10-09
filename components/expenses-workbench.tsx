"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleAlert, CircleCheck, LoaderCircle, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";

import { createExpense, deleteExpense, updateExpense } from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { expenseCategories, initialExpenseActionState, type Expense, type ExpenseFilters, type ExpensePagination } from "@/lib/expenses";
import type { UserRole } from "@/lib/auth";
import { formatRupiah } from "@/lib/inventory";

const inputClass = "h-11 rounded-lg shadow-none focus-visible:ring-2 focus-visible:ring-primary/25";

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00`));
}

function ExpenseForm({
  expense,
  onSaved,
}: {
  expense: Expense | null;
  onSaved: (message: string) => void;
}) {
  const action = expense ? updateExpense : createExpense;
  const [state, formAction, pending] = useActionState(action, initialExpenseActionState);

  useEffect(() => {
    if (state.status === "success") onSaved(state.message);
  }, [onSaved, state]);

  return (
    <form action={formAction} className="space-y-5">
      {expense ? <input type="hidden" name="expense_id" value={expense.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="expense-date" className="text-sm font-medium">Tanggal</label>
          <Input id="expense-date" name="expense_date" type="date" defaultValue={expense?.expense_date ?? todayValue()} required className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="expense-category" className="text-sm font-medium">Kategori</label>
          <select
            id="expense-category"
            name="category"
            defaultValue={expense?.category ?? expenseCategories[0]}
            required
            className={`${inputClass} w-full border border-input bg-background px-3 text-sm focus-visible:outline-none`}
          >
            {expense?.category && !expenseCategories.includes(expense.category as (typeof expenseCategories)[number]) ? (
              <option value={expense.category}>{expense.category}</option>
            ) : null}
            {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="expense-description" className="text-sm font-medium">Deskripsi</label>
          <Input id="expense-description" name="description" defaultValue={expense?.description ?? ""} maxLength={240} required placeholder="Contoh: Pembelian perlengkapan toko" className={inputClass} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="expense-amount" className="text-sm font-medium">Nominal</label>
          <Input id="expense-amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={expense?.amount ?? ""} required placeholder="0" className={`${inputClass} tabular-nums`} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="expense-notes" className="text-sm font-medium">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></label>
          <textarea
            id="expense-notes"
            name="notes"
            defaultValue={expense?.notes ?? ""}
            maxLength={500}
            rows={3}
            placeholder="Informasi tambahan"
            className="flex min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {state.status === "error" ? (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onSaved("")} disabled={pending} className="h-11">Batal</Button>
        <Button type="submit" disabled={pending} className="h-11 min-w-40">
          {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Menyimpan</> : expense ? "Simpan perubahan" : "Tambah pengeluaran"}
        </Button>
      </div>
    </form>
  );
}

export function ExpensesWorkbench({
  expenses,
  role,
  filters,
  pagination,
  totalExpense,
  totalError,
  filterError,
}: {
  expenses: Expense[];
  role: UserRole;
  filters: ExpenseFilters;
  pagination: ExpensePagination;
  totalExpense: number | null;
  totalError: string;
  filterError: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Expense | null | "new">(null);
  const [notice, setNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [deletePending, startDelete] = useTransition();

  const closeEditor = useCallback(() => {
    dialogRef.current?.close();
    setEditing(null);
  }, []);

  const handleSaved = useCallback((message: string) => {
    closeEditor();
    if (message) {
      setNotice(message);
      router.refresh();
    }
  }, [closeEditor, router]);

  const openEditor = (expense: Expense | "new") => {
    setEditing(expense);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  };

  const handleDelete = (expense: Expense) => {
    if (!window.confirm(`Hapus pengeluaran “${expense.description}”?`)) return;

    setDeletingId(expense.id);
    setDeleteError("");
    startDelete(async () => {
      const result = await deleteExpense(expense.id);
      if (result.status === "success") {
        setNotice(result.message);
        router.refresh();
      } else {
        setDeleteError(result.message);
      }
      setDeletingId("");
    });
  };

  const filtersActive = Boolean(filters.query || filters.category || filters.dateFrom || filters.dateTo);
  const firstRow = pagination.totalCount ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastRow = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <>
      {notice ? (
        <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><CircleCheck aria-hidden="true" className="size-4 text-primary" />{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Tutup notifikasi"><X aria-hidden="true" className="size-4" /></button>
        </div>
      ) : null}

      {filterError ? (
        <div role="alert" className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4" />{filterError}</span>
        </div>
      ) : null}

      <section aria-label="Filter pengeluaran" className="mb-5 rounded-xl border bg-card p-4 sm:p-5">
        <form method="get" action="/expenses" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.5fr)_minmax(140px,1fr)_repeat(2,minmax(130px,0.9fr))_auto]">
          <div className="space-y-2">
            <label htmlFor="expense-search" className="text-sm font-medium">Cari deskripsi</label>
            <Input id="expense-search" name="query" defaultValue={filters.query} placeholder="Cari pengeluaran" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="expense-filter-category" className="text-sm font-medium">Kategori</label>
            <Input id="expense-filter-category" name="category" list="expense-categories" defaultValue={filters.category} placeholder="Semua kategori" className={inputClass} />
            <datalist id="expense-categories">
              {expenseCategories.map((value) => <option key={value} value={value} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <label htmlFor="expense-date-from" className="text-sm font-medium">Dari tanggal</label>
            <Input id="expense-date-from" name="dateFrom" type="date" defaultValue={filters.dateFrom} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="expense-date-to" className="text-sm font-medium">Sampai tanggal</label>
            <Input id="expense-date-to" name="dateTo" type="date" defaultValue={filters.dateTo} className={inputClass} />
          </div>
          <div className="flex items-end gap-2 xl:justify-end">
            <Button type="submit" className="h-11 flex-1 sm:flex-none">Terapkan</Button>
            {filtersActive ? <Button asChild variant="ghost" className="h-11"><Link href="/expenses">Hapus filter</Link></Button> : null}
            <Button type="button" onClick={() => openEditor("new")} className="h-11 w-full sm:w-auto">
              <Plus aria-hidden="true" />Tambah pengeluaran
            </Button>
          </div>
        </form>
      </section>

      {deleteError ? (
        <div role="alert" className="mb-5 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4" />{deleteError}</span>
        </div>
      ) : null}

      <section aria-labelledby="expense-list-heading" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col justify-between gap-2 border-b p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <h2 id="expense-list-heading" className="font-semibold">Daftar pengeluaran</h2>
            <p className="mt-1 text-sm text-muted-foreground">Menampilkan {firstRow}–{lastRow} dari {pagination.totalCount} catatan</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Total terfilter <span className="ml-1 font-semibold tabular-nums text-foreground">{totalExpense === null ? "—" : formatRupiah(totalExpense)}</span></p>
            {totalError ? <p role="status" className="mt-1 max-w-md text-xs">{totalError}</p> : null}
          </div>
        </div>

        {expenses.length ? (
          <ul className="divide-y">
            {expenses.map((expense) => (
              <li key={expense.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(110px,0.7fr)_minmax(125px,0.8fr)_minmax(180px,1.6fr)_minmax(130px,0.9fr)_minmax(160px,1.1fr)_auto] lg:items-center">
                <div>
                  <p className="text-xs text-muted-foreground lg:hidden">Tanggal</p>
                  <p className="flex items-center gap-2 text-sm"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground lg:hidden" />{formattedDate(expense.expense_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground lg:hidden">Kategori</p>
                  <p className="text-sm">{expense.category}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground lg:hidden">Deskripsi</p>
                  <p className="truncate text-sm font-medium">{expense.description}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground lg:hidden">{expense.notes || "Tanpa catatan"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground lg:hidden">Nominal</p>
                  <p className="text-sm font-semibold tabular-nums">{formatRupiah(expense.amount)}</p>
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-sm text-muted-foreground">{expense.notes || "—"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">Dibuat oleh {expense.creator_label}</p>
                </div>
                <div className="flex items-center justify-between gap-2 lg:justify-end">
                  <span className="truncate text-xs text-muted-foreground lg:hidden">Dibuat oleh {expense.creator_label}</span>
                  {role === "admin" ? (
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEditor(expense)} aria-label={`Edit pengeluaran ${expense.description}`} title="Edit pengeluaran" className="size-10"><Pencil aria-hidden="true" /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(expense)} disabled={deletePending && deletingId === expense.id} aria-label={`Hapus pengeluaran ${expense.description}`} title="Hapus pengeluaran" className="size-10 text-muted-foreground hover:text-destructive">
                        {deletePending && deletingId === expense.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="hidden lg:col-span-full lg:block">
                  <p className="truncate text-xs text-muted-foreground">Catatan: {expense.notes || "—"}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <ReceiptText aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">{filtersActive ? "Tidak ada pengeluaran yang cocok" : "Belum ada pengeluaran"}</p>
            <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
              {filtersActive ? "Ubah filter atau rentang tanggal untuk melihat catatan lainnya." : "Tambahkan pengeluaran pertama untuk mulai mencatat biaya operasional."}
            </p>
            {filtersActive ? <Button asChild type="button" variant="outline" className="mt-4 h-10"><Link href="/expenses">Hapus filter</Link></Button> : null}
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

      <dialog ref={dialogRef} onClose={() => setEditing(null)} className="m-auto max-h-[calc(100svh-2rem)] w-[min(640px,calc(100%-2rem))] overflow-y-auto rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50">
        {editing ? (
          <div>
            <div className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold">{editing === "new" ? "Tambah pengeluaran" : "Edit pengeluaran"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Catat tanggal, kategori, deskripsi, dan nominal biaya.</p>
              </div>
              <button type="button" onClick={closeEditor} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Tutup formulir"><X aria-hidden="true" className="size-5" /></button>
            </div>
            <div className="p-5 sm:p-6"><ExpenseForm key={editing === "new" ? "new" : editing.id} expense={editing === "new" ? null : editing} onSaved={handleSaved} /></div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}