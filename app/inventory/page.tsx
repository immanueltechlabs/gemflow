import type { Metadata } from "next";
import { Boxes, PlusCircle } from "lucide-react";

import { InventoryTable } from "@/components/inventory-table";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import { productSelect, type Product } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventaris | GemFlow" };
export const instant = false;

async function loadProducts() {
  const supabase = await createClient();
  return supabase
    .from("products")
    .select(productSelect)
    .order("received_at", { ascending: false });
}

export default async function InventoryPage() {
  const [profile, productResult] = await Promise.all([getCurrentProfile(), loadProducts()]);

  return (
    <WorkspaceShell profile={profile}>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Boxes aria-hidden="true" className="size-4" />
            Data induk produk
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Inventaris</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Temukan batu mulia, tinjau harga, dan cetak label yang dapat dipindai dari satu katalog.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <PlusCircle aria-hidden="true" className="size-4 text-primary" />
          {profile.role === "admin" ? "Penyuntingan Admin aktif" : "Akses hanya lihat"}
        </div>
      </div>

      {productResult.error ? (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
          <h2 className="font-semibold text-destructive">Inventaris tidak dapat dimuat</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {productResult.error.code === "42501" || /row-level security|permission denied/i.test(productResult.error.message)
              ? "Peran terautentikasi memerlukan kebijakan SELECT pada public.products. Kebijakan yang aman harus mengizinkan profil Admin dan Kasir membaca produk ketika auth.uid() sesuai dengan profiles.id."
              : "Terjadi kesalahan saat memuat produk. Coba muat ulang halaman."}
          </p>
        </div>
      ) : (
        <InventoryTable products={(productResult.data ?? []) as Product[]} role={profile.role} />
      )}
    </WorkspaceShell>
  );
}
