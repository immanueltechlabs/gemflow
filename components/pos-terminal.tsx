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
import { ProductPhotoLightbox } from "@/components/product-photo-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { formatRupiah } from "@/lib/inventory";
import {
  initialPosActionState,
  paymentMethodLabels,
  paymentMethods,
  type PaymentMethod,
  type PosProduct,
  type SaleSuccessDetails,
} from "@/lib/pos";

function looksLikeSkuOrBarcode(value: string) {
  const normalized = value.trim();
  return /^[a-z0-9_-]+$/i.test(normalized) && /[0-9_-]/.test(normalized);
}

export function PosTerminal({
  defaultProducts,
  defaultProductsError,
}: {
  defaultProducts: PosProduct[];
  defaultProductsError: string;
}) {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchSequenceRef = useRef(0);
  const cartProductIdsRef = useRef(new Set<string>());
  const [actionState, formAction, pending] = useActionState(checkoutSale, initialPosActionState);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PosProduct[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [imageError, setImageError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [exactLookupFailed, setExactLookupFailed] = useState(false);
  const [cart, setCart] = useState<PosProduct[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [successDetailsState, setSuccessDetailsState] = useState<SaleSuccessDetails | null>(null);
  const [dismissActionSuccess, setDismissActionSuccess] = useState(false);
  const [dismissActionError, setDismissActionError] = useState(false);

  const subtotal = cart.reduce((sum, product) => sum + Number(product.selling_price ?? 0), 0);
  const discountAmount = Number(discountInput) || 0;
  const total = Math.max(0, subtotal - discountAmount);
  const amountPaid = Number(amountPaidInput) || 0;
  const change = Math.max(0, amountPaid - total);
  const discountInvalid = discountAmount < 0 || discountAmount > subtotal;
  const cashInsufficient = paymentMethod === "cash" && amountPaid < total;
  const checkoutDisabled = pending || cart.length === 0 || total <= 0 || discountInvalid || cashInsufficient;
  const showingDefaults = search.trim().length === 0;
  const visibleProducts = showingDefaults ? defaultProducts : searchResults;
  const successDetails = successDetailsState ?? (
    !dismissActionSuccess && actionState.status === "success" ? actionState : null
  );

  useEffect(() => {
    const query = search.trim();
    if (looksLikeSkuOrBarcode(query)) {
      setSearchResults([]);
      setSearchPending(false);
      setSearchError("");
      setImageError("");
      setSearchMessage("");
      return;
    }

    if (query.length < 3) {
      setSearchResults([]);
      setSearchPending(false);
      setSearchError("");
      setImageError("");
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
          setImageError(result.imageError ?? "");
          setSearchMessage(result.error || result.products.length ? "" : "Produk tidak ditemukan atau tidak tersedia.");
          setSearchPending(false);
        })
        .catch(() => {
          if (searchSequenceRef.current !== requestSequence) return;
          setSearchResults([]);
          setSearchError("Pencarian produk gagal. Coba lagi atau hubungi Admin.");
          setImageError("");
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
    if (actionState.status !== "success") return;

    setSuccessDetailsState({
      saleId: actionState.saleId,
      invoiceNumber: actionState.invoiceNumber,
      total: actionState.total,
      amountPaid: actionState.amountPaid,
      change: actionState.change,
      customerName: actionState.customerName,
    });
    setDismissActionSuccess(false);
    cartProductIdsRef.current.clear();
    setCart([]);
    setDiscountInput("0");
    setAmountPaidInput("");
    setCustomerName("");
    setNotes("");
    setSearch("");
    setSearchResults([]);
    setSearchError("");
    setImageError("");
    setSearchMessage("");
    setExactLookupFailed(false);
    setFeedback("");
  }, [actionState]);

  const startNewTransaction = () => {
    setSuccessDetailsState(null);
    setDismissActionSuccess(true);
    router.refresh();
    requestAnimationFrame(() => barcodeInputRef.current?.focus());
  };

  const cancelTransaction = () => {
    if (!window.confirm("Batalkan transaksi ini?")) return;

    cartProductIdsRef.current.clear();
    setCart([]);
    setDiscountInput("0");
    setPaymentMethod("cash");
    setAmountPaidInput("");
    setCustomerName("");
    setNotes("");
    setFeedback("");
    setDismissActionError(true);
  };

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
    setImageError("");
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
        setImageError(result.imageError ?? "");
        setExactLookupFailed(false);
        setSearch("");
      })
      .catch(() => {
        if (searchSequenceRef.current !== requestSequence) return;
        setSearchPending(false);
        setSearchError("Produk tidak dapat dicari. Coba lagi atau hubungi Admin.");
      });
  };

  if (successDetails) {
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-2xl items-center justify-center py-8">
        <section aria-labelledby="checkout-success-heading" className="w-full rounded-2xl border border-primary/25 bg-card p-5 shadow-lg sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CircleCheck aria-hidden="true" className="size-6" />
            </div>
            <div>
              <h2 id="checkout-success-heading" className="text-xl font-semibold tracking-tight">Penjualan berhasil</h2>
              <p className="mt-1 text-sm text-muted-foreground">Invoice {successDetails.invoiceNumber}</p>
            </div>
          </div>

          <dl className="mt-6 space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Total</dt><dd className="font-semibold tabular-nums">{formatRupiah(successDetails.total)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Uang diterima</dt><dd className="font-medium tabular-nums">{formatRupiah(successDetails.amountPaid)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Kembalian</dt><dd className="font-medium tabular-nums">{formatRupiah(successDetails.change)}</dd></div>
            {successDetails.customerName ? (
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pelanggan</dt><dd className="max-w-[65%] text-right font-medium">{successDetails.customerName}</dd></div>
            ) : null}
          </dl>

          <div className="no-print mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild className="h-11 w-full">
              <Link href={`/sales/${successDetails.saleId}/invoice`} target="_blank" rel="noopener noreferrer">Cetak Invoice</Link>
            </Button>
            <Button type="button" variant="secondary" className="h-11 w-full" onClick={startNewTransaction}>
              Transaksi Baru
            </Button>
          </div>
        </section>
      </div>
    );
  }

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
                setImageError("");
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
              : searchError || imageError || (exactLookupFailed
                ? "Produk tidak ditemukan atau tidak tersedia."
                : looksLikeSkuOrBarcode(search)
                  ? "Tekan Enter untuk memindai SKU/barcode."
                  : searchMessage || (searchResults.length
                    ? `${searchResults.length} hasil pencarian`
                    : showingDefaults
                      ? "Produk tersedia terbaru"
                      : "Pindai barcode/SKU atau ketik minimal 3 karakter nama produk")))}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {showingDefaults ? `${defaultProducts.length} produk` : `${searchResults.length} hasil`}
          </span>
        </div>

        <div className="max-h-[62svh] min-h-72 overflow-y-auto xl:max-h-[calc(100svh-21rem)]">
          {searchPending ? (
            <div role="status" className="flex min-h-72 items-center justify-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />Mencari produk
            </div>
          ) : visibleProducts.length ? (
            <ul className="divide-y px-4 sm:px-5">
              {visibleProducts.map((product) => {
                const alreadyAdded = cart.some((item) => item.id === product.id);
                return (
                  <li key={product.id} className="grid min-h-[84px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 sm:flex sm:gap-3">
                    <div className="row-span-2 sm:row-auto">
                      <ProductPhotoLightbox productId={product.id} productName={product.name} sku={product.sku} imagePath={product.image_path} thumbnailSrc={product.image_url} className="size-14" />
                    </div>
                    <div className="min-w-0 sm:flex-1">
                      <p className="truncate text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {product.sku}{product.category ? ` · ${product.category}` : ""}
                      </p>
                    </div>
                    <p className="col-start-2 text-sm font-semibold tabular-nums sm:ml-auto sm:shrink-0 sm:text-right">
                      {formatRupiah(product.selling_price)}
                    </p>
                    <Button
                      type="button"
                      variant={alreadyAdded ? "secondary" : "outline"}
                      disabled={alreadyAdded}
                      onClick={() => addProduct(product)}
                      aria-label={alreadyAdded ? `${product.name} sudah di keranjang` : `Tambahkan ${product.name}`}
                      title={alreadyAdded ? "Sudah di keranjang" : "Tambahkan ke keranjang"}
                      className="col-start-3 row-span-2 h-11 shrink-0 gap-1.5 px-3 sm:row-auto"
                    >
                      {alreadyAdded ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                      {alreadyAdded ? "Di keranjang" : "Tambah"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              {searchError || (showingDefaults && defaultProductsError)
                ? <CircleAlert aria-hidden="true" className="size-6 text-destructive" />
                : <Search aria-hidden="true" className="size-6 text-muted-foreground" />}
              <p className="mt-3 font-medium">
                {searchError || (showingDefaults && defaultProductsError)
                  ? "Pencarian produk belum berhasil"
                  : exactLookupFailed || searchMessage
                    ? "Produk tidak ditemukan"
                    : showingDefaults
                      ? "Belum ada produk tersedia"
                      : looksLikeSkuOrBarcode(search)
                        ? "SKU/barcode siap dipindai"
                        : search.trim().length < 3
                          ? "Ketik minimal 3 karakter"
                          : "Produk tidak ditemukan"}
              </p>
              <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
                {searchError || (showingDefaults && defaultProductsError) || (exactLookupFailed
                  ? "Produk tidak ditemukan atau tidak tersedia."
                  : searchMessage || (looksLikeSkuOrBarcode(search)
                    ? "Tekan Enter untuk memindai SKU/barcode."
                    : showingDefaults
                      ? defaultProductsError || "Produk yang tersedia akan muncul di sini."
                      : looksLikeSkuOrBarcode(search)
                        ? "Tekan Enter untuk memindai barcode/SKU."
                        : search.trim().length < 3
                          ? "Masukkan minimal 3 karakter nama produk untuk mencari."
                          : "Tidak ada produk tersedia yang cocok dengan pencarian ini."))}
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

        <form
          action={formAction}
          onSubmit={() => setDismissActionError(false)}
        >
          <input type="hidden" name="product_ids" value={JSON.stringify(cart.map((product) => product.id))} />
          <input type="hidden" name="discount_amount" value={discountAmount} />
          <input type="hidden" name="amount_paid" value={paymentMethod === "cash" ? amountPaidInput : total} />

          <div className="max-h-64 min-h-28 overflow-y-auto px-4 sm:px-5">
            {cart.length ? (
              <ul className="divide-y">
                {cart.map((product) => (
                  <li key={product.id} className="flex min-h-[76px] items-center gap-3 py-3">
                    <ProductPhotoLightbox productId={product.id} productName={product.name} sku={product.sku} imagePath={product.image_path} thumbnailSrc={product.image_url} className="size-12" />
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
                className="h-11 w-36 text-right tabular-nums"
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

            {actionState.status === "error" && !dismissActionError ? (
              <div role="alert" className="flex gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>{actionState.message}</p>
              </div>
            ) : null}

            {cart.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={cancelTransaction}
                  className="h-12 w-full"
                >
                  Batalkan transaksi
                </Button>
                <Button
                  type="submit"
                  disabled={checkoutDisabled}
                  className="h-12 w-full text-base"
                >
                  {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Memproses transaksi</> : <><Check aria-hidden="true" />Selesaikan penjualan</>}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={checkoutDisabled}
                className="h-12 w-full text-base"
              >
                {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Memproses transaksi</> : <><Check aria-hidden="true" />Selesaikan penjualan</>}
              </Button>
            )}
          </div>
        </form>
      </section>

    </div>
  );
}