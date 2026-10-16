import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { ArrowLeft, CircleAlert, History } from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Riwayat Produk | GemFlow" };
export const instant = false;

const pageSize = 50;
const fieldLabels: Record<string, string> = {
  name: "Nama produk",
  category: "Kategori",
  grade: "Mutu",
  weight_grams: "Berat (gram)",
  supplier_name: "Pemasok",
  cost_price: "Harga modal",
  selling_price: "Harga jual",
  status: "Status",
  barcode: "Barcode",
  received_at: "Tanggal diterima",
};

type SearchParams = { page?: string | string[] };
type AuditRow = {
  id: string;
  user_id: string;
  action: string;
  entity_id: string;
  description: string | null;
  metadata: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  return String(value);
}

function pageHref(productId: string, page: number) {
  return `/inventory/${productId}/audit?page=${page}`;
}

export default async function ProductAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  noStore();
  const [profile, routeParams, queryParams] = await Promise.all([
    getCurrentProfile(),
    params,
    searchParams,
  ]);
  if (profile.role !== "admin") redirect("/inventory");

  const productId = routeParams.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    redirect("/inventory");
  }

  const requestedPage = Number(firstParam(queryParams.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 100_000)
    : 1;
  const supabase = await createClient();
  const [productResult, auditResult] = await Promise.all([
    supabase.from("products").select("id, sku, name").eq("id", productId).maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_id, description, metadata, created_at", { count: "exact" })
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .eq("action", "product_updated")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
  ]);

  if (!productResult.data && !productResult.error) redirect("/inventory");
  const totalCount = auditResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) page = totalPages;
  const currentAuditResult = page === requestedPage || page === 1
    ? auditResult
    : await supabase
        .from("audit_logs")
        .select("id, user_id, action, entity_id, description, metadata, created_at", { count: "exact" })
        .eq("entity_type", "product")
        .eq("entity_id", productId)
        .eq("action", "product_updated")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
  const error = productResult.error ?? currentAuditResult.error;
  const rows = (currentAuditResult.data ?? []) as AuditRow[];

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 border-b pb-7">
        <Button asChild variant="ghost" className="-ml-3 mb-4">
          <Link href="/inventory"><ArrowLeft aria-hidden="true" />Kembali ke inventaris</Link>
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <History aria-hidden="true" className="size-4" />
          Audit produk
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Riwayat perubahan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {productResult.data ? `${productResult.data.sku} · ${productResult.data.name}` : "Detail produk tidak dapat dimuat"}
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Riwayat audit tidak dapat dimuat</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pastikan tabel audit produk tersedia dan izin baca Admin telah dikonfigurasi.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-4 sm:p-5">
            <h2 className="font-semibold">Perubahan data produk</h2>
            <p className="mt-1 text-sm text-muted-foreground">Menampilkan {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} dari {totalCount} perubahan</p>
          </div>
          {rows.length ? (
            <ol className="divide-y">
              {rows.map((row) => (
                <li key={row.id} className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {row.description ? <p className="font-medium">{row.description}</p> : null}
                      <p className="text-xs text-muted-foreground">Diubah oleh <span className="font-mono">{row.user_id}</span></p>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={row.created_at}>
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      }).format(new Date(row.created_at))}
                    </time>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr><th className="pb-2 pr-4 font-medium">Kolom</th><th className="pb-2 pr-4 font-medium">Nilai lama</th><th className="pb-2 font-medium">Nilai baru</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {Object.entries(row.metadata).map(([field, change]) => (
                          <tr key={field}>
                            <th scope="row" className="py-2 pr-4 font-medium">{fieldLabels[field] ?? field}</th>
                            <td className="max-w-64 break-words py-2 pr-4 text-muted-foreground">{displayValue(change.old)}</td>
                            <td className="max-w-64 break-words py-2">{displayValue(change.new)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Belum ada perubahan yang tercatat untuk produk ini.</p>
          )}
          <div className="flex items-center justify-between gap-3 border-t px-4 py-4 text-sm sm:px-5">
            <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild variant="outline" className="h-10"><Link href={pageHref(productId, page - 1)}>Sebelumnya</Link></Button> : <Button variant="outline" disabled className="h-10">Sebelumnya</Button>}
              {page < totalPages ? <Button asChild variant="outline" className="h-10"><Link href={pageHref(productId, page + 1)}>Berikutnya</Link></Button> : <Button variant="outline" disabled className="h-10">Berikutnya</Button>}
            </div>
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}
