export type FinancialReport = {
  gross_sales: number;
  total_returns: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  transaction_count: number;
  items_sold: number;
  return_count: number;
  start_date: string;
  end_date: string;
};

export type FinancialReportResult = {
  report: FinancialReport | null;
  error?: string;
};