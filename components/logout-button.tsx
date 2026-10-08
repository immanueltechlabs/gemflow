"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const logout = async () => {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={logout}
      disabled={isLoading}
      className={compact ? "size-11 p-0" : "h-11 w-full justify-start px-3 text-muted-foreground hover:text-foreground"}
      aria-label={compact ? "Keluar" : undefined}
    >
      {isLoading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <LogOut aria-hidden="true" />}
      {compact ? null : <span>{isLoading ? "Sedang keluar…" : "Keluar"}</span>}
    </Button>
  );
}
