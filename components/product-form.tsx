"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { createProduct, updateProduct } from "@/app/inventory/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialInventoryActionState, type Product } from "@/lib/inventory";

function localDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const fieldClass =
  "h-11 rounded-lg bg-background shadow-none focus-visible:ring-2 focus-visible:ring-primary/25";

export function ProductForm({
  product,
  onCancel,
  onSuccess,
}: {
  product: Product | null;
  onCancel: () => void;
  onSuccess: (message: string) => void;
}) {
  const action = product ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, initialInventoryActionState);

  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
  }, [onSuccess, state]);

  return (
    <form action={formAction} className="space-y-6">
      {product ? <input type="hidden" name="product_id" value={product.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product-name">Nama produk</Label>
          <Input id="product-name" name="name" defaultValue={product?.name ?? ""} required maxLength={120} placeholder="Gelang giok — hijau imperial" className={fieldClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-category">Kategori</Label>
          <Input id="product-category" name="category" defaultValue={product?.category ?? ""} required maxLength={80} placeholder="Gelang" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-grade">Mutu</Label>
          <Input id="product-grade" name="grade" defaultValue={product?.grade ?? ""} required maxLength={80} placeholder="A" className={fieldClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-weight">Berat (gram)</Label>
          <Input id="product-weight" name="weight_grams" type="number" min="0.001" step="0.001" defaultValue={product?.weight_grams ?? ""} required placeholder="32.500" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-supplier">Pemasok</Label>
          <Input id="product-supplier" name="supplier_name" defaultValue={product?.supplier_name ?? ""} required maxLength={120} placeholder="Nama pemasok" className={fieldClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-cost">Harga modal (IDR)</Label>
          <Input id="product-cost" name="cost_price" type="number" min="0" step="1" defaultValue={product?.cost_price ?? ""} required placeholder="2500000" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-selling">Harga jual (IDR)</Label>
          <Input id="product-selling" name="selling_price" type="number" min="0" step="1" defaultValue={product?.selling_price ?? ""} required placeholder="3750000" className={fieldClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-received">Tanggal diterima</Label>
          <Input id="product-received" name="received_at" type="datetime-local" defaultValue={localDateTime(product?.received_at)} required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-status">Status</Label>
          <select id="product-status" name="status" defaultValue={product?.status ?? "active"} required className={`${fieldClass} w-full border border-input px-3 text-sm focus-visible:outline-none`}>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak aktif</option>
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product-barcode">Barcode internal</Label>
          <Input id="product-barcode" name="barcode" defaultValue={product?.barcode ?? ""} maxLength={80} placeholder={product ? "Nilai barcode" : "SKU yang dibuat akan digunakan secara otomatis"} className={fieldClass} />
          <p className="text-xs leading-5 text-muted-foreground">
            {product ? "Ubah hanya jika barang ini menggunakan barcode internal yang berbeda." : "Biarkan kosong untuk menggunakan SKU yang dibuat dengan format GEM-000001."}
          </p>
        </div>
      </div>

      {state.status === "error" ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-5">{state.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending} className="h-11 rounded-lg shadow-none">Batal</Button>
        <Button type="submit" disabled={pending} className="h-11 rounded-lg px-5 shadow-none">
          {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Menyimpan…</> : product ? "Simpan perubahan" : "Tambah produk"}
        </Button>
      </div>
    </form>
  );
}
