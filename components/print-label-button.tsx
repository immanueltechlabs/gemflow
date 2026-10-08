"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function PrintLabelControls() {
  const router = useRouter();

  return (
    <div className="no-print fixed inset-x-0 top-0 flex h-16 items-center justify-between border-b bg-background px-5">
      <Button type="button" variant="ghost" onClick={() => router.back()} className="h-11">
        <ArrowLeft aria-hidden="true" />Kembali
      </Button>
      <Button type="button" onClick={() => window.print()} className="h-11 shadow-none">
        <Printer aria-hidden="true" />Cetak label
      </Button>
    </div>
  );
}
