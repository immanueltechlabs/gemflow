import type { Metadata } from "next";
import { Barcode, ShoppingBag } from "lucide-react";

import { PosTerminal } from "@/components/pos-terminal";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PosProduct } from "@/lib/pos";

export const metadata: Metadata = { title: "Kasir | GemFlow" };
export const instant = false;

export default async function PosPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, barcode, name, category, selling_price")
    .eq("status", "available")
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(12);

  if (error && process.env.NODE_ENV === "development") {
    console.error("[GemFlow POS] products.default_available.select", {
      code: error.code,
      message: error.message,
    });
  }
  const defaultProducts: PosProduct[] = (data ?? []).map((product) => ({
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    category: product.category,
    selling_price: product.selling_price,
  }));

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
          Pemindaian barcode aktif
        </div>
      </div>

      <PosTerminal
        defaultProducts={defaultProducts}
        defaultProductsError={error ? "Produk tersedia belum dapat dimuat. Muat ulang halaman atau hubungi Admin." : ""}
      />
    </WorkspaceShell>
  );
}