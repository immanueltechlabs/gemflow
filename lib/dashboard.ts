import type { UserRole } from "@/lib/auth";
import type { FinancialReport } from "@/lib/reports";

export type DashboardOperationalMetrics = {
  transactionCount: number | null;
  itemsSold: number | null;
  availableProducts: number | null;
  returnCount: number | null;
};

export type DashboardInventorySummary = {
  available: number;
  sold: number;
  returnedOrInactive: number;
  total: number;
};

export type DashboardSaleActivity = {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  createdAt: string;
};

export type DashboardStockActivity = {
  id: string;
  movementType: string;
  productName: string | null;
  sku: string | null;
  createdAt: string;
};

export type DashboardReturnActivity = {
  id: string;
  returnNumber: string;
  totalRefund: number;
  createdAt: string;
};

export type DashboardData = {
  role: UserRole;
  financialReport: FinancialReport | null;
  operational: DashboardOperationalMetrics;
  inventorySummary: DashboardInventorySummary | null;
  recentSales: DashboardSaleActivity[];
  recentStockMovements: DashboardStockActivity[];
  recentReturns: DashboardReturnActivity[];
  errors: string[];
};