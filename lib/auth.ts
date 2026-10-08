import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "cashier";

export type CurrentProfile = {
  userId: string;
  fullName: string;
  role: UserRole;
};

function logProfileDiagnostic(
  userId: string,
  error: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  } | null,
  profileId?: string,
) {
  if (process.env.NODE_ENV === "production") return;

  console.error(
    `[GemFlow auth] Profile lookup diagnostic ${JSON.stringify({
      authenticatedUserId: userId,
      profileId: profileId ?? null,
      idsMatch: profileId ? profileId === userId : null,
      error: error
        ? {
            code: error.code ?? "unknown",
            message: error.message ?? "Kesalahan Supabase tidak diketahui",
            details: error.details ?? null,
            hint: error.hint ?? null,
          }
        : null,
    })}`,
  );
}

export async function getCurrentProfile(): Promise<CurrentProfile> {
  noStore();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (authError || !userId) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .single();

  if (profileError) {
    logProfileDiagnostic(userId, profileError);
    throw new Error("Profil pengguna yang masuk tidak dapat dimuat.");
  }

  if (!profile) {
    logProfileDiagnostic(userId, {
      code: "PROFILE_NOT_FOUND",
      message: "Kueri profil tidak mengembalikan data maupun kesalahan Supabase.",
    });
    throw new Error("Profil pengguna yang masuk tidak dapat dimuat.");
  }

  if (profile.id !== userId) {
    logProfileDiagnostic(userId, null, profile.id);
    throw new Error("Profil pengguna tidak sesuai dengan pengguna yang terautentikasi.");
  }

  if (profile.is_active !== true) {
    throw new Error("Akun GemFlow ini tidak aktif.");
  }

  if (profile.role !== "admin" && profile.role !== "cashier") {
    throw new Error("Peran pengguna tidak didukung.");
  }

  return {
    userId,
    fullName: profile.full_name?.trim() || "Pengguna GemFlow",
    role: profile.role,
  };
}
