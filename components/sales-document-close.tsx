"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SalesDocumentClose() {
  return (
    <Button type="button" variant="outline" onClick={() => window.close()}>
      <X aria-hidden="true" />
      Tutup Invoice
    </Button>
  );
}
