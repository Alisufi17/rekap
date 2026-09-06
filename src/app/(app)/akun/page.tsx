import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { logout } from "@/app/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AkunPage() {
  const { email, profile } = await getCurrentProfile();
  const supabase = await createClient();
  const [{ count: productCount }, { count: txCount }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-white p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.1-3-3L3 17.6" />
          </svg>
        </div>
        <div className="text-base font-extrabold">{email}</div>
        <div className="mt-1 inline-block rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
          {isAdmin(profile) ? "Admin" : "Staff"}
        </div>
        <div className="mt-2 text-xs text-ink-soft">
          Data tersinkron ke semua anggota tim secara real-time
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-3.5 text-sm">
        <div className="flex justify-between border-b border-border py-2">
          <span>Total produk</span>
          <span className="font-semibold">{productCount ?? 0}</span>
        </div>
        <div className="flex justify-between py-2">
          <span>Total transaksi</span>
          <span className="font-semibold">{txCount ?? 0}</span>
        </div>
      </div>

      <Link
        href="/pelanggan"
        className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
      >
        Database Pelanggan &amp; WA
      </Link>

      {isAdmin(profile) && (
        <>
          <Link
            href="/keuangan"
            className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
          >
            Biaya Operasional &amp; Target
          </Link>
          <Link
            href="/dashboard/iklan"
            className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
          >
            Input Iklan Harian
          </Link>
        </>
      )}

      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg border border-border bg-white py-2.5 text-sm font-medium text-accent"
        >
          Keluar
        </button>
      </form>
    </div>
  );
}
