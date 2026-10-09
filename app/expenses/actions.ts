"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { expenseCategories, type ExpenseActionState } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/server";

type SupabaseMutationError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type ExpenseInput = {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  notes: string | null;
};

function textField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseExpenseInput(formData: FormData): ExpenseInput | string {
  const expenseDate = textField(formData, "expense_date");
  const category = textField(formData, "category");
  const description = textField(formData, "description");
  const amount = Number(textField(formData, "amount"));
  const notes = textField(formData, "notes");
  const parsedDate = new Date(`${expenseDate}T00:00:00`);

  if (!expenseDate || Number.isNaN(parsedDate.getTime())) {
    return "Pilih tanggal pengeluaran yang valid.";
  }
  if (!category || category.length > 80) {
    return "Pilih kategori pengeluaran yang valid.";
  }
  if (!description || description.length > 240) {
    return "Deskripsi wajib diisi dan maksimal 240 karakter.";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Nominal harus lebih besar dari nol.";
  }
  if (notes.length > 500) {
    return "Catatan maksimal 500 karakter.";
  }

  return {
    expense_date: expenseDate,
    category,
    description,
    amount,
    notes: notes || null,
  };
}

function logSupabaseError(statement: string, error: SupabaseMutationError) {
  if (process.env.NODE_ENV !== "development") return;

  console.error(
    `[GemFlow Pengeluaran] ${statement} ${JSON.stringify({
      code: error.code ?? "unknown",
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })}`,
  );
}

function mutationFailure(operation: string, error: SupabaseMutationError): ExpenseActionState {
  logSupabaseError(operation, error);
  return {
    status: "error",
    message: `${operation} gagal. Periksa kembali data lalu coba lagi.`,
  };
}

function validCategory(category: string) {
  return expenseCategories.some((value) => value === category) || category.length <= 80;
}

export async function createExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return { status: "error", message: "Akun ini tidak memiliki akses untuk menambahkan pengeluaran." };
  }

  const input = parseExpenseInput(formData);
  if (typeof input === "string") return { status: "error", message: input };
  if (!validCategory(input.category)) {
    return { status: "error", message: "Pilih kategori pengeluaran yang valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    ...input,
    created_by: profile.userId,
  });

  if (error) return mutationFailure("expenses.insert", error);

  revalidatePath("/expenses");
  return { status: "success", message: "Pengeluaran berhasil ditambahkan." };
}

export async function updateExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    return { status: "error", message: "Hanya Admin yang dapat mengedit pengeluaran." };
  }

  const expenseId = textField(formData, "expense_id");
  if (!expenseId) return { status: "error", message: "Pengeluaran yang akan diedit tidak ditemukan." };

  const input = parseExpenseInput(formData);
  if (typeof input === "string") return { status: "error", message: input };
  if (!validCategory(input.category)) {
    return { status: "error", message: "Pilih kategori pengeluaran yang valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update(input)
    .eq("id", expenseId)
    .select("id")
    .single();

  if (error) return mutationFailure("expenses.update", error);

  revalidatePath("/expenses");
  return { status: "success", message: "Pengeluaran berhasil diperbarui." };
}

export async function deleteExpense(expenseId: string): Promise<ExpenseActionState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    return { status: "error", message: "Hanya Admin yang dapat menghapus pengeluaran." };
  }
  if (!expenseId) {
    return { status: "error", message: "Pengeluaran yang akan dihapus tidak ditemukan." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .select("id")
    .single();

  if (error) return mutationFailure("expenses.delete", error);

  revalidatePath("/expenses");
  return { status: "success", message: "Pengeluaran berhasil dihapus." };
}