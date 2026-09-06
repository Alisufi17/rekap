import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { localDateStr } from "@/lib/format";
import IklanForm from "@/components/IklanForm";
import type { DailyMetric } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function IklanPage() {
  const { profile } = await getCurrentProfile();
  if (!isAdmin(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  const { data } = await supabase
    .from("daily_metrics")
    .select("*")
    .gte("tanggal", localDateStr(cutoff));

  return <IklanForm existing={(data ?? []) as DailyMetric[]} />;
}
