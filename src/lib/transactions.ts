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

// Koreksi salah input. Yang boleh diubah: tanggal, customer, HP, produk,
// qty, harga, ongkir, catatan. Channel/status/dikemas sengaja tidak — status
// punya alurnya sendiri. Stok otomatis menyesuaikan lewat trigger
// sync_product_stock (kembalikan qty lama, tahan qty baru).
// HPP & nama produk diambil dari database, bukan dari kiriman browser:
// produk tidak berubah = HPP lama dipertahankan (profit historis tetap
// akurat); produk diganti = HPP produk baru yang sekarang.
export async function updateTransaction(
  id: string,
  input: {
    tanggal: string;
    customer: string;
    customerPhone: string;
    produkId: string;
    qty: number;
    totalHarga: number;
    ongkir: number;
    catatan: string;
  }
): Promise<ActionResult> {
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, error: "Qty harus lebih dari 0" };
  }
  if (!Number.isFinite(input.totalHarga) || input.totalHarga < 0) {
    return { ok: false, error: "Harga tidak valid" };
  }
  if (!Number.isFinite(input.ongkir) || input.ongkir < 0) {
    return { ok: false, error: "Ongkir tidak valid" };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("transactions")
    .select("channel, produk_id, hpp")
    .eq("id", id)
    .single();
  if (!current) return { ok: false, error: "Transaksi tidak ditemukan" };

  const { data: produk } = await supabase
    .from("products")
    .select("nama, hpp")
    .eq("id", input.produkId)
    .single();
  if (!produk) return { ok: false, error: "Produk tidak ditemukan" };
  const produkNama = produk.nama;
  const hpp = input.produkId !== current.produk_id ? produk.hpp : current.hpp;

  const { error } = await supabase
    .from("transactions")
    .update({
      tanggal: input.tanggal,
      customer: input.customer.trim() || "-",
      customer_phone: input.customerPhone.trim() || null,
      produk_id: input.produkId,
      produk_nama: produkNama,
      qty: input.qty,
      harga: input.totalHarga / input.qty,
      hpp,
      ongkir: current.channel === "online" ? input.ongkir : 0,
      catatan: input.catatan.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  revalidatePath("/produk");
  revalidatePath("/packing");
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

// Lewat RPC (bukan .update() langsung) supaya satu jalur berlaku untuk
// semua role, termasuk "packing" (Hansen) yang RLS-nya sengaja menutup
// akses UPDATE langsung ke tabel transactions — lihat 0011_role_packing.sql.
export async function setDikemas(id: string, dikemas: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_dikemas", { p_id: id, p_dikemas: dikemas });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transaksi");
  revalidatePath("/packing");
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
