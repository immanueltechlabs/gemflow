"use client";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LoaderCircle, LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const logout = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await signOut();
    if (result.error) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    window.location.replace("/login");
  };

  return (
    <>
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
      {errorMessage ? <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage}</p> : null}
    </>
  );
}
