import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StockOpnameWorkbench } from "@/components/stock-opname-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import { signProductImages } from "@/lib/product-images";
import {
  stockOpnameSections,
  type StockOpnameItem,
  type StockOpnameScan,
  type StockOpnameSection,
  type StockOpnameSession,
} from "@/lib/stock-opname";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detail Stock Opname | GemFlow" };
export const instant = false;

const pageSize = 50;
const recentLimit = 30;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = { section?: string | string[]; page?: string | string[] };
type ProductImageRecord = { id: string; product_id: string | null; image_path: string | null };

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isSection(value: string): value is StockOpnameSection {
  return stockOpnameSections.some((section) => section === value);
}

async function attachImageUrls<T extends ProductImageRecord>(rows: T[]) {
  const imageResult = await signProductImages(rows.map((row) => ({
    id: row.product_id ?? row.id,
    image_path: row.product_id ? row.image_path : null,
  })));
  const imageUrls = imageResult.urls;
  return {
    rows: rows.map((row) => ({
      ...row,
      image_url: row.image_path ? imageUrls.get(row.image_path) ?? null : null,
    })),
    error: imageResult.error,
  };
}

export default async function StockOpnameDetailPage({
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
  if (!uuidPattern.test(routeParams.id)) notFound();

  const supabase = await createClient();
  const { data: rawSession, error: sessionError } = await supabase
    .from("stock_opnames")
    .select(
      "id, started_by, completed_by, started_at, completed_at, status, expected_count, matched_count, missing_count, unexpected_count, duplicate_count, unknown_count, notes",
    )
    .eq("id", routeParams.id)
    .maybeSingle();

  if (sessionError || !rawSession) {
    return (
      <WorkspaceShell profile={profile}>
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <h1 className="font-semibold text-destructive">Sesi Stock Opname tidak dapat dimuat</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pastikan sesi tersedia dan kebijakan baca Stock Opname telah dikonfigurasi.
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  const session = rawSession as StockOpnameSession;
  if (!["in_progress", "completed", "cancelled"].includes(session.status)) notFound();

  const requestedSection = firstParam(queryParams.section);
  const section = isSection(requestedSection) ? requestedSection : "matched";
  const requestedPage = Number(firstParam(queryParams.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 100_000)
    : 1;

  let records: Array<StockOpnameItem | StockOpnameScan> = [];
  let totalCount = 0;
  let totalPages = 1;
  let imageError = "";
  let dataError = "";

  if (session.status === "in_progress") {
    const { data, error } = await supabase
      .from("stock_opname_scans")
      .select("id, product_id, scanned_code, barcode, sku, product_name, image_path, result, scanned_at")
      .eq("stock_opname_id", session.id)
      .order("scanned_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(recentLimit);
    if (error) {
      console.error("[GemFlow Stock Opname] recent scan query failed.", {
        code: error.code,
        message: error.message,
      });
      dataError = "Pindai terbaru tidak dapat dimuat. Pastikan kebijakan baca sesi dan hasil telah dikonfigurasi.";
    } else {
      const result = await attachImageUrls((data ?? []) as StockOpnameScan[]);
      records = result.rows;
      if (result.error) imageError = "Sebagian foto produk tidak dapat dimuat.";
    }
  } else {
    const itemSection = section === "matched" || section === "missing";
    const readSection = (targetPage: number) => {
      const from = (targetPage - 1) * pageSize;
      if (itemSection) {
        return supabase
          .from("stock_opname_items")
          .select("id, product_id, barcode, sku, product_name, image_path, scanned, scan_count, scanned_at", { count: "exact" })
          .eq("stock_opname_id", session.id)
          .eq("scanned", section === "matched")
          .order("product_name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
      }
      return supabase
        .from("stock_opname_scans")
        .select("id, product_id, scanned_code, barcode, sku, product_name, image_path, result, scanned_at", { count: "exact" })
        .eq("stock_opname_id", session.id)
        .eq("result", section)
        .order("scanned_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
    };

    let result = await readSection(page);
    if (result.error) {
      console.error("[GemFlow Stock Opname] results query failed.", {
        code: result.error.code,
        message: result.error.message,
        section,
      });
      dataError = "Hasil sesi tidak dapat dimuat. Pastikan kebijakan baca sesi dan hasil telah dikonfigurasi.";
    } else {
      totalCount = result.count ?? 0;
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      if (page > totalPages) {
        page = totalPages;
        result = await readSection(page);
      }
      if (result.error) {
        console.error("[GemFlow Stock Opname] paged results query failed.", {
          code: result.error.code,
          message: result.error.message,
          section,
        });
        dataError = "Hasil sesi tidak dapat dimuat. Pastikan kebijakan baca sesi dan hasil telah dikonfigurasi.";
      } else if (itemSection) {
        const imageResult = await attachImageUrls((result.data ?? []) as StockOpnameItem[]);
        records = imageResult.rows;
        if (imageResult.error) imageError = "Sebagian foto produk tidak dapat dimuat.";
      } else {
        const imageResult = await attachImageUrls((result.data ?? []) as StockOpnameScan[]);
        records = imageResult.rows;
        if (imageResult.error) imageError = "Sebagian foto produk tidak dapat dimuat.";
      }
    }
  }

  if (imageError) {
    console.error("[GemFlow Stock Opname] photo signing failed.", imageError);
  }
  const pagination = {
    page,
    totalPages,
    totalCount,
    previousHref: page > 1 ? `/stock-opname/${session.id}?section=${section}&page=${page - 1}` : null,
    nextHref: page < totalPages ? `/stock-opname/${session.id}?section=${section}&page=${page + 1}` : null,
  };

  return (
    <WorkspaceShell profile={profile}>
      <StockOpnameWorkbench
        session={session}
        section={section}
        records={records}
        pagination={pagination}
        imageError={imageError}
        dataError={dataError}
        canModify={session.started_by === profile.userId}
        canCancel={session.started_by === profile.userId || profile.role === "admin"}
      />
    </WorkspaceShell>
  );
}
