-- =============================================================================
-- 0003 — Biaya operasional & target bulanan
-- =============================================================================
-- Sampai sekarang "profit" = omset - HPP - ongkir - biaya admin. Itu profit
-- kotor. Packing, listrik, gaji, sewa belum masuk, jadi angka profit di
-- dashboard selalu lebih besar dari uang yang benar-benar tersisa.
-- =============================================================================

create table if not exists public.expense_categories (
  kode     text primary key,
  nama     text not null,
  urutan   int  not null default 100,
  aktif    boolean not null default true
);

insert into public.expense_categories (kode, nama, urutan) values
  ('packing',   'Packing & kemasan',       10),
  ('ongkir_in', 'Ongkir masuk / restock',  20),
  ('gaji',      'Gaji & bonus',            30),
  ('listrik',   'Listrik, air, internet',  40),
  ('sewa',      'Sewa tempat',             50),
  ('transport', 'Transport & bensin',      60),
  ('platform',  'Biaya platform & tools',  70),
  ('lainnya',   'Lainnya',                 99)
on conflict (kode) do nothing;

create table if not exists public.operating_expenses (
  id             uuid primary key default gen_random_uuid(),
  tanggal        date not null,
  kategori       text not null references public.expense_categories(kode),
  nominal        numeric not null check (nominal >= 0),
  catatan        text,
  -- Ditandai true untuk biaya yang berulang tiap bulan (gaji, listrik, sewa).
  -- Dipakai oleh salin_biaya_berulang() di bawah.
  berulang       boolean not null default false,
  created_by_uid uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_operating_expenses_tanggal
  on public.operating_expenses (tanggal desc);

-- -----------------------------------------------------------------------------
-- Target bulanan. `bulan` selalu tanggal 1 di bulan bersangkutan.
-- -----------------------------------------------------------------------------
create table if not exists public.monthly_targets (
  bulan          date primary key,
  target_omset   numeric not null default 0 check (target_omset  >= 0),
  target_profit  numeric not null default 0 check (target_profit >= 0),
  catatan        text,
  updated_at     timestamptz not null default now(),
  constraint monthly_targets_awal_bulan check (extract(day from bulan) = 1)
);

-- -----------------------------------------------------------------------------
-- Gaji dan listrik nominalnya sama tiap bulan. Daripada mengetik ulang,
-- salin yang bertanda `berulang` dari bulan sebelumnya.
--   select public.salin_biaya_berulang(date '2026-09-01');
-- Aman dipanggil dua kali: baris yang sudah ada tidak diduplikasi.
-- -----------------------------------------------------------------------------
create or replace function public.salin_biaya_berulang(p_bulan date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_awal  date := date_trunc('month', p_bulan)::date;
  v_prev  date := (date_trunc('month', p_bulan) - interval '1 month')::date;
  v_count int;
begin
  insert into public.operating_expenses (tanggal, kategori, nominal, catatan, berulang)
  select v_awal + (e.tanggal - date_trunc('month', e.tanggal)::date),
         e.kategori, e.nominal, e.catatan, true
  from public.operating_expenses e
  where e.berulang
    and e.tanggal >= v_prev
    and e.tanggal <  v_awal
    and not exists (
      select 1 from public.operating_expenses x
      where x.berulang
        and x.kategori = e.kategori
        and x.tanggal >= v_awal
        and x.tanggal <  (v_awal + interval '1 month')::date
    );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- =============================================================================
-- RLS
-- =============================================================================
-- Biaya operasional memuat gaji. Admin saja — baca maupun tulis.
alter table public.operating_expenses enable row level security;

drop policy if exists operating_expenses_admin on public.operating_expenses;
create policy operating_expenses_admin on public.operating_expenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Target boleh dilihat semua orang (biar tim tahu yang dikejar), diubah admin.
alter table public.monthly_targets enable row level security;

drop policy if exists monthly_targets_select on public.monthly_targets;
create policy monthly_targets_select on public.monthly_targets
  for select to authenticated using (true);

drop policy if exists monthly_targets_write on public.monthly_targets;
create policy monthly_targets_write on public.monthly_targets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.expense_categories enable row level security;

drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories
  for select to authenticated using (true);

drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_write on public.expense_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
