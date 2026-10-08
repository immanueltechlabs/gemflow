import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { DashboardNav } from "@/components/dashboard-nav";
import { GemFlowMark } from "@/components/gemflow-mark";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { CurrentProfile } from "@/lib/auth";
import { formatRole } from "@/lib/utils";

export function WorkspaceShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: CurrentProfile;
}) {
  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-svh bg-muted/35">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <GemFlowMark />
          <div>
            <p className="font-semibold tracking-[-0.02em]">GemFlow</p>
            <p className="text-xs text-muted-foreground">Operasional</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <DashboardNav role={profile.role} />
        </div>
        <div className="border-t p-4">
          <div className="mb-2 flex items-center gap-3 px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.fullName}</p>
              <p className="text-xs text-muted-foreground">{formatRole(profile.role)}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur sm:px-8 lg:h-20">
          <div className="flex items-center gap-3 lg:hidden">
            <GemFlowMark className="size-8" />
            <span className="font-semibold tracking-[-0.02em]">GemFlow</span>
          </div>
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">
            Ruang kerja operasional batu mulia
          </p>
          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <DashboardMobileNav fullName={profile.fullName} role={profile.role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-5 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
