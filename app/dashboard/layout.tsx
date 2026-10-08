import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Dasbor | GemFlow", template: "%s | GemFlow" },
};

export const instant = false;
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
