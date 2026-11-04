"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function ProductPhotoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center">
        <ImageIcon aria-hidden="true" className="size-5 text-muted-foreground/70" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="96px"
      loading="lazy"
      decoding="async"
      unoptimized
      onError={() => setFailed(true)}
      className="object-contain p-1"
    />
  );
}

export function ProductPhoto({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50", className)}>
      {src ? (
        <ProductPhotoImage key={src} src={src} alt={alt} />
      ) : (
        <span role="img" aria-label={alt} className="flex items-center justify-center">
          <ImageIcon aria-hidden="true" className="size-5 text-muted-foreground/70" />
        </span>
      )}
    </div>
  );
}
