import type { Metadata } from "next";
import { ArrowLeftRight, CircleAlert } from "lucide-react";

import { StockMovementsWorkbench } from "@/components/stock-movements-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import { shiftDate } from "@/lib/report-dates";
import type {
  StockMovement,
  StockMovementFilters,
  StockMovementPagination,
  StockMovementStaffOption,
} from "@/lib/stock-movements";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pergerakan Stok | GemFlow" };
export const instant = false;

const pageSize = 50;
const maxMatchingProducts = 1000;

type ReadError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function logReadError(query: string, error: ReadError) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[GemFlow Pergerakan Stok] ${query} ${JSON.stringify({
    code: error.code ?? "unknown",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`);
}

function hasPermissionError(error: ReadError) {
  return error.code === "42501" || /permission denied|row-level security/i.test(error.message);
}

type StaffDirectoryEntry = {
  id: string;
  full_name: string | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  product_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
};

type SearchParams = {
  dateFrom?: string | string[];
  dateTo?: string | string[];
  movementType?: string | string[];
  performedBy?: string | string[];
  productQuery?: string | string[];
  page?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function safeProductSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, "%");
}

function buildPageHref(filters: StockMovementFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.movementType) params.set("movementType", filters.movementType);
  if (filters.performedBy) params.set("performedBy", filters.performedBy);
  if (filters.productQuery) params.set("productQuery", filters.productQuery);
  params.set("page", String(page));
  return `/stock-movements?${params.toString()}`;
}

function isStaffDirectoryEntry(value: unknown): value is StaffDirectoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    (typeof record.full_name === "string" || record.full_name === null);
}

function PageHeading() {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ArrowLeftRight aria-hidden="true" className="size-4" />
          Catatan operasional
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Pergerakan Stok</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Riwayat perubahan stok, produk terkait, dan staf yang mencatatnya.
        </p>
      </div>
    </div>
  );
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const params = await searchParams;
  const filters: StockMovementFilters = {
    dateFrom: firstParam(params.dateFrom).trim(),
    dateTo: firstParam(params.dateTo).trim(),
    movementType: firstParam(params.movementType).trim().slice(0, 40),
    performedBy: firstParam(params.performedBy).trim(),
    productQuery: firstParam(params.productQuery).trim().slice(0, 100),
  };
  const requestedPage = Number(firstParam(params.page));
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  let filterError = "";

  if ((filters.dateFrom && !isValidDate(filters.dateFrom)) || (filters.dateTo && !isValidDate(filters.dateTo))) {
    filterError = "Pilih rentang tanggal yang valid.";
  } else if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    filterError = "Tanggal awal tidak boleh melewati tanggal akhir.";
  } else if (filters.performedBy && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.performedBy)) {
    filterError = "Pilihan staf tidak valid.";
  }

  const staffDirectoryResult = await supabase.rpc("get_staff_directory");
  if (staffDirectoryResult.error) logReadError("rpc.get_staff_directory", staffDirectoryResult.error);
  const staffDirectoryData: unknown = staffDirectoryResult.data;
  const staffDirectory = Array.isArray(staffDirectoryData)
    ? staffDirectoryData.filter(isStaffDirectoryEntry)
    : [];
  const staffById = new Map(staffDirectory.map((staff) => [staff.id, staff]));
  const staffOptions: StockMovementStaffOption[] = staffDirectory
    .map((staff) => ({ id: staff.id, fullName: staff.full_name ?? "Nama staf tidak tersedia" }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "id"));

  let matchingProductIds: string[] | null = null;
  if (!filterError && filters.productQuery) {
    const search = safeProductSearch(filters.productQuery);
    if (search.length < 2) {
      filterError = "Masukkan minimal 2 karakter untuk mencari produk.";
    } else {
      const pattern = `%${search}%`;
      const { data, count, error } = await supabase
        .from("products")
        .select("id", { count: "exact" })
        .or(`sku.ilike.${pattern},barcode.ilike.${pattern},name.ilike.${pattern}`)
        .limit(maxMatchingProducts);

      if (error) {
        logReadError("products.stock_movements.search", error);
        filterError = "Pencarian produk tidak dapat dimuat. Coba lagi atau hubungi Admin.";
      } else if ((count ?? 0) > maxMatchingProducts) {
        filterError = "Terlalu banyak produk cocok. Tambahkan kata kunci yang lebih spesifik.";
      } else {
        matchingProductIds = (data ?? []).map((product) => product.id);
      }
    }
  }

  let movementRows: MovementRow[] = [];
  let totalCount = 0;
  let movementError: ReadError | null = null;
  if (!filterError && (matchingProductIds === null || matchingProductIds.length > 0)) {
    const fetchPage = (targetPage: number) => {
      let query = supabase
        .from("stock_movements")
        .select("id, movement_type, product_id, reference_type, reference_id, notes, performed_by, created_at", { count: "exact" });
      if (filters.dateFrom) query = query.gte("created_at", new Date(`${filters.dateFrom}T00:00:00+07:00`).toISOString());
      if (filters.dateTo) {
        const endExclusive = shiftDate(filters.dateTo, 1);
        query = query.lt("created_at", new Date(`${endExclusive}T00:00:00+07:00`).toISOString());
      }
      if (filters.movementType) query = query.eq("movement_type", filters.movementType);
      if (filters.performedBy) query = query.eq("performed_by", filters.performedBy);
      if (matchingProductIds) query = query.in("product_id", matchingProductIds);
      const from = (targetPage - 1) * pageSize;
      return query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
    };

    let result = await fetchPage(page);
    if (result.error) {
      movementError = result.error;
    } else {
      totalCount = result.count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      if (page > totalPages) {
        page = totalPages;
        result = await fetchPage(page);
        if (result.error) movementError = result.error;
      }
      movementRows = (result.data ?? []) as MovementRow[];
    }
  }

  if (movementError) {
    logReadError("stock_movements.select", movementError);
    return (
      <WorkspaceShell profile={profile}>
        <PageHeading />
        <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Riwayat pergerakan stok tidak dapat dimuat</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {hasPermissionError(movementError)
                  ? "Akun terautentikasi belum memiliki akses baca yang diperlukan untuk riwayat pergerakan stok. Kebijakan RLS tetap berlaku."
                  : "Terjadi kendala saat membaca riwayat. Muat ulang halaman atau hubungi Admin."}
              </p>
            </div>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  const movements = movementRows;
  const productIds = [...new Set(movements.map((movement) => movement.product_id).filter((id): id is string => Boolean(id)))];
  const [productsResult] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, sku, barcode, name").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsResult.error) logReadError("products.stock_movements.select", productsResult.error);

  const productsById = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
  const stockMovements: StockMovement[] = movements.map((movement) => {
    const product = movement.product_id ? productsById.get(movement.product_id) : undefined;
    const staff = movement.performed_by ? staffById.get(movement.performed_by) : undefined;
    return {
      id: movement.id,
      movementType: movement.movement_type,
      referenceType: movement.reference_type,
      referenceId: movement.reference_id,
      notes: movement.notes,
      productId: movement.product_id,
      performedBy: movement.performed_by,
      createdAt: movement.created_at,
      sku: product?.sku ?? null,
      barcode: product?.barcode ?? null,
      productName: product?.name ?? null,
      staffName: staff?.full_name ?? null,
    };
  });
  const relationWarning = productsResult.error || staffDirectoryResult.error
    ? "Sebagian detail produk atau nama staf tidak dapat dibaca. Periksa izin SELECT yang berlaku tanpa mengubah kebijakan RLS."
    : "";
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagination: StockMovementPagination = {
    page,
    pageSize,
    totalCount,
    totalPages,
    previousHref: page > 1 ? buildPageHref(filters, page - 1) : null,
    nextHref: page < totalPages ? buildPageHref(filters, page + 1) : null,
  };

  return (
    <WorkspaceShell profile={profile}>
      <PageHeading />
      <StockMovementsWorkbench
        movements={stockMovements}
        filters={filters}
        pagination={pagination}
        staffOptions={staffOptions}
        relationWarning={relationWarning}
        filterError={filterError}
      />
    </WorkspaceShell>
  );
}
