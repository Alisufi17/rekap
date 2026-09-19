"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/transactions";
import type { ExpenseCategoryCode } from "@/types/database";

async function requireAdmin() {
  const { profile } = await getCurrentProfile();
  if (!isAdmin(profile)) throw new Error("Hanya admin yang boleh mengubah data keuangan");
}

export async function upsertMonthlyTarget(input: {
  bulan: string; // tanggal 1, "YYYY-MM-01"
  targetOmset: number;
  targetProfit: number;
  catatan: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("monthly_targets").upsert(
    {
      bulan: input.bulan,
      target_omset: input.targetOmset,
      target_profit: input.targetProfit,
      catatan: input.catatan.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bulan" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addOperatingExpense(input: {
  tanggal: string;
  kategori: ExpenseCategoryCode;
  nominal: number;
  catatan: string;
  berulang: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  if (input.nominal <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

  const supabase = await createClient();
  const { error } = await supabase.from("operating_expenses").insert([
    {
      tanggal: input.tanggal,
      kategori: input.kategori,
      nominal: input.nominal,
      catatan: input.catatan.trim() || null,
      berulang: input.berulang,
    },
  ]);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOperatingExpense(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("operating_expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addPencairanDana(input: {
  tanggal: string;
  sumber: string;
  nominal: number;
  catatan: string;
}): Promise<ActionResult> {
  await requireAdmin();
  if (input.nominal <= 0) return { ok: false, error: "Nominal harus lebih dari 0" };

  const supabase = await createClient();
  const { error } = await supabase.from("pencairan_dana").insert([
    {
      tanggal: input.tanggal,
      sumber: input.sumber.trim() || "Mengantar",
      nominal: input.nominal,
      catatan: input.catatan.trim() || null,
    },
  ]);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  return { ok: true };
}

export async function deletePencairanDana(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("pencairan_dana").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  return { ok: true };
}

// Menyalin biaya bertanda `berulang` (gaji, listrik, sewa) dari bulan
// sebelumnya, lihat salin_biaya_berulang() di 0003_expenses_and_targets.sql.
export async function copyRecurringExpenses(bulan: string): Promise<ActionResult & { count?: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salin_biaya_berulang", { p_bulan: bulan });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true, count: data as number };
}
