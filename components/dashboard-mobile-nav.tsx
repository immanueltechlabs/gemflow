"use client";

import { useRef } from "react";
import { Menu, X } from "lucide-react";

import { DashboardNav } from "@/components/dashboard-nav";
import { GemFlowMark } from "@/components/gemflow-mark";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { UserRole } from "@/lib/auth";
import { formatRole } from "@/lib/utils";

export function DashboardMobileNav({ fullName, role }: { fullName: string; role: UserRole }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => detailsRef.current?.removeAttribute("open");

  return (
    <details ref={detailsRef} className="group lg:hidden">
      <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden="true" className="size-5 group-open:hidden" />
        <X aria-hidden="true" className="hidden size-5 group-open:block" />
        <span className="sr-only">Buka atau tutup navigasi</span>
      </summary>
      <div className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t bg-background p-5">
        <div className="mb-6 flex items-center gap-3 border-b pb-5">
          <GemFlowMark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{fullName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatRole(role)}</p>
          </div>
          <ThemeSwitcher />
        </div>
        <DashboardNav role={role} onNavigate={closeMenu} />
        <div className="mt-6 border-t pt-4"><LogoutButton /></div>
      </div>
    </details>
  );
}
