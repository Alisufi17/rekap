-- =============================================================================
-- 0009 — Rincian biaya packing di laporan bulanan (bahan vs upah Hansen)
-- =============================================================================
-- Sejak 0008, tiap transaksi otomatis dipotong Rp2.000 (upah packing/Hansen)
-- lewat profit_kotor — tapi angka itu tersembunyi, tidak pernah dijumlah jadi
-- satu total yang kelihatan. Belanja bahan packing (kardus, lakban) sendiri
-- sudah bisa dicatat lewat kategori "packing" di operating_expenses, tapi
-- jumlahnya melebur ke total biaya_operasional, tidak kelihatan terpisah.
--
-- Migrasi ini menambah kolom baru di UJUNG select list v_daily_sales dan
-- v_monthly_pnl (CREATE OR REPLACE aman selama tidak mengubah/menggeser
-- kolom yang sudah ada) supaya laporan bulanan bisa menunjukkan:
--   - biaya_packing_bahan  : total belanja kategori "packing" bulan itu
--   - biaya_packing_hansen : jumlah_transaksi_semua x Rp2.000
--   - biaya_packing_total  : gabungan keduanya, murni untuk ditampilkan —
--     bukan pengurang baru di profit_bersih (bahan sudah ikut ke
--     biaya_operasional, upah sudah ikut ke profit_kotor; di sini cuma
--     dikelompokkan ulang biar kelihatan rinciannya).
-- =============================================================================

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
  count(*) filter (where t.retur)                                 as jumlah_retur,
  -- Semua transaksi apapun statusnya — dasar hitung upah packing Hansen,
  -- karena packing terjadi begitu paket disiapkan, bukan cuma saat lunas.
  count(*)                                                        as jumlah_transaksi_semua
from public.v_transactions t
group by t.tanggal;

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
         sum(d.omset)                 as omset,
         sum(d.profit_kotor)          as profit_kotor,
         sum(d.omset_online)          as omset_online,
         sum(d.omset_offline)         as omset_offline,
         sum(d.jumlah_transaksi)      as jumlah_transaksi,
         sum(d.piutang)               as piutang,
         sum(d.omset_estimasi)        as omset_estimasi,
         sum(d.jumlah_transaksi_semua) as jumlah_transaksi_semua
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
         sum(nominal)                                        as biaya_operasional,
         sum(nominal) filter (where kategori = 'packing')     as biaya_packing_bahan
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
       as capaian_profit_persen,

  coalesce(p.jumlah_transaksi_semua, 0)                              as jumlah_transaksi_semua,
  coalesce(c.biaya_packing_bahan, 0)                                 as biaya_packing_bahan,
  coalesce(p.jumlah_transaksi_semua, 0) * 2000                       as biaya_packing_hansen,
  coalesce(c.biaya_packing_bahan, 0)
    + coalesce(p.jumlah_transaksi_semua, 0) * 2000                   as biaya_packing_total
from bulan b
left join penjualan p on p.bulan = b.bulan
left join iklan     i on i.bulan = b.bulan
left join biaya     c on c.bulan = b.bulan
left join public.monthly_targets t on t.bulan = b.bulan;

notify pgrst, 'reload schema';
