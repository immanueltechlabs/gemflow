import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Gem } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

const sections = {
  inventory: { title: "Inventaris", description: "Pengelolaan produk dan stok akan tersedia di sini.", adminOnly: false },
  "stock-movements": { title: "Pergerakan Stok", description: "Riwayat dan kendali pergerakan stok akan tersedia di sini.", adminOnly: true },
  returns: { title: "Retur", description: "Proses dan riwayat retur akan tersedia di sini.", adminOnly: false },
  expenses: { title: "Pengeluaran", description: "Pencatatan pengeluaran bisnis akan tersedia di sini.", adminOnly: false },
  reports: { title: "Laporan", description: "Laporan penjualan dan inventaris akan tersedia di sini.", adminOnly: true },
} as const;

type SectionKey = keyof typeof sections;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const config = sections[section as SectionKey];
  return { title: config?.title ?? "Modul" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const [{ section }, profile] = await Promise.all([params, getCurrentProfile()]);
  if (section === "inventory") redirect("/inventory");
  if (section === "pos") redirect("/pos");
  if (section === "returns") redirect("/returns");
  if (section === "expenses") redirect("/expenses");
  if (section === "reports") redirect("/reports");
  const config = sections[section as SectionKey];
  if (!config) notFound();
  if (config.adminOnly && profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col">
      <Link href="/dashboard" className="flex min-h-11 w-fit items-center gap-2 rounded-lg pr-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-4" />Kembali ke dasbor</Link>
      <div className="flex flex-1 items-center justify-center py-12 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-14 items-center justify-center rounded-xl border bg-card text-primary"><Gem aria-hidden="true" className="size-6" /></span>
          <p className="mt-6 text-sm font-medium text-primary">Modul GemFlow</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{config.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{config.description} Fondasi autentikasi dan navigasi untuk modul ini telah siap.</p>
        </div>
      </div>
    </div>
  );
}
