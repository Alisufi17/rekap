import { createClient } from "@/lib/supabase/server";
import { localDateStr } from "@/lib/format";
import KalenderClient from "@/components/KalenderClient";
import type { VDailySales } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function KalenderPage() {
  const supabase = await createClient();

  // 400 hari ke belakang cukup untuk navigasi ~13 bulan tanpa perlu
  // round-trip baru ke server tiap ganti bulan (navigasi bulan murni di
  // client, lihat KalenderClient).
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 400);

  const { data } = await supabase
    .from("v_daily_sales")
    .select("*")
    .gte("tanggal", localDateStr(windowStart))
    .order("tanggal", { ascending: true });

  return <KalenderClient dailySales={(data ?? []) as VDailySales[]} />;
}
