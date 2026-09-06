"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/transactions";

export async function upsertDailyMetric(input: {
  tanggal: string;
  spendIklan: number;
  chatMasuk: number;
}): Promise<ActionResult> {
  const { profile } = await getCurrentProfile();
  if (!isAdmin(profile)) return { ok: false, error: "Hanya admin yang boleh input iklan" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_metrics")
    .upsert(
      { tanggal: input.tanggal, spend_iklan: input.spendIklan, chat_masuk: input.chatMasuk },
      { onConflict: "tanggal" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
