import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { CircleAlert, ScanBarcode } from "lucide-react";

import { StockOpnameHistory } from "@/components/stock-opname-history";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import type { StockOpnameSession } from "@/lib/stock-opname";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stock Opname | GemFlow" };
export const instant = false;

const pageSize = 20;

type SearchParams = { page?: string | string[] };
type StaffEntry = { id: string; full_name: string | null };

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isStaffEntry(value: unknown): value is StaffEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    (typeof record.full_name === "string" || record.full_name === null);
}

export default async function StockOpnamePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  noStore();
  const profile = await getCurrentProfile();
  const params = await searchParams;
  const requestedPage = Number(firstParam(params.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 100_000)
    : 1;
  const supabase = await createClient();
  const readSessions = (targetPage: number) => supabase
    .from("stock_opnames")
    .select(
      "id, started_by, completed_by, started_at, completed_at, status, expected_count, matched_count, missing_count, unexpected_count, duplicate_count, unknown_count, notes",
      { count: "exact" },
    )
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range((targetPage - 1) * pageSize, targetPage * pageSize - 1);

  let sessionResult = await readSessions(page);
  const totalCount = sessionResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (!sessionResult.error && page > totalPages) {
    page = totalPages;
    sessionResult = await readSessions(page);
  }

  const directoryResult = await supabase.rpc("get_staff_directory");
  const directory = Array.isArray(directoryResult.data)
    ? directoryResult.data.filter(isStaffEntry)
    : [];
  const staffById = Object.fromEntries(directory.map((staff) => [
    staff.id,
    staff.full_name?.trim() || "Nama staf tidak tersedia",
  ]));

  const error = sessionResult.error;
  const sessions = (sessionResult.data ?? []) as StockOpnameSession[];
  const baseHref = "/stock-opname";
  const pagination = {
    page,
    totalPages,
    previousHref: page > 1 ? `${baseHref}?page=${page - 1}` : null,
    nextHref: page < totalPages ? `${baseHref}?page=${page + 1}` : null,
  };

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 border-b pb-7">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ScanBarcode aria-hidden="true" className="size-4" />
          Inventaris fisik
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Stock Opname</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pindai barcode barang untuk mencocokkan stok fisik dengan snapshot produk tersedia.
          Hasil opname tidak mengubah stok secara otomatis.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Riwayat Stock Opname belum dapat dimuat</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pastikan tabel dan kebijakan baca Stock Opname telah dikonfigurasi. Data produk dan stok tidak diubah.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {directoryResult.error ? (
            <p role="status" className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Nama staf tidak dapat dimuat; riwayat tetap menampilkan identitas pengguna.
            </p>
          ) : null}
          <StockOpnameHistory
            sessions={sessions}
            staffById={staffById}
            pagination={pagination}
          />
        </>
      )}
    </WorkspaceShell>
  );
}
