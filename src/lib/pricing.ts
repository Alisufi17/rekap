// Biaya packing tetap per transaksi (upah Hansen) — harus sama dengan angka
// di view v_transactions, lihat supabase/migrations/0008_biaya_packing.sql.
export const BIAYA_PACKING = 2000;

// Tarif ongkir tetap SiCepat berdasarkan jumlah bibit per pesanan.
// 1-3 bibit = angka dari owner. Dari 4 bibit ke atas belum ada angka pasti
// dari owner, jadi dihitung lanjut Rp10.000 per bibit (per-kg tarif 3 bibit:
// 30rb / 3 = 10rb) — ubah ONGKIR_PER_BIBIT_LANJUTAN kalau tarif SiCepat
// aslinya beda.
export const ONGKIR_TARIF: Record<number, number> = {
  1: 12_000,
  2: 24_000,
  3: 30_000,
};
export const ONGKIR_PER_BIBIT_LANJUTAN = 10_000;

export function hitungOngkir(qty: number): number {
  const n = Math.ceil(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const tarif = ONGKIR_TARIF[n];
  if (tarif !== undefined) return tarif;
  return (ONGKIR_TARIF[3] ?? 0) + (n - 3) * ONGKIR_PER_BIBIT_LANJUTAN;
}

// Preview profit sebelum disimpan. Rumus sama dengan v_transactions:
// omset - modal - ongkir - admin - packing. Offline tidak punya ongkir.
export function hitungProfitPreview(input: {
  channel: "online" | "offline";
  totalHarga: number;
  qty: number;
  hpp: number;
  ongkir: number;
}): number {
  const modal = input.qty * input.hpp;
  const ongkir = input.channel === "online" ? input.ongkir : 0;
  return input.totalHarga - modal - ongkir - BIAYA_PACKING;
}
