-- =============================================================================
-- 0006 — Refresh v_transactions supaya ikut kolom customer_phone
-- =============================================================================
-- `create view ... as select t.*, ...` di Postgres MEMBEKUKAN daftar kolom
-- table t pada saat view dibuat. Migrasi 0004 membuat view ini SEBELUM
-- customer_phone ditambahkan (migrasi 0005) — akibatnya nomor HP tersimpan
-- di tabel transactions tapi tidak pernah muncul lewat view ini, sehingga
-- tombol "Chat WA" di aplikasi tidak pernah tampil.
--
-- `create or replace view` dengan definisi yang SAMA memaksa Postgres
-- meng-expand ulang `t.*` dengan daftar kolom terbaru. Perlu diingat untuk
-- migrasi berikutnya: kalau ada kolom baru ditambahkan ke `transactions`
-- lagi di masa depan, view ini (dan v_daily_sales/v_monthly_pnl kalau
-- relevan) perlu di-refresh ulang dengan cara yang sama.
-- =============================================================================

create or replace view public.v_transactions
with (security_invoker = true)
as
select
  t.*,
  (t.qty * t.harga)                       as omset,
  (t.qty * t.hpp)                         as modal,
  coalesce(t.ongkir, 0) + coalesce(t.admin, 0) as biaya_transaksi,
  (t.qty * t.harga)
    - (t.qty * t.hpp)
    - coalesce(t.ongkir, 0)
    - coalesce(t.admin, 0)                as profit_kotor,

  (t.channel = 'online'  and t.status = 'selesai')
    or (t.channel = 'offline' and t.status = 'lunas')      as terkonfirmasi,

  (t.channel = 'online' and t.status = 'proses')           as estimasi,

  (t.channel = 'offline' and t.status = 'belum')           as piutang,

  (t.status = 'rts')                                       as retur
from public.transactions t;

notify pgrst, 'reload schema';
