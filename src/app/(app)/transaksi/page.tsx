import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { localDateStr } from "@/lib/format";
import TransaksiList from "@/components/TransaksiList";
import type { Product, VTransaction } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();

  // Jendela 400 hari, sama seperti Dashboard & Kalender — filter tanggal
  // (Hari Ini/Kemarin/7 Hari/dst) dihitung ulang di client dari data yang
  // sama, tanpa round-trip baru tiap ganti filter.
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 400);

  const [{ data }, { data: products }] = await Promise.all([
    supabase
      .from("v_transactions")
      .select("*")
      .gte("tanggal", localDateStr(windowStart))
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("nama"),
  ]);

  return (
    <TransaksiList
      transactions={(data ?? []) as VTransaction[]}
      products={(products ?? []) as Product[]}
      isAdmin={isAdmin(profile)}
      initialFilter={filter}
    />
  );
}
