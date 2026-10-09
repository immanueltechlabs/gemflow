"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import { checkoutSale, findAvailableProduct, searchAvailableProducts } from "@/app/pos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/inventory";
import {
  initialPosActionState,
  paymentMethodLabels,
  paymentMethods,
  type PaymentMethod,
  type PosProduct,
  type SaleReceipt,
} from "@/lib/pos";

function looksLikeSkuOrBarcode(value: string) {
  const normalized = value.trim();
  return /^[a-z0-9_-]+$/i.test(normalized) && /[0-9_-]/.test(normalized);
}

export function PosTerminal() {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchSequenceRef = useRef(0);
  const cartProductIdsRef = useRef(new Set<string>());
  const [actionState, formAction, pending] = useActionState(checkoutSale, initialPosActionState);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PosProduct[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [exactLookupFailed, setExactLookupFailed] = useState(false);
  const [cart, setCart] = useState<PosProduct[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  const subtotal = cart.reduce((sum, product) => sum + Number(product.selling_price ?? 0), 0);
  const discountAmount = Number(discountInput) || 0;
  const total = Math.max(0, subtotal - discountAmount);
  const amountPaid = Number(amountPaidInput) || 0;
  const change = Math.max(0, amountPaid - total);
  const discountInvalid = discountAmount < 0 || discountAmount > subtotal;
  const cashInsufficient = paymentMethod === "cash" && amountPaid < total;

  useEffect(() => {
    const query = search.trim();
    if (looksLikeSkuOrBarcode(query)) {
      setSearchResults([]);
      setSearchPending(false);
      setSearchError("");
      setSearchMessage("");
      return;
    }

    if (query.length < 3) {
      setSearchResults([]);
      setSearchPending(false);
      setSearchError("");
      setSearchMessage("");
      return;
    }

    const requestSequence = ++searchSequenceRef.current;
    const timeoutId = window.setTimeout(() => {
      setSearchPending(true);
      void searchAvailableProducts(query)
        .then((result) => {
          if (searchSequenceRef.current !== requestSequence) return;
          setSearchResults(result.products);
          setSearchError(result.error ?? "");
          setSearchMessage(result.error || result.products.length ? "" : "Produk tidak ditemukan atau tidak tersedia.");
          setSearchPending(false);
        })
        .catch(() => {
          if (searchSequenceRef.current !== requestSequence) return;
          setSearchResults([]);
          setSearchError("Pencarian produk gagal. Coba lagi atau hubungi Admin.");
          setSearchMessage("");
          setSearchPending(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      if (searchSequenceRef.current === requestSequence) searchSequenceRef.current += 1;
    };
  }, [search]);

  useEffect(() => {
    if (actionState.status !== "success" || !actionState.receipt) return;

    setReceipt(actionState.receipt);
    cartProductIdsRef.current.clear();
    setCart([]);
    setDiscountInput("0");
    setAmountPaidInput("");
    setCustomerName("");
    setNotes("");
    setSearch("");
    setSearchResults([]);
    setSearchError("");
    setSearchMessage("");
    setExactLookupFailed(false);
    setFeedback("");
    router.refresh();
    barcodeInputRef.current?.focus();
  }, [actionState, router]);

  const addProduct = (product: PosProduct) => {
    if (cartProductIdsRef.current.has(product.id)) {
      setFeedback(`${product.sku} sudah ada di keranjang.`);
      return;
    }
    cartProductIdsRef.current.add(product.id);
    setCart((items) => [...items, product]);
    setFeedback(`${product.sku} ditambahkan ke keranjang.`);
  };

  const handleBarcodeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const scannedValue = event.currentTarget.value.trim().slice(0, 100);
    if (!scannedValue) return;

    const requestSequence = ++searchSequenceRef.current;
    setSearchPending(true);
    setSearchResults([]);
    setSearchError("");
    setSearchMessage("");
    setFeedback("");
    void findAvailableProduct(scannedValue)
      .then((result) => {
        if (searchSequenceRef.current !== requestSequence) return;
        setSearchPending(false);
        if (result.error) {
          setSearchError(result.error);
          return;
        }
        if (!result.product) {
          setExactLookupFailed(true);
          return;
        }
        addProduct(result.product);
        setExactLookupFailed(false);
        setSearch("");
      })
      .catch(() => {
        if (searchSequenceRef.current !== requestSequence) return;
        setSearchPending(false);
        setSearchError("Produk tidak dapat dicari. Coba lagi atau hubungi Admin.");
      });
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(370px,0.9fr)]">
      <section aria-labelledby="products-heading" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 id="products-heading" className="font-semibold">Pilih produk</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cari produk tersedia tanpa memuat seluruh katalog.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Barcode aria-hidden="true" className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-primary" />
            <Input
              ref={barcodeInputRef}
              autoFocus
              value={search}
              onChange={(event) => {
                searchSequenceRef.current += 1;
                setSearch(event.target.value);
                setSearchResults([]);
                setSearchError("");
                setSearchMessage("");
                setExactLookupFailed(false);
                setFeedback("");
                setSearchPending(false);
              }}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="Pindai barcode, SKU, atau cari nama"
              aria-label="Pindai barcode atau cari produk"
              className="h-11 rounded-lg pl-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </div>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3 border-b bg-muted/25 px-4 py-2.5 text-sm sm:px-5">
          <span role="status" aria-live="polite" className="min-w-0 truncate text-muted-foreground">
            {feedback || (searchPending
              ? "Mencari produk..."
              : searchError || (exactLookupFailed
                ? "Produk tidak ditemukan atau tidak tersedia."
                : looksLikeSkuOrBarcode(search)
                  ? "Tekan Enter untuk memindai SKU/barcode."
                  : searchMessage || (searchResults.length
                    ? `${searchResults.length} hasil pencarian`
                    : "Pindai barcode/SKU atau ketik minimal 3 karakter nama produk")))}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{searchResults.length} hasil</span>
        </div>

        <div className="max-h-[62svh] min-h-72 overflow-y-auto xl:max-h-[calc(100svh-21rem)]">
          {searchPending ? (
            <div role="status" className="flex min-h-72 items-center justify-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />Mencari produk
            </div>
          ) : searchResults.length ? (
            <ul className="divide-y px-4 sm:px-5">
              {searchResults.map((product) => {
                const alreadyAdded = cart.some((item) => item.id === product.id);
                return (
                  <li key={product.id} className="flex min-h-[84px] items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {product.sku}{product.category ? ` · ${product.category}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatRupiah(product.selling_price)}
                    </p>
                    <Button
                      type="button"
                      variant={alreadyAdded ? "secondary" : "outline"}
                      size="icon"
                      disabled={alreadyAdded}
                      onClick={() => addProduct(product)}
                      aria-label={alreadyAdded ? `${product.name} sudah di keranjang` : `Tambahkan ${product.name}`}
                      title={alreadyAdded ? "Sudah di keranjang" : "Tambahkan ke keranjang"}
                      className="size-11 shrink-0"
                    >
                      {alreadyAdded ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              {searchError ? <CircleAlert aria-hidden="true" className="size-6 text-destructive" /> : <Search aria-hidden="true" className="size-6 text-muted-foreground" />}
              <p className="mt-3 font-medium">
                {searchError
                  ? "Pencarian produk belum berhasil"
                  : exactLookupFailed || searchMessage
                    ? "Produk tidak ditemukan"
                    : looksLikeSkuOrBarcode(search)
                      ? "SKU/barcode siap dipindai"
                      : "Pindai atau cari produk"}
              </p>
              <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
                {searchError || (exactLookupFailed
                  ? "Produk tidak ditemukan atau tidak tersedia."
                  : searchMessage || (looksLikeSkuOrBarcode(search)
                    ? "Tekan Enter untuk memindai SKU/barcode."
                    : "Tekan Enter setelah memindai barcode/SKU, atau ketik nama produk untuk mencari."))}
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="cart-heading" className="overflow-hidden rounded-xl border bg-card xl:sticky xl:top-24">
        <div className="flex items-center justify-between border-b p-4 sm:p-5">
          <div>
            <h2 id="cart-heading" className="font-semibold">Keranjang</h2>
            <p className="mt-1 text-sm text-muted-foreground">{cart.length} produk</p>
          </div>
          <ShoppingCart aria-hidden="true" className="size-5 text-primary" />
        </div>

        <form action={formAction}>
          <input type="hidden" name="product_ids" value={JSON.stringify(cart.map((product) => product.id))} />
          <input type="hidden" name="discount_amount" value={discountAmount} />
          <input type="hidden" name="amount_paid" value={paymentMethod === "cash" ? amountPaidInput : total} />

          <div className="max-h-64 min-h-28 overflow-y-auto px-4 sm:px-5">
            {cart.length ? (
              <ul className="divide-y">
                {cart.map((product) => (
                  <li key={product.id} className="flex min-h-[76px] items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatRupiah(product.selling_price)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        cartProductIdsRef.current.delete(product.id);
                        setCart((items) => items.filter((item) => item.id !== product.id));
                      }}
                      aria-label={`Hapus ${product.name} dari keranjang`}
                      title="Hapus produk"
                      className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShoppingCart aria-hidden="true" className="size-4" />
                Keranjang masih kosong
              </div>
            )}
          </div>

          <div className="space-y-3 border-t px-4 py-4 sm:px-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="pos-discount" className="text-sm text-muted-foreground">Diskon</label>
              <Input
                id="pos-discount"
                type="number"
                inputMode="numeric"
                min="0"
                max={subtotal}
                step="1000"
                value={discountInput}
                onChange={(event) => setDiscountInput(event.target.value)}
                aria-invalid={discountInvalid}
                className="h-10 w-36 text-right tabular-nums"
              />
            </div>
            {discountInvalid ? <p className="text-right text-xs text-destructive">Diskon tidak boleh melebihi subtotal.</p> : null}
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-semibold tabular-nums">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="space-y-4 border-t px-4 py-4 sm:px-5">
            <div className="space-y-2">
              <label htmlFor="pos-payment-method" className="text-sm font-medium">Metode pembayaran</label>
              <select
                id="pos-payment-method"
                name="payment_method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{paymentMethodLabels[method]}</option>
                ))}
              </select>
            </div>

            {paymentMethod === "cash" ? (
              <div className="space-y-2">
                <label htmlFor="pos-amount-paid" className="text-sm font-medium">Uang diterima</label>
                <Input
                  id="pos-amount-paid"
                  type="number"
                  inputMode="numeric"
                  min={total}
                  step="1000"
                  value={amountPaidInput}
                  onChange={(event) => setAmountPaidInput(event.target.value)}
                  placeholder="Masukkan jumlah uang"
                  aria-invalid={cashInsufficient && amountPaidInput !== ""}
                  className="h-11 tabular-nums"
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span className="font-medium tabular-nums">{formatRupiah(change)}</span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="pos-customer" className="text-sm font-medium">Nama pelanggan <span className="font-normal text-muted-foreground">(opsional)</span></label>
                <Input
                  id="pos-customer"
                  name="customer_name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={120}
                  placeholder="Nama pelanggan"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pos-notes" className="text-sm font-medium">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></label>
                <Input
                  id="pos-notes"
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  placeholder="Catatan transaksi"
                  className="h-11"
                />
              </div>
            </div>

            {actionState.status === "error" ? (
              <div role="alert" className="flex gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>{actionState.message}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={pending || cart.length === 0 || discountInvalid || cashInsufficient}
              className="h-12 w-full text-base"
            >
              {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Memproses transaksi</> : <><Check aria-hidden="true" />Selesaikan penjualan</>}
            </Button>
          </div>
        </form>
      </section>

      {receipt ? (
        <section aria-labelledby="receipt-heading" className="flex gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] p-4 sm:p-5 xl:col-start-2">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 id="receipt-heading" className="font-semibold">Transaksi berhasil</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">Invoice {receipt.invoiceNumber}</p>
            <div className="mt-3 flex justify-between gap-4 text-sm">
              <span>Total</span><span className="font-semibold tabular-nums">{formatRupiah(receipt.total)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-4 text-sm">
              <span>Kembalian</span><span className="font-medium tabular-nums">{formatRupiah(receipt.change)}</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}