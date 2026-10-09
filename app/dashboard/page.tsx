import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  PackagePlus,
  RotateCcw,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { getFinancialReport } from "@/app/reports/actions";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getCurrentProfile } from "@/lib/auth";
import type {
  DashboardData,
  DashboardReturnActivity,
  DashboardSaleActivity,
  DashboardStockActivity,
} from "@/lib/dashboard";
import { getJakartaDate, shiftDate } from "@/lib/report-dates";
import { createClient } from "@/lib/supabase/server";
import { formatRole } from "@/lib/utils";

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const adminActions: QuickAction[] = [
  { title: "Buka Kasir", description: "Mulai transaksi pelanggan.", href: "/pos", icon: ShoppingBag },
  { title: "Tambah Barang", description: "Kelola produk inventaris.", href: "/inventory", icon: PackagePlus },
  { title: "Catat Pengeluaran", description: "Simpan biaya operasional.", href: "/expenses", icon: ArrowDownLeft },
  { title: "Lihat Laporan", description: "Tinjau performa keuangan.", href: "/reports", icon: ChartNoAxesCombined },
];

const cashierActions: QuickAction[] = [
  { title: "Buka Kasir", description: "Mulai transaksi pelanggan.", href: "/pos", icon: ShoppingBag },
  { title: "Cari Inventaris", description: "Temukan produk yang tersedia.", href: "/inventory", icon: Boxes },
  { title: "Proses Retur", description: "Catat pengembalian barang.", href: "/returns", icon: RotateCcw },
];

type DatabaseError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function logQueryError(query: string, error: DatabaseError) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[GemFlow Dasbor] ${query} ${JSON.stringify({
    code: error.code ?? "unknown",
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`);
}

function formatToday(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function displayValue(value: unknown, fallback: string) {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

async function loadCashierDashboard(startIso: string, endIso: string): Promise<DashboardData> {
  const supabase = await createClient();
  const [salesResult, inventoryResult, returnsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("returns")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const errors: string[] = [];
  if (salesResult.error) {
    logQueryError("sales.today.select", salesResult.error);
    errors.push("Transaksi hari ini tidak dapat dimuat.");
  }
  if (inventoryResult.error) {
    logQueryError("products.available.count", inventoryResult.error);
    errors.push("Jumlah barang tersedia tidak dapat dimuat.");
  }
  if (returnsResult.error) {
    logQueryError("returns.today.count", returnsResult.error);
    errors.push("Jumlah retur hari ini tidak dapat dimuat.");
  }

  let itemsSold: number | null = null;
  let transactionCount: number | null = null;
  if (!salesResult.error) {
    const sales = salesResult.data ?? [];
    transactionCount = sales.length;
    if (sales.length === 0) {
      itemsSold = 0;
    } else {
      const { data: items, error } = await supabase
        .from("sale_items")
        .select("id")
        .in("sale_id", sales.map((sale) => sale.id));
      if (error) {
        logQueryError("sale_items.today.count", error);
        errors.push("Jumlah barang terjual hari ini tidak dapat dimuat.");
      } else {
        itemsSold = items?.length ?? 0;
      }
    }
  }

  return {
    role: "cashier",
    financialReport: null,
    operational: {
      transactionCount,
      itemsSold,
      availableProducts: inventoryResult.error ? null : inventoryResult.count ?? 0,
      returnCount: returnsResult.error ? null : returnsResult.count ?? 0,
    },
    inventorySummary: null,
    recentSales: [],
    recentStockMovements: [],
    recentReturns: [],
    errors,
  };
}

async function loadAdminDashboard(today: string): Promise<DashboardData> {
  const supabase = await createClient();
  const [financialResult, inventoryResult, salesResult, movementsResult, returnsResult] = await Promise.all([
    getFinancialReport(today, today),
    supabase.from("products").select("id, status"),
    supabase
      .from("sales")
      .select("id, invoice_number, customer_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stock_movements")
      .select("id, movement_type, product_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("returns")
      .select("id, return_number, total_refund, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const errors: string[] = [];
  if (financialResult.error) errors.push(financialResult.error);
  if (inventoryResult.error) {
    logQueryError("products.status.summary", inventoryResult.error);
    errors.push("Ringkasan inventaris tidak dapat dimuat.");
  }
  if (salesResult.error) {
    logQueryError("sales.recent.select", salesResult.error);
    errors.push("Aktivitas penjualan tidak dapat dimuat.");
  }
  if (movementsResult.error) {
    logQueryError("stock_movements.recent.select", movementsResult.error);
    errors.push("Pergerakan stok terbaru tidak dapat dimuat.");
  }
  if (returnsResult.error) {
    logQueryError("returns.recent.select", returnsResult.error);
    errors.push("Aktivitas retur tidak dapat dimuat.");
  }

  const productStatuses = inventoryResult.data ?? [];
  const inventorySummary = inventoryResult.error ? null : {
    available: productStatuses.filter((product) => product.status === "available").length,
    sold: productStatuses.filter((product) => product.status === "sold").length,
    returnedOrInactive: productStatuses.filter((product) => product.status === "returned" || product.status === "inactive").length,
    total: productStatuses.length,
  };

  const movementRows = movementsResult.data ?? [];
  const movementProductIds = [...new Set(movementRows.map((movement) => movement.product_id).filter((id): id is string => Boolean(id)))];
  const movementProductsResult = movementProductIds.length
    ? await supabase.from("products").select("id, sku, name").in("id", movementProductIds)
    : { data: [], error: null };
  if (movementProductsResult.error) {
    logQueryError("products.stock_movement_labels.select", movementProductsResult.error);
    errors.push("Nama produk pada pergerakan stok tidak dapat dimuat.");
  }
  const productsById = new Map((movementProductsResult.data ?? []).map((product) => [product.id, product]));

  const recentSales: DashboardSaleActivity[] = (salesResult.data ?? []).map((sale) => ({
    id: sale.id,
    invoiceNumber: displayValue(sale.invoice_number, sale.id),
    customerName: sale.customer_name,
    createdAt: sale.created_at,
  }));
  const recentStockMovements: DashboardStockActivity[] = movementRows.map((movement) => {
    const product = movement.product_id ? productsById.get(movement.product_id) : undefined;
    return {
      id: movement.id,
      movementType: movement.movement_type,
      productName: product?.name ?? null,
      sku: product?.sku ?? null,
      createdAt: movement.created_at,
    };
  });
  const recentReturns: DashboardReturnActivity[] = (returnsResult.data ?? []).map((item) => ({
    id: item.id,
    returnNumber: displayValue(item.return_number, item.id),
    totalRefund: Number(item.total_refund ?? 0),
    createdAt: item.created_at,
  }));

  return {
    role: "admin",
    financialReport: financialResult.report,
    operational: {
      transactionCount: financialResult.report?.transaction_count ?? null,
      itemsSold: financialResult.report?.items_sold ?? null,
      availableProducts: inventorySummary?.available ?? null,
      returnCount: financialResult.report?.return_count ?? null,
    },
    inventorySummary,
    recentSales,
    recentStockMovements,
    recentReturns,
    errors,
  };
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const today = getJakartaDate();
  const tomorrow = shiftDate(today, 1);
  const startIso = new Date(`${today}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${tomorrow}T00:00:00+07:00`).toISOString();
  const data = profile.role === "admin"
    ? await loadAdminDashboard(today)
    : await loadCashierDashboard(startIso, endIso);
  const firstName = profile.fullName.split(/\s+/)[0];
  const quickActions = profile.role === "admin" ? adminActions : cashierActions;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{formatToday(today)}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Senang melihat Anda, {firstName}.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Ringkasan operasional GemFlow hari ini.</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
          <CircleCheck aria-hidden="true" className="size-4 text-primary" />
          Masuk sebagai <span className="text-foreground">{formatRole(profile.role)}</span>
        </div>
      </div>

      <DashboardOverview data={data} />

      {data.errors.length ? (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <h2 className="text-sm font-medium">Sebagian data dasbor belum tersedia</h2>
            <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
              {data.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="quick-actions-heading" className="mt-9 border-t pt-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="quick-actions-heading" className="text-lg font-semibold tracking-[-0.02em]">Aksi cepat</h2>
            <p className="mt-1 text-sm text-muted-foreground">Buka modul untuk melanjutkan pekerjaan.</p>
          </div>
          <span className="text-xs text-muted-foreground">{quickActions.length} aksi</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(({ title, description, href, icon: Icon }) => (
            <Link key={href} href={href} className="group flex min-h-36 flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary"><Icon aria-hidden="true" className="size-5" /></span>
                <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <div className="mt-6"><h3 className="font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</p></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
