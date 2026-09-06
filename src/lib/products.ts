"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/transactions";

async function requireAdmin() {
  const { profile } = await getCurrentProfile();
  if (!isAdmin(profile)) {
    throw new Error("Hanya admin yang boleh mengubah produk");
  }
}

export async function upsertProduct(input: {
  id?: string;
  nama: string;
  hpp: number;
  stok: number;
}): Promise<ActionResult> {
  await requireAdmin();
  if (!input.nama.trim()) return { ok: false, error: "Nama produk wajib diisi" };

  const supabase = await createClient();
  const { error } = input.id
    ? await supabase
        .from("products")
        .update({ nama: input.nama.trim(), hpp: input.hpp, stok: input.stok })
        .eq("id", input.id)
    : await supabase
        .from("products")
        .insert([{ nama: input.nama.trim(), hpp: input.hpp, stok: input.stok }]);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/produk");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/produk");
  return { ok: true };
}
