-- =============================================================================
-- Reset data uji coba — dijalankan sekali, manual, atas permintaan user
-- =============================================================================
-- Konteks: transaksi, spend iklan, biaya operasional, dan target yang ada
-- sekarang semuanya hasil testing selama rebuild aplikasi (bukan data
-- penjualan asli). User akan input ulang manual dari catatan buku mulai
-- tanggal tertentu, dan ingin stok dikembalikan ke modal awal 200/produk.
--
-- INI TIDAK BISA DIBATALKAN. Disarankan export tabel transactions ke CSV
-- dulu (Supabase Dashboard -> Table Editor -> transactions -> Export) kalau
-- sewaktu-waktu masih mau lihat data lama, sebelum menjalankan ini.
--
-- Urutan penting: hapus transactions DULU (trigger sync_product_stock akan
-- otomatis mengembalikan stok yang sempat terpotong), baru SET stok ke 200
-- supaya angka akhirnya pasti 200 rata, bukan tergantung sisa perhitungan
-- trigger.
-- =============================================================================

delete from public.transactions;
delete from public.daily_metrics;
delete from public.operating_expenses;
delete from public.monthly_targets;

update public.products set stok = 200;

-- Cek hasilnya:
select nama, hpp, stok from public.products order by nama;
