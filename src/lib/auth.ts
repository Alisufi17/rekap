import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

// Dipanggil dari Server Component. Middleware sudah menjamin ada session
// (redirect ke /login kalau tidak), jadi di sini user dianggap pasti ada.
export async function getCurrentProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("getCurrentProfile dipanggil tanpa session — cek middleware.ts");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { userId: user.id, email: user.email ?? null, profile };
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}
