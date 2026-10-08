"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

import { cn } from "@/lib/utils";

export function Barcode({
  value,
  className,
  compact = false,
}: {
  value: string;
  className?: string;
  compact?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: !compact,
      background: "transparent",
      lineColor: "#111a16",
      width: compact ? 1.15 : 1.55,
      height: compact ? 25 : 46,
      margin: 0,
      fontSize: 13,
      fontOptions: "bold",
    });
  }, [compact, value]);

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`Barcode Code 128 ${value}`}
      className={cn("max-w-full", className)}
    />
  );
}
