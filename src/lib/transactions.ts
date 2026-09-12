"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TxStatus } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Semua kalkulasi (omset, profit, HPP historis) tetap disimpan di baris
// transaksi seperti versi lama — itu sudah benar, HPP per transaksi menjaga
// profit historis akurat walau HPP produk berubah nanti. Yang berubah:
// stok TIDAK lagi dihitung di sini. Trigger sync_product_stock (lihat
// supabase/migrations/0002_stock_engine.sql) menanganinya otomatis dan aman
// dari race condition dua orang input bersamaan.
export async function createTransaction(input: {
  channel: "online" | "offline";
  tanggal: string;
  customer: string;
  customerPhone: string;
  produkId: string;
  produkNama: string;
  qty: number;
  totalHarga: number;
  hpp: number;
  ongkir: number;
  admin: number;
  catatan: string;
  status: string;
  affectsStock: boolean;
}): Promise<ActionResult> {
  if (!input.produkId || input.qty <= 0) {
    return { ok: false, error: "Lengkapi produk & qty" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert([
    {
      channel: input.channel,
      tanggal: input.tanggal,
      customer: input.customer.trim() || "-",
      customer_phone: input.customerPhone.trim() || null,
      produk_id: input.produkId,
      produk_nama: input.produkNama,
      qty: input.qty,
      harga: input.qty > 0 ? input.totalHarga / input.qty : 0,
      hpp: input.hpp,
      ongkir: input.channel === "online" ? input.ongkir : 0,
      admin: input.channel === "online" ? input.admin : 0,
      catatan: input.catatan.trim() || null,
      status: input.channel === "online" ? "proses" : input.status,
      affects_stock: input.affectsStock,
      // Offline diserahkan langsung ke pembeli, jadi otomatis dianggap sudah
      // "dikemas". Online defaultnya belum, ditandai manual setelah dipacking.
      dikemas: input.channel === "offline",
    },
  ]);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  revalidatePath("/produk");
  return { ok: true };
}

// Semua anggota tim (admin & staff) boleh mengonfirmasi status transaksi
// siapa saja — alur kerjanya saling menindaklanjuti satu sama lain. Hapus
// transaksi tetap admin-only (lihat deleteTransaction), itu tindakan yang
// lebih berisiko dan tidak termasuk yang diminta dibuka untuk staff.
export async function updateTransactionStatus(id: string, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: status as TxStatus })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  revalidatePath("/produk");
  return { ok: true };
}

export async function setDikemas(id: string, dikemas: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update({ dikemas }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  revalidatePath("/produk");
  return { ok: true };
}
