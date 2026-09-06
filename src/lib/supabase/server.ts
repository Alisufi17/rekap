import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Dipakai di Server Components, Route Handlers, dan Server Actions saja.
// Untuk Client Components pakai src/lib/supabase/client.ts.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component (bukan Server Action/Route
            // Handler) — tidak bisa set cookie di sini. Aman diabaikan
            // selama middleware.ts sudah menangani refresh sesi.
          }
        },
      },
    }
  );
}
