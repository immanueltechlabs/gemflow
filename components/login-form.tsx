"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Tidak dapat masuk. Periksa kembali email dan kata sandi Anda.");
      setIsLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">Alamat email</Label>
        <div className="relative">
          <Mail aria-hidden="true" className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@company.com" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-lg border-border/80 bg-background pl-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">Kata sandi</Label>
        <div className="relative">
          <LockKeyhole aria-hidden="true" className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-lg border-border/80 bg-background px-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword}>
            {showPassword ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
          </button>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error ? <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <Button type="submit" className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary/90" disabled={isLoading}>
        {isLoading ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Sedang masuk…</> : "Masuk"}
      </Button>
    </form>
  );
}
