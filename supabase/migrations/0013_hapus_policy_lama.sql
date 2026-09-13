-- =============================================================================
-- 0013 — Hapus policy RLS lama peninggalan setup awal ("team can ...")
-- =============================================================================
-- TEMUAN PENTING: sejak project ini di-setup, ada 12 policy lama bernama
-- "team can ..." di transactions/products/daily_metrics yang tidak pernah
-- dibersihkan. Isinya cuma `auth.role() = 'authenticated'` — meloloskan
-- SIAPA SAJA yang login, tanpa peduli role di tabel `profiles`.
--
-- Postgres menggabungkan beberapa policy untuk perintah yang sama dengan
-- OR — jadi walau policy baru yang benar (transactions_delete, dst) sudah
-- mengecek is_admin()/is_packing() dengan benar, policy lama ini tetap
-- meloloskan semua orang lewat jalur lain. Akibatnya sejak awal:
--
--   - Staff bisa HAPUS transaksi & UBAH HPP/stok produk lewat API langsung
--     (walau tombolnya di UI cuma muncul untuk admin — RLS-nya bolong).
--   - Baru ketahuan sekarang karena role "packing" (Hansen) butuh RLS yang
--     benar-benar menutup akses, dan ternyata masih tembus lewat policy ini.
--
-- Migrasi ini menghapus semua policy "team can ..." itu. Policy pengganti
-- yang benar (transactions_select/insert/update/delete, products_select/
-- write, daily_metrics_select/write) sudah ada sejak 0001/0003/0012 dan
-- mencakup semua kebutuhan yang sama, jadi aman dihapus tanpa mengganti.
-- =============================================================================

drop policy if exists "team can read transactions"   on public.transactions;
drop policy if exists "team can insert transactions" on public.transactions;
drop policy if exists "team can update transactions" on public.transactions;
drop policy if exists "team can delete transactions" on public.transactions;

drop policy if exists "team can read products"   on public.products;
drop policy if exists "team can insert products" on public.products;
drop policy if exists "team can update products" on public.products;
drop policy if exists "team can delete products" on public.products;

drop policy if exists "team can read daily_metrics"   on public.daily_metrics;
drop policy if exists "team can insert daily_metrics" on public.daily_metrics;
drop policy if exists "team can update daily_metrics" on public.daily_metrics;
drop policy if exists "team can delete daily_metrics" on public.daily_metrics;

notify pgrst, 'reload schema';
