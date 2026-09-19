import AppShell from "@/components/AppShell";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email, profile } = await getCurrentProfile();

  return (
    <AppShell email={email} isAdmin={isAdmin(profile)}>
      {children}
    </AppShell>
  );
}
