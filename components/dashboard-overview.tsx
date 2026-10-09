import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { formatRupiah } from "@/lib/inventory";
import type { DashboardData, DashboardStockActivity } from "@/lib/dashboard";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function MetricCard({
  title,
  value,
  icon: Icon,
  currency = false,
  negative = false,
}: {
  title: string;
  value: number | null;
  icon: LucideIcon;
  currency?: boolean;
  negative?: boolean;
}) {
  return (
    <article className={`rounded-lg border bg-card p-4 sm:p-5 ${negative ? "border-destructive/30 bg-destructive/[0.035]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${negative ? "text-destructive" : "text-primary"}`} />
      </div>
      <p className={`mt-3 text-xl font-semibold tabular-nums sm:text-2xl ${negative ? "text-destructive" : "text-foreground"}`}>
        {value === null ? "—" : currency ? formatRupiah(value) : new Intl.NumberFormat("id-ID").format(value)}
      </p>
      {negative ? <p className="mt-1 text-xs font-medium text-destructive">Rugi bersih hari ini</p> : null}
    </article>
  );
}

function OperationalCards({ data }: { data: DashboardData }) {
  const metrics = [
    { title: "Transaksi Hari Ini", value: data.operational.transactionCount, icon: ReceiptText },
    { title: "Barang Terjual Hari Ini", value: data.operational.itemsSold, icon: ShoppingBag },
    { title: "Barang Tersedia", value: data.operational.availableProducts, icon: Boxes },
    { title: "Retur Hari Ini", value: data.operational.returnCount, icon: RotateCcw },
  ];

  return (
    <section aria-labelledby="operational-heading" className="mt-7">
      <h2 id="operational-heading" className="mb-3 font-semibold">Ringkasan operasional</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
      </div>
    </section>
  );
}

function InventorySummary({ data }: { data: NonNullable<DashboardData["inventorySummary"]> }) {
  const metrics = [
    { title: "Produk tersedia", value: data.available, icon: PackageCheck },
    { title: "Produk terjual", value: data.sold, icon: PackageMinus },
    { title: "Diretur / nonaktif", value: data.returnedOrInactive, icon: PackagePlus },
    { title: "Total produk", value: data.total, icon: Boxes },
  ];

  return (
    <section aria-labelledby="inventory-summary-heading" className="mt-7">
      <h2 id="inventory-summary-heading" className="mb-3 font-semibold">Ringkasan inventaris</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, icon: Icon }) => (
          <article key={title} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-4 sm:px-5">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{new Intl.NumberFormat("id-ID").format(value)}</p>
            </div>
            <Icon aria-hidden="true" className="size-5 text-primary" />
          </article>
        ))}
      </div>
    </section>
  );
}

const movementLabels: Record<string, string> = {
  stock_in: "Stok masuk",
  sale: "Penjualan",
  return_in: "Barang retur masuk",
  adjustment: "Penyesuaian stok",
  stock_out: "Stok keluar",
};

function ActivityList<T extends { id: string; createdAt: string }>({
  title,
  items,
  emptyMessage,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3.5 sm:px-5">
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length ? (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
              <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

function RecentActivity({ data }: { data: DashboardData }) {
  return (
    <section aria-labelledby="recent-activity-heading" className="mt-7">
      <h2 id="recent-activity-heading" className="mb-3 font-semibold">Aktivitas terbaru</h2>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <ActivityList
          title="Penjualan terbaru"
          items={data.recentSales}
          emptyMessage="Belum ada penjualan hari ini."
          renderItem={(sale) => <>
            <p className="truncate text-sm font-medium">{sale.invoiceNumber}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{sale.customerName || "Pelanggan umum"}</p>
          </>}
        />
        <ActivityList<DashboardStockActivity>
          title="Pergerakan stok terbaru"
          items={data.recentStockMovements}
          emptyMessage="Belum ada pergerakan stok."
          renderItem={(movement) => <>
            <p className="truncate text-sm font-medium">{movementLabels[movement.movementType] ?? movement.movementType}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{movement.productName || movement.sku || "Produk"}</p>
          </>}
        />
        <ActivityList
          title="Retur terbaru"
          items={data.recentReturns}
          emptyMessage="Belum ada retur hari ini."
          renderItem={(item) => <>
            <p className="truncate text-sm font-medium">{item.returnNumber}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">Pengembalian {formatRupiah(item.refundAmount)}</p>
          </>}
        />
      </div>
    </section>
  );
}

export function DashboardOverview({ data }: { data: DashboardData }) {
  const report = data.financialReport;
  const netProfitIsNegative = report !== null && report.net_profit < 0;

  return (
    <>
      {data.role === "admin" && report ? (
        <section aria-labelledby="financial-heading" className="mt-7">
          <h2 id="financial-heading" className="mb-3 font-semibold">Ringkasan keuangan hari ini</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Omzet Bersih Hari Ini" value={report.net_sales} icon={CircleDollarSign} currency />
            <MetricCard title="Laba Kotor Hari Ini" value={report.gross_profit} icon={TrendingUp} currency negative={report.gross_profit < 0} />
            <MetricCard title="Pengeluaran Hari Ini" value={report.expenses} icon={ArrowDownLeft} currency />
            <MetricCard title="Laba Bersih Hari Ini" value={report.net_profit} icon={report.net_profit < 0 ? TrendingDown : ArrowUpRight} currency negative={netProfitIsNegative} />
          </div>
        </section>
      ) : null}

      <OperationalCards data={data} />

      {data.role === "admin" ? (
        <>
          {data.inventorySummary ? <InventorySummary data={data.inventorySummary} /> : null}
          <RecentActivity data={data} />
        </>
      ) : null}
    </>
  );
}