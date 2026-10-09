import type { Metadata } from "next";
import { Boxes, PlusCircle } from "lucide-react";

import { InventoryTable } from "@/components/inventory-table";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import {
  productSelect,
  productStatuses,
  type InventoryFilters,
  type InventoryListingProduct,
  type InventoryPagination,
} from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventaris | GemFlow" };
export const instant = false;

const pageSize = 25;
const cashierProductSelect = "id, sku, barcode, name, category, grade, weight_grams, supplier_name, selling_price, status, received_at";

type InventorySearchParams = {
  q?: string | string[];
  category?: string | string[];
  supplier?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function safeSearchValue(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, "%");
}

function buildPageHref(filters: InventoryFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(page));
  return `/inventory?${params.toString()}`;
}

async function loadProducts(role: "admin" | "cashier", filters: InventoryFilters, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(role === "admin" ? productSelect : cashierProductSelect, { count: "exact" });

  const search = safeSearchValue(filters.q);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`sku.ilike.${pattern},barcode.ilike.${pattern},name.ilike.${pattern}`);
  }
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.supplier) query = query.eq("supplier_name", filters.supplier);
  if (filters.status) query = query.eq("status", filters.status);

  const from = (page - 1) * pageSize;
  return query
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  const requestedStatus = firstParam(params.status);
  const filters: InventoryFilters = {
    q: firstParam(params.q).trim().slice(0, 100),
    category: firstParam(params.category).trim().slice(0, 120),
    supplier: firstParam(params.supplier).trim().slice(0, 120),
    status: productStatuses.find((status) => status === requestedStatus) ?? "",
  };
  const requestedPage = Number(firstParam(params.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  let productResult = await loadProducts(profile.role, filters, page);
  const totalCount = productResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) {
    page = totalPages;
    productResult = await loadProducts(profile.role, filters, page);
  }
  const products = (productResult.data ?? []) as unknown as InventoryListingProduct[];
  const pagination: InventoryPagination = {
    page,
    pageSize,
    totalCount,
    totalPages,
    previousHref: page > 1 ? buildPageHref(filters, page - 1) : null,
    nextHref: page < totalPages ? buildPageHref(filters, page + 1) : null,
  };

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Boxes aria-hidden="true" className="size-4" />
            Data induk produk
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Inventaris</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Temukan batu mulia, tinjau harga, dan cetak label yang dapat dipindai dari satu katalog.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <PlusCircle aria-hidden="true" className="size-4 text-primary" />
          {profile.role === "admin" ? "Penyuntingan Admin aktif" : "Akses hanya lihat"}
        </div>
      </div>

      {productResult.error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <h2 className="font-semibold text-destructive">Inventaris tidak dapat dimuat</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {productResult.error.code === "42501" || /row-level security|permission denied/i.test(productResult.error.message)
              ? "Peran terautentikasi memerlukan kebijakan SELECT pada public.products. Kebijakan yang aman harus mengizinkan profil Admin dan Kasir membaca produk ketika auth.uid() sesuai dengan profiles.id."
              : "Terjadi kesalahan saat memuat produk. Coba muat ulang halaman."}
          </p>
        </div>
      ) : (
        <InventoryTable products={products} role={profile.role} filters={filters} pagination={pagination} />
      )}
    </WorkspaceShell>
  );
}
