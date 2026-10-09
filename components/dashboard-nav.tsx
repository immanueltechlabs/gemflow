"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Boxes,
  ChartNoAxesCombined,
  LayoutDashboard,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dasbor", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventaris", href: "/inventory", icon: Boxes },
  { label: "Kasir", href: "/pos", icon: ShoppingBag },
  { label: "Pergerakan Stok", href: "/dashboard/stock-movements", icon: ArrowLeftRight, adminOnly: true },
  { label: "Retur", href: "/returns", icon: RotateCcw },
  { label: "Pengeluaran", href: "/expenses", icon: ReceiptText },
  { label: "Laporan", href: "/reports", icon: ChartNoAxesCombined, adminOnly: true },
];

export function DashboardNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => role === "admin" || !item.adminOnly);

  return (
    <nav aria-label="Navigasi utama" className="space-y-1">
      {visibleItems.map(({ label, href, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className={cn("size-[18px]", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
