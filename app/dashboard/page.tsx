import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  CircleCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { getCurrentProfile } from "@/lib/auth";
import { formatRole } from "@/lib/utils";

type WorkspaceLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const workspaceLinks: WorkspaceLink[] = [
  { title: "Inventaris", description: "Lihat produk dan stok yang tersedia.", href: "/inventory", icon: Boxes },
  { title: "Kasir", description: "Mulai dan selesaikan transaksi pelanggan.", href: "/dashboard/pos", icon: ShoppingBag },
  { title: "Pergerakan Stok", description: "Tinjau stok yang masuk dan keluar.", href: "/dashboard/stock-movements", icon: ArrowLeftRight, adminOnly: true },
  { title: "Retur", description: "Proses dan tinjau barang yang diretur.", href: "/dashboard/returns", icon: RotateCcw },
  { title: "Pengeluaran", description: "Catat biaya operasional harian.", href: "/dashboard/expenses", icon: ReceiptText, adminOnly: true },
  { title: "Laporan", description: "Pahami kinerja penjualan dan inventaris.", href: "/dashboard/reports", icon: ChartNoAxesCombined, adminOnly: true },
];

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = profile.fullName.split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  const visibleLinks = workspaceLinks.filter((link) => profile.role === "admin" || !link.adminOnly);

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Senang melihat Anda, {firstName}.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Ruang kerja GemFlow Anda siap. Pilih bagian di bawah untuk memulai.</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
          <CircleCheck aria-hidden="true" className="size-4 text-primary" />
          Masuk sebagai <span className="text-foreground">{formatRole(profile.role)}</span>
        </div>
      </div>

      <section aria-labelledby="workspace-heading" className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><h2 id="workspace-heading" className="text-lg font-semibold tracking-[-0.02em]">Ruang kerja</h2><p className="mt-1 text-sm text-muted-foreground">Peralatan utama untuk operasional hari ini.</p></div>
          <span className="text-xs text-muted-foreground">{visibleLinks.length} modul</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleLinks.map(({ title, description, href, icon: Icon }) => (
            <Link key={href} href={href} className="group flex min-h-40 flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary"><Icon aria-hidden="true" className="size-5" /></span>
                <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <div className="mt-7"><h3 className="font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="mt-8 flex flex-col justify-between gap-5 rounded-xl border border-primary/15 bg-primary/[0.045] p-5 sm:flex-row sm:items-center sm:p-6">
        <div><p className="font-semibold">Sesi terlindungi</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Akses dan modul yang tersedia disesuaikan dengan peran staf GemFlow Anda.</p></div>
        <div className="shrink-0 text-sm"><span className="text-muted-foreground">Profil</span><span className="mx-2 text-border">/</span><span className="font-medium">{profile.fullName}</span></div>
      </aside>
    </div>
  );
}
