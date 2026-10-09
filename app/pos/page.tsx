import type { Metadata } from "next";
import { Barcode, CircleAlert, ShoppingBag } from "lucide-react";

import { PosTerminal } from "@/components/pos-terminal";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import type { PosProduct } from "@/lib/pos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kasir | GemFlow" };
export const instant = false;

async function loadAvailableProducts() {
  const supabase = await createClient();
  return supabase
    .from("products")
    .select("id, sku, barcode, name, category, weight_grams, selling_price")
    .eq("status", "available")
    .order("name", { ascending: true });
}

export default async function PosPage() {
  const [profile, productResult] = await Promise.all([
    getCurrentProfile(),
    loadAvailableProducts(),
  ]);

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShoppingBag aria-hidden="true" className="size-4" />
            Transaksi penjualan
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Kasir</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pilih produk tersedia, susun keranjang, lalu selesaikan pembayaran.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Barcode aria-hidden="true" className="size-4 text-primary" />
          {productResult.data?.length ?? 0} produk tersedia
        </div>
      </div>

      {productResult.error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Produk kasir tidak dapat dimuat</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Periksa akses baca produk untuk akun terautentikasi, lalu muat ulang halaman.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <PosTerminal products={(productResult.data ?? []) as PosProduct[]} />
      )}
    </WorkspaceShell>
  );
}