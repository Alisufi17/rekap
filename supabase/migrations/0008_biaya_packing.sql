-- =============================================================================
-- 0008 — Biaya packing tetap per transaksi
-- =============================================================================
-- Setiap transaksi (online maupun offline, apapun statusnya) menimbulkan
-- biaya packing tetap Rp2.000. Sebelumnya biaya ini tidak pernah dipotong,
-- jadi profit_kotor selalu lebih besar Rp2.000/transaksi dari kenyataan.
--
-- Cukup CREATE OR REPLACE — nama, posisi, dan tipe kolom `biaya_transaksi`
-- dan `profit_kotor` tidak berubah, cuma rumusnya. Semua yang baca lewat
-- v_transactions (dashboard, kalender, keuangan, kartu transaksi) otomatis
-- ikut terkoreksi karena baca dari satu sumber ini.
-- =============================================================================

create or replace view public.v_transactions
with (security_invoker = true)
as
select
  t.*,
  (t.qty * t.harga)                       as omset,
  (t.qty * t.hpp)                         as modal,
  coalesce(t.ongkir, 0) + coalesce(t.admin, 0) + 2000 as biaya_transaksi,
  (t.qty * t.harga)
    - (t.qty * t.hpp)
    - coalesce(t.ongkir, 0)
    - coalesce(t.admin, 0)
    - 2000                                as profit_kotor,

  (t.channel = 'online'  and t.status = 'selesai')
    or (t.channel = 'offline' and t.status = 'lunas')      as terkonfirmasi,

  (t.channel = 'online' and t.status = 'proses')           as estimasi,

  (t.channel = 'offline' and t.status = 'belum')           as piutang,

  (t.status = 'rts')                                       as retur
from public.transactions t;

notify pgrst, 'reload schema';
