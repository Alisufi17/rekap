"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { logout } from "@/app/actions";

// Lebar konten di desktop per halaman. Halaman yang tidak terdaftar (form,
// akun, dll) tetap sempit supaya input tidak melebar konyol di layar besar.
const PAGE_WIDTH: Record<string, string> = {
  "/dashboard": "lg:max-w-[1600px]",
  "/transaksi": "lg:max-w-[1400px]",
  "/keuangan": "lg:max-w-5xl",
  "/kalender": "lg:max-w-3xl",
  "/pelanggan": "lg:max-w-3xl",
  "/produk": "lg:max-w-3xl",
};

const PAGE_TITLE: Record<string, string> = {
  "/dashboard": "Dasbor",
  "/transaksi": "Transaksi",
  "/transaksi/tambah": "Tambah Transaksi",
  "/produk": "Produk",
  "/kalender": "Kalender Harian",
  "/pelanggan": "Database Pelanggan",
  "/keuangan": "Keuangan",
  "/dashboard/iklan": "Input Iklan Harian",
  "/akun": "Akun",
};

type Item = { href: string; label: string; icon: React.ReactNode };

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    {children}
  </svg>
);

const ITEMS: Item[] = [
  {
    href: "/dashboard",
    label: "Dasbor",
    icon: svg(
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  { href: "/transaksi", label: "Transaksi", icon: svg(<path d="M3 6h18M3 12h18M3 18h18" />) },
  {
    href: "/produk",
    label: "Produk",
    icon: svg(
      <>
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
      </>
    ),
  },
  {
    href: "/kalender",
    label: "Kalender",
    icon: svg(
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </>
    ),
  },
  {
    href: "/pelanggan",
    label: "Pelanggan",
    icon: svg(
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 4.5a3.5 3.5 0 010 7M22 20c0-2.5-1.5-4.2-4-5" />
      </>
    ),
  },
];

const ADMIN_ITEMS: Item[] = [
  {
    href: "/keuangan",
    label: "Keuangan",
    icon: svg(
      <>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
  },
  {
    href: "/dashboard/iklan",
    label: "Input Iklan",
    icon: svg(<path d="M3 11v3a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8" />),
  },
];

const AKUN_ITEM: Item = {
  href: "/akun",
  label: "Akun",
  icon: svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
};

export default function AppShell({
  email,
  isAdmin,
  children,
}: {
  email: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const width = PAGE_WIDTH[pathname] ?? "lg:max-w-xl";
  const title = PAGE_TITLE[pathname];

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-white lg:flex">
        <div className="px-5 py-5 text-xl font-extrabold text-ink">
          Rekap<span className="text-primary">.</span>
        </div>

        <div className="px-3">
          <Link
            href="/transaksi/tambah"
            className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <span className="text-lg leading-none">+</span> Tambah Transaksi
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {ITEMS.map((i) => (
            <SideLink key={i.href} item={i} active={pathname === i.href} />
          ))}
          {isAdmin && (
            <>
              <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Admin
              </div>
              {ADMIN_ITEMS.map((i) => (
                <SideLink key={i.href} item={i} active={pathname === i.href} />
              ))}
            </>
          )}
        </nav>

        <div className="space-y-0.5 border-t border-border px-3 py-3">
          <SideLink item={AKUN_ITEM} active={pathname === AKUN_ITEM.href} />
          <div className="truncate px-3 pt-2 text-xs text-ink-soft">{email}</div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-accent/5"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="mx-auto max-w-md lg:ml-60 lg:max-w-none">
        <header className="flex items-center justify-between border-b border-border bg-white px-5 py-4 lg:hidden">
          <div className="text-lg font-extrabold text-ink">
            Rekap<span className="text-primary">.</span>
          </div>
          <div className="text-xs font-medium text-ink-soft">{email}</div>
        </header>

        <main className="px-4 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-10">
          <div className={width}>
            {title && (
              <h1 className="mb-5 hidden text-2xl font-extrabold text-ink lg:block">{title}</h1>
            )}
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface hover:text-ink"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}
