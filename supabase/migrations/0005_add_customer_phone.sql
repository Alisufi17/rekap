-- =============================================================================
-- 0005 — Tambahkan kolom customer_phone yang hilang
-- =============================================================================
-- Ditemukan saat verifikasi pertama: file `add_customer_phone.sql` yang
-- disebut sudah pernah dijalankan (lihat project brief) ternyata belum
-- benar-benar sampai ke tabel transactions di project ini. Migrasi ini aman
-- dijalankan berkali-kali (IF NOT EXISTS).
-- =============================================================================

alter table public.transactions
  add column if not exists customer_phone text;

-- Wajib setelah ALTER TABLE lewat SQL Editor — PostgREST cache kolom lama
-- dan tidak otomatis tahu ada kolom baru sampai di-reload.
notify pgrst, 'reload schema';
