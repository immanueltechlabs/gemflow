import type { Metadata } from "next";
import { CircleAlert, ReceiptText } from "lucide-react";

import { ExpensesWorkbench } from "@/components/expenses-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import type { Expense } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pengeluaran | GemFlow" };
export const instant = false;

function logReadError(error: { code?: string; message: string; details?: string | null; hint?: string | null }) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[GemFlow Pengeluaran] expenses.select ${JSON.stringify({
    code: error.code ?? "unknown",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`);
}

export default async function ExpensesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, category, description, amount, notes, created_by")
    .order("expense_date", { ascending: false });

  if (error) logReadError(error);

  const expenses: Expense[] = (data ?? []).map((expense) => ({
    ...expense,
    amount: Number(expense.amount),
    creator_label: expense.created_by === profile.userId
      ? `${profile.fullName} (Anda)`
      : expense.created_by,
  }));

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
        <ExpensesWorkbench expenses={expenses} role={profile.role} />
      )}
    </WorkspaceShell>
  );
}