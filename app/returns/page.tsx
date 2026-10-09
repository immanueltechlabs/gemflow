import type { Metadata } from "next";
import { CircleAlert, RotateCcw } from "lucide-react";

import { ReturnsWorkbench } from "@/components/returns-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Retur | GemFlow" };
export const instant = false;

export default async function ReturnsPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "cashier") {
    return (
      <WorkspaceShell profile={profile}>
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-destructive" />
            <div>
              <h1 className="font-semibold text-destructive">Akses retur tidak tersedia</h1>
              <p className="mt-2 text-sm text-muted-foreground">Akun ini tidak memiliki akses ke retur.</p>
            </div>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <RotateCcw aria-hidden="true" className="size-4" />
            Pengembalian penjualan
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Retur</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cari invoice, pilih barang yang belum pernah diretur, lalu catat pengembalian dana.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <RotateCcw aria-hidden="true" className="size-4 text-primary" />
          Retur per barang
        </div>
      </div>
      <ReturnsWorkbench />
    </WorkspaceShell>
  );
}