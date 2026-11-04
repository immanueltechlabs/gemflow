"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

import { getProductPhotoPreviewUrl } from "@/app/product-images/actions";
import { ProductPhoto } from "@/components/product-photo";

const minZoom = 1;
const maxZoom = 3;
const zoomStep = 0.5;

export function ProductPhotoLightbox({
  productId,
  productName,
  sku,
  imagePath,
  thumbnailSrc,
  className,
}: {
  productId: string;
  productName: string;
  sku?: string | null;
  imagePath: string | null;
  thumbnailSrc: string | null | undefined;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);
  const titleId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(minZoom);

  const closePreview = () => {
    requestIdRef.current += 1;
    dialogRef.current?.close();
    setPreviewUrl(null);
    setLoading(false);
    setError("");
    setZoom(minZoom);
  };

  const openPreview = async () => {
    if (!imagePath || !thumbnailSrc) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setPreviewUrl(null);
    setError("");
    setZoom(minZoom);
    setLoading(true);
    dialogRef.current?.showModal();
    closeButtonRef.current?.focus();

    try {
      const result = await getProductPhotoPreviewUrl(productId, imagePath);
      if (requestId !== requestIdRef.current) return;

      setLoading(false);
      if (result.error || !result.url) {
        setError(result.error ?? "Foto produk tidak dapat dimuat. Silakan coba lagi.");
        return;
      }
      setPreviewUrl(result.url);
    } catch (previewError) {
      if (requestId !== requestIdRef.current) return;
      console.error("[GemFlow Product Photo] Preview request failed.", previewError);
      setLoading(false);
      setError("Foto produk tidak dapat dimuat. Silakan coba lagi.");
    }
  };

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closePreview();
  };

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) closePreview();
  };

  if (!thumbnailSrc || !imagePath) {
    return <ProductPhoto src={thumbnailSrc} alt={`Foto ${productName}`} className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        aria-label={`Perbesar foto ${productName}`}
        title="Lihat foto lebih besar"
        className="group rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ProductPhoto
          src={thumbnailSrc}
          alt={`Foto ${productName}`}
          className={`${className ?? ""} transition-shadow group-hover:shadow-md`}
        />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={handleCancel}
        onClick={handleDialogClick}
        className="m-auto max-h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/65"
      >
        <div className="flex max-h-[calc(100svh-1.5rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate font-semibold">{productName}</h2>
              {sku ? <p className="mt-0.5 truncate text-sm text-muted-foreground">SKU {sku}</p> : null}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closePreview}
              aria-label="Tutup foto"
              title="Tutup"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3 sm:p-5">
            <div className="relative h-[min(68svh,52rem)] w-full overflow-auto rounded-xl bg-muted/30">
              {loading ? (
                <div role="status" className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Memuat foto...
                </div>
              ) : error ? (
                <div role="alert" className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : previewUrl ? (
                <div
                  className="relative mx-auto grid min-h-full place-items-center transition-[width,height] duration-200 motion-reduce:transition-none"
                  style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                >
                  <div className="relative size-full">
                    <Image
                      src={previewUrl}
                      alt={`Foto produk ${productName}`}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 92vw, 1100px"
                      className="object-contain"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div role="group" className="flex min-h-11 items-center justify-center gap-2" aria-label="Kontrol zoom foto">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(minZoom, value - zoomStep))}
                disabled={!previewUrl || zoom <= minZoom}
                aria-label="Perkecil foto"
                title="Perkecil"
                className="flex size-11 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <span className="min-w-14 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(maxZoom, value + zoomStep))}
                disabled={!previewUrl || zoom >= maxZoom}
                aria-label="Perbesar foto"
                title="Perbesar"
                className="flex size-11 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(minZoom)}
                disabled={!previewUrl || zoom === minZoom}
                aria-label="Atur ulang zoom"
                title="Atur ulang zoom"
                className="ml-1 flex size-11 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
