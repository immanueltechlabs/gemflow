"use server";

import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return { error: null };

    console.error("[GemFlow auth] Sign-out failed:", error);
    return { error: "Tidak dapat keluar. Silakan coba lagi." };
  } catch (error) {
    console.error("[GemFlow auth] Sign-out request failed:", error);
    return { error: "Tidak dapat keluar. Silakan coba lagi." };
  }
}
