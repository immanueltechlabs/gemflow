import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Barcode } from "@/components/barcode";
import { PrintLabelControls } from "@/components/print-label-button";
import { getCurrentProfile } from "@/lib/auth";
import { formatRupiah, productSelect, type Product } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Label barcode | GemFlow" };
export const instant = false;
export const dynamic = "force-dynamic";

export default async function BarcodeLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, getCurrentProfile()]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(productSelect).eq("id", id).single();

  if (error || !data) notFound();
  const product = data as Product;

  return (
    <main className="barcode-label-page flex min-h-svh items-center justify-center bg-muted/50 px-4 pt-20 print:min-h-0 print:bg-white print:p-0">
      <PrintLabelControls />
      <article className="barcode-label flex h-[30mm] w-[50mm] flex-col overflow-hidden bg-white px-[3mm] py-[2.2mm] text-[#111a16] shadow-xl print:shadow-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[8px] font-semibold leading-none">GemFlow</p>
            <h1 className="mt-1 line-clamp-2 text-[9px] font-bold leading-[1.12]">{product.name}</h1>
          </div>
          <p className="shrink-0 text-[8px] font-bold">{product.weight_grams == null ? "" : `${Number(product.weight_grams).toLocaleString("id-ID", { maximumFractionDigits: 3 })}g`}</p>
        </div>
        <div className="mt-auto flex justify-center">
          <Barcode value={product.barcode || product.sku} className="h-[14mm] w-auto" />
        </div>
        <div className="flex items-end justify-between gap-2 text-[8px] leading-none">
          <p className="font-semibold">{product.sku}</p>
          <p className="font-bold">{formatRupiah(product.selling_price)}</p>
        </div>
      </article>
    </main>
  );
}
