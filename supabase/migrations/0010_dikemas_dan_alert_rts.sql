-- =============================================================================
-- 0010 — Status "Sudah Dikemas" per transaksi online
-- =============================================================================
-- Kejadian nyata: status transaksi online sudah "Proses" di sistem, tapi
-- paketnya ternyata belum pernah dikemas/dikirim beneran — status "Proses"
-- cuma berarti "belum dikonfirmasi Selesai/RTS", bukan jaminan fisiknya
-- sudah dikemas. Kolom `dikemas` ini menandai fakta operasional itu secara
-- terpisah dari status pembayaran/konfirmasi.
--
-- Default false untuk transaksi BARU (lihat lib/transactions.ts — hanya
-- online yang perlu dikemas&kirim; offline diserahkan langsung ke pembeli).
-- Transaksi LAMA di-backfill true supaya tidak tiba-tiba muncul ratusan
-- "belum dikemas" palsu untuk pesanan yang sebenarnya sudah lama kelar.
--
-- v_transactions pakai `t.*` yang membekukan daftar kolom saat view dibuat
-- (lihat catatan panjang di 0006) — jadi harus DROP CASCADE + CREATE ulang
-- tiga view ini lagi supaya kolom baru ikut terbawa.
-- =============================================================================

alter table public.transactions
  add column if not exists dikemas boolean not null default false;

update public.transactions
  set dikemas = true
  where dikemas = false
    and (status != 'proses' or channel = 'offline');

alter table public.transactions
  alter column dikemas set default false;

drop view if exists public.v_transactions cascade;

create view public.v_transactions
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

create view public.v_daily_sales
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
  count(*)                                                        as jumlah_transaksi_semua
from public.v_transactions t
group by t.tanggal;

create view public.v_monthly_pnl
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
