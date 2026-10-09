import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined } from "lucide-react";

import { ReportsDashboard } from "@/components/reports-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getFinancialReport } from "@/app/reports/actions";
import { getCurrentProfile } from "@/lib/auth";
import { getJakartaDate } from "@/lib/report-dates";

export const metadata: Metadata = { title: "Laporan | GemFlow" };
export const instant = false;

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const today = getJakartaDate();
  const initialResult = await getFinancialReport(today, today);

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ChartNoAxesCombined aria-hidden="true" className="size-4" />
            Ringkasan keuangan
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Laporan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tinjau penjualan, retur, biaya, dan laba untuk periode pilihan.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ChartNoAxesCombined aria-hidden="true" className="size-4 text-primary" />
          Khusus Admin
        </div>
      </div>
      <ReportsDashboard initialStartDate={today} initialEndDate={today} initialResult={initialResult} />
    </WorkspaceShell>
  );
}