import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresh sesi Supabase di setiap request dan redirect yang belum login ke
// /login. Tanpa ini, session token bisa kedaluwarsa di tengah pemakaian
// (Server Component tidak bisa menulis cookie sendiri, lihat server.ts).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Role "packing" (Hansen) cuma boleh lihat antrian kemas — jangan sampai
  // nyasar ke dashboard/transaksi/dll walau ketik URL-nya langsung. Ini
  // penjagaan tambahan di UI; batas keamanan sebenarnya ada di RLS
  // (0011_role_packing.sql), bukan di sini.
  if (user && !isLoginPage) {
    const isPackingPage = request.nextUrl.pathname.startsWith("/packing");
    if (!isPackingPage) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "packing") {
        const url = request.nextUrl.clone();
        url.pathname = "/packing";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  // api/integrations: server-to-server calls from wa-ai-cs, authenticated by
  // their own shared secret (see src/lib/integrations/auth.ts) - there is no
  // Supabase user session to redirect on the other end of that call.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/integrations).*)"],
};
