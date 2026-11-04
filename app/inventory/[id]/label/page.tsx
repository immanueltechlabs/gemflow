import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Barcode } from "@/components/barcode";
import { PrintLabelControls } from "@/components/print-label-button";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Label barcode | GemFlow" };
export const instant = false;

export default async function BarcodeLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, getCurrentProfile()]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, barcode, name, weight_grams")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const product = data;

  return (
    <main className="barcode-label-page flex min-h-svh items-center justify-center bg-muted/50 px-4 pt-20 print:min-h-0 print:bg-white print:p-0">
      <PrintLabelControls />
      <article className="barcode-label flex h-[30mm] w-[50mm] flex-col overflow-hidden bg-white px-[3mm] py-[1.8mm] text-[#111a16] shadow-xl print:shadow-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[8px] font-semibold leading-none">GemFlow</p>
            <h1 className="mt-1 line-clamp-2 text-[9px] font-bold leading-[1.12]">{product.name}</h1>
          </div>
          <p className="shrink-0 text-[8px] font-bold">{product.weight_grams == null ? "" : `${Number(product.weight_grams).toLocaleString("id-ID", { maximumFractionDigits: 3 })}g`}</p>
        </div>
        <div className="mt-auto flex justify-center">
          <Barcode value={product.barcode || product.sku} className="h-[15mm] w-auto" />
        </div>
        <div className="w-full text-center text-[8px] font-semibold leading-none">
          <p>{product.sku}</p>
        </div>
      </article>
    </main>
  );
}
