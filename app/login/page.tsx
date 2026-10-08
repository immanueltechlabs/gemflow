import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Boxes, ChartNoAxesCombined, Gem, ShieldCheck } from "lucide-react";

import { GemFlowMark } from "@/components/gemflow-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Masuk | GemFlow" };

export const instant = false;

const capabilities = [
  { icon: Boxes, label: "Kendali inventaris" },
  { icon: Gem, label: "Kasir batu mulia" },
  { icon: ChartNoAxesCombined, label: "Laporan bisnis" },
] as const;

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#101714] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="gem-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <GemFlowMark className="bg-[#d6eee2] text-[#174d39]" />
          <span className="text-lg font-semibold tracking-[-0.02em]">GemFlow</span>
        </div>
        <div className="relative z-10 max-w-xl pb-10">
          <div className="mb-10 flex size-24 rotate-45 items-center justify-center border border-[#6fa98d]/50 bg-[#183b2e]/70">
            <Gem className="size-11 -rotate-45 text-[#b7dbc8]" strokeWidth={1.25} />
          </div>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-5xl">Kendali menyeluruh, dari meja kasir hingga ruang penyimpanan.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#aebdb5]">Catat setiap batu mulia, penjualan, dan pergerakan stok dalam satu ruang kerja yang terpusat.</p>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {capabilities.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-sm text-[#d4dfd9]"><Icon aria-hidden="true" className="size-4 text-[#86b99f]" />{label}</span>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-[#7f9188]">GemFlow · Operasional ritel yang aman</p>
      </section>

      <section className="flex min-h-svh flex-col">
        <header className="flex h-20 items-center justify-between px-6 sm:px-10 lg:justify-end">
          <div className="flex items-center gap-3 lg:hidden"><GemFlowMark /><span className="font-semibold tracking-[-0.02em]">GemFlow</span></div>
          <ThemeSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pb-20 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              <div className="mb-5 flex size-11 items-center justify-center rounded-lg border bg-card text-primary lg:hidden"><ShieldCheck aria-hidden="true" className="size-5" /></div>
              <h2 className="text-3xl font-semibold tracking-[-0.035em]">Selamat datang kembali</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Masuk dengan akun staf GemFlow Anda.</p>
            </div>
            <LoginForm />
            <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Akses dikelola oleh administrator GemFlow Anda.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
