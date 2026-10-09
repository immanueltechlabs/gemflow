export const expenseCategories = [
  "Operasional",
  "Transportasi",
  "Kemasan",
  "Gaji",
  "Sewa",
  "Utilitas",
  "Marketing",
  "Lainnya",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  notes: string | null;
  created_by: string;
  creator_label: string;
};

export type ExpenseActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialExpenseActionState: ExpenseActionState = {
  status: "idle",
  message: "",
};