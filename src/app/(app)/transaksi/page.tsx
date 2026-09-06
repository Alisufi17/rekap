import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import TransaksiList from "@/components/TransaksiList";
import type { VTransaction } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const { userId, profile } = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <TransaksiList
      transactions={(data ?? []) as VTransaction[]}
      currentUserId={userId}
      isAdmin={isAdmin(profile)}
      initialFilter={filter}
    />
  );
}
