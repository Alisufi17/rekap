-- =============================================================================
-- 0011 — Role "packing" (Hansen), langkah 1: tambah nilai enum
-- =============================================================================
-- WAJIB dijalankan TERPISAH dari 0012 dan di-commit dulu — Postgres tidak
-- mengizinkan nilai enum baru dipakai (termasuk di dalam function body lain)
-- dalam transaksi yang sama dengan saat nilainya ditambahkan:
--   ERROR: 55P04: unsafe use of new value "packing" of enum type user_role
--
-- Jalankan file ini sendirian dulu, tunggu selesai (otomatis ter-commit di
-- SQL Editor), baru jalankan 0012_role_packing_rls.sql.
-- =============================================================================

alter type public.user_role add value if not exists 'packing';
