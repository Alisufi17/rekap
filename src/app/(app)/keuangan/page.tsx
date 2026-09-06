import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { localDateStr } from "@/lib/format";
import KeuanganClient from "@/components/KeuanganClient";
import type { ExpenseCategory, OperatingExpense, MonthlyTarget, VMonthlyPnl } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function KeuanganPage() {
  const { profile } = await getCurrentProfile();
  if (!isAdmin(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = localDateStr(monthStart);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const [catRes, expRes, targetRes, pnlRes] = await Promise.all([
    supabase.from("expense_categories").select("*").eq("aktif", true).order("urutan"),
    supabase
      .from("operating_expenses")
      .select("*")
      .gte("tanggal", monthStartStr)
      .lt("tanggal", localDateStr(monthEnd))
      .order("tanggal", { ascending: false }),
    supabase.from("monthly_targets").select("*").eq("bulan", monthStartStr).maybeSingle(),
    supabase.from("v_monthly_pnl").select("*").eq("bulan", monthStartStr).maybeSingle(),
  ]);

  return (
    <KeuanganClient
      categories={(catRes.data ?? []) as ExpenseCategory[]}
      expenses={(expRes.data ?? []) as OperatingExpense[]}
      target={(targetRes.data ?? null) as MonthlyTarget | null}
      pnl={(pnlRes.data ?? null) as VMonthlyPnl | null}
    />
  );
}
