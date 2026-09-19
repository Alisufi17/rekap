import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/app/actions";

export default async function PackingLayout({ children }: { children: React.ReactNode }) {
  const { email } = await getCurrentProfile();

  return (
    <div className="mx-auto max-w-md pb-10 lg:max-w-2xl">
      <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
        <div className="text-lg font-extrabold text-ink">
          Rekap<span className="text-primary">.</span>{" "}
          <span className="text-sm font-semibold text-ink-soft">Packing</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-ink-soft">{email}</div>
          <form action={logout}>
            <button type="submit" className="text-xs font-semibold text-accent">
              Keluar
            </button>
          </form>
        </div>
      </div>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
