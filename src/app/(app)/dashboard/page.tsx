import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { localDateStr } from "@/lib/format";
import DashboardClient from "@/components/DashboardClient";
import type { VTransaction, DailyMetric, VMonthlyPnl, Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const { profile } = await getCurrentProfile();
  const admin = isAdmin(profile);
  const supabase = await createClient();

  // 400 hari ke belakang: cukup untuk preset rolling (7/30 hari, bulan
  // ini/lalu) maupun rentang kustom yang dipilih dari halaman Kalender,
  // semua dihitung ulang di client tanpa round-trip baru ke server.
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 400);
  const windowStartStr = localDateStr(windowStart);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = localDateStr(monthStart);

  const [txRes, metricsRes, productsRes, pnlRes] = await Promise.all([
    supabase
      .from("v_transactions")
      .select("*")
      .gte("tanggal", windowStartStr)
      .order("tanggal", { ascending: false }),
    supabase.from("daily_metrics").select("*").gte("tanggal", windowStartStr),
    supabase.from("products").select("*").order("nama"),
    supabase.from("v_monthly_pnl").select("*").eq("bulan", monthStartStr).maybeSingle(),
  ]);

  const transactions = (txRes.data ?? []) as VTransaction[];
  const dailyMetrics = (metricsRes.data ?? []) as DailyMetric[];
  const products = (productsRes.data ?? []) as Product[];
  const monthlyPnl = (pnlRes.data ?? null) as VMonthlyPnl | null;
  const lowStockProducts = products.filter((p) => (p.stok ?? 0) <= 3);

  return (
    <DashboardClient
      transactions={transactions}
      dailyMetrics={dailyMetrics}
      monthlyPnl={monthlyPnl}
      isAdmin={admin}
      lowStockProducts={lowStockProducts}
      initialFrom={from}
      initialTo={to}
    />
  );
}
