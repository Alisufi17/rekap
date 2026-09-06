-- =============================================================================
-- 0004 — Semua kalkulasi uang jadi satu sumber
-- =============================================================================
-- Sebelumnya omset/profit dihitung di JavaScript browser. Akibatnya rumusnya
-- tersebar (dashboard, kalender, kartu transaksi, form input) dan sempat
-- berbeda-beda. Mulai sekarang rumusnya hidup di sini; frontend, export Excel,
-- dan notifikasi otomatis nanti semuanya membaca view yang sama.
--
-- security_invoker = true  -> RLS pemanggil tetap berlaku lewat view.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Per transaksi.
--
-- PERUBAHAN ATURAN — mohon dicek apakah setuju:
-- Kode lama menghitung SEMUA transaksi offline sebagai omset terkonfirmasi,
-- termasuk yang statusnya "Belum Lunas". Padahal uangnya belum diterima.
-- Di sini offline baru terkonfirmasi kalau 'lunas'; yang 'belum' masuk kolom
-- `piutang` supaya kelihatan sebagai tagihan, bukan hilang begitu saja.
-- -----------------------------------------------------------------------------
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

  -- Uang sudah pasti masuk.
  (t.channel = 'online'  and t.status = 'selesai')
    or (t.channel = 'offline' and t.status = 'lunas')      as terkonfirmasi,

  -- Online masih diproses: belum tentu jadi. Hitung sebagai estimasi saja.
  (t.channel = 'online' and t.status = 'proses')           as estimasi,

  -- Offline sudah diserahkan tapi belum dibayar: ini tagihan, bukan estimasi.
  (t.channel = 'offline' and t.status = 'belum')           as piutang,

  (t.status = 'rts')                                       as retur
from public.transactions t;

-- -----------------------------------------------------------------------------
-- Ringkasan harian — dipakai chart tren dan heatmap kalender.
-- Keduanya sekarang membaca sumber yang sama, jadi tidak mungkin lagi
-- angkanya beda seperti di versi lama.
-- -----------------------------------------------------------------------------
create or replace view public.v_daily_sales
with (security_invoker = true)
as
select
  t.tanggal,
  count(*) filter (where t.terkonfirmasi)                        as jumlah_transaksi,
  coalesce(sum(t.omset)        filter (where t.terkonfirmasi), 0) as omset,
  coalesce(sum(t.profit_kotor) filter (where t.terkonfirmasi), 0) as profit_kotor,
  coalesce(sum(t.omset) filter (where t.terkonfirmasi and t.channel = 'online'),  0) as omset_online,
  coalesce(sum(t.omset) filter (where t.terkonfirmasi and t.channel = 'offline'), 0) as omset_offline,
  coalesce(sum(t.omset)        filter (where t.estimasi), 0)      as omset_estimasi,
  coalesce(sum(t.profit_kotor) filter (where t.estimasi), 0)      as profit_estimasi,
  coalesce(sum(t.omset)        filter (where t.piutang),  0)      as piutang,
  coalesce(sum(t.omset)        filter (where t.retur),    0)      as nilai_retur,
  count(*) filter (where t.retur)                                 as jumlah_retur
from public.v_transactions t
group by t.tanggal;

-- -----------------------------------------------------------------------------
-- Laba rugi bulanan — omset sampai profit bersih.
--
-- Catatan untuk frontend: operating_expenses hanya bisa dibaca admin, jadi
-- kalau view ini dibuka oleh staff, kolom biaya_operasional akan bernilai 0
-- dan profit_bersih menjadi tidak benar. Sembunyikan bagian profit bersih
-- untuk staff — jangan ditampilkan dengan angka nol.
-- -----------------------------------------------------------------------------
create or replace view public.v_monthly_pnl
with (security_invoker = true)
as
with bulan as (
  select distinct date_trunc('month', tanggal)::date as bulan
  from public.transactions
  union
  select distinct date_trunc('month', tanggal)::date from public.operating_expenses
  union
  select bulan from public.monthly_targets
),
penjualan as (
  select date_trunc('month', d.tanggal)::date as bulan,
         sum(d.omset)            as omset,
         sum(d.profit_kotor)     as profit_kotor,
         sum(d.omset_online)     as omset_online,
         sum(d.omset_offline)    as omset_offline,
         sum(d.jumlah_transaksi) as jumlah_transaksi,
         sum(d.piutang)          as piutang,
         sum(d.omset_estimasi)   as omset_estimasi
  from public.v_daily_sales d
  group by 1
),
iklan as (
  select date_trunc('month', tanggal)::date as bulan,
         sum(coalesce(spend_iklan, 0)) as spend_iklan,
         sum(coalesce(chat_masuk, 0))  as chat_masuk
  from public.daily_metrics
  group by 1
),
biaya as (
  select date_trunc('month', tanggal)::date as bulan,
         sum(nominal) as biaya_operasional
  from public.operating_expenses
  group by 1
)
select
  b.bulan,
  coalesce(p.omset, 0)             as omset,
  coalesce(p.omset_online, 0)      as omset_online,
  coalesce(p.omset_offline, 0)     as omset_offline,
  coalesce(p.jumlah_transaksi, 0)  as jumlah_transaksi,
  coalesce(p.piutang, 0)           as piutang,
  coalesce(p.omset_estimasi, 0)    as omset_estimasi,
  coalesce(p.profit_kotor, 0)      as profit_kotor,
  coalesce(i.spend_iklan, 0)       as spend_iklan,
  coalesce(i.chat_masuk, 0)        as chat_masuk,
  coalesce(c.biaya_operasional, 0) as biaya_operasional,

  -- profit_kotor sudah memotong HPP, ongkir, dan biaya admin per transaksi.
  -- Spend iklan harian dan biaya operasional dipotong di level bulan.
  coalesce(p.profit_kotor, 0)
    - coalesce(i.spend_iklan, 0)
    - coalesce(c.biaya_operasional, 0) as profit_bersih,

  t.target_omset,
  t.target_profit,
  case when coalesce(t.target_omset, 0) > 0
       then round(coalesce(p.omset, 0) / t.target_omset * 100, 1) end as capaian_omset_persen,
  case when coalesce(t.target_profit, 0) > 0
       then round((coalesce(p.profit_kotor, 0)
                   - coalesce(i.spend_iklan, 0)
                   - coalesce(c.biaya_operasional, 0)) / t.target_profit * 100, 1) end
       as capaian_profit_persen
from bulan b
left join penjualan p on p.bulan = b.bulan
left join iklan     i on i.bulan = b.bulan
left join biaya     c on c.bulan = b.bulan
left join public.monthly_targets t on t.bulan = b.bulan;
