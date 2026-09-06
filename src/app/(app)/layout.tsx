import BottomNav from "@/components/BottomNav";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email } = await getCurrentProfile();

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
        <div className="text-lg font-extrabold text-ink">
          Rekap<span className="text-primary">.</span>
        </div>
        <div className="text-xs font-medium text-ink-soft">{email}</div>
      </div>
      <main className="px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
