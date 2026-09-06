-- =============================================================================
-- 0001 — Role & permission (admin vs staff)
-- =============================================================================
-- Menambahkan tabel profiles yang terhubung ke auth.users, plus RLS berbasis role.
--
-- PENTING: semua user yang SUDAH ADA di-backfill sebagai 'admin' supaya tidak
-- ada yang terkunci saat migrasi dijalankan. Setelah ini jalan, turunkan yang
-- perlu jadi 'staff' lewat:
--     update public.profiles set role = 'staff' where email = 'orang@contoh.com';
-- =============================================================================

do $$ begin
  create type public.user_role as enum ('admin', 'staff');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nama       text,
  role       public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- Backfill user yang sudah ada sebagai admin (anti-lockout).
insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'::public.user_role
from auth.users u
on conflict (id) do nothing;

-- User baru yang dibuat lewat Supabase dashboard otomatis dapat profile 'staff'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helper. SECURITY DEFINER wajib di sini: kalau tidak, policy yang membaca
-- profiles akan memicu policy profiles lagi -> rekursi tak berhingga.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------- transactions
-- Jejak siapa yang input. Kolom `created_by` (text/email) yang lama dibiarkan
-- apa adanya supaya data historis tidak hilang.
alter table public.transactions
  add column if not exists created_by_uid uuid references auth.users(id);

create or replace function public.set_created_by_uid()
returns trigger
language plpgsql
as $$
begin
  new.created_by_uid := auth.uid();
  return new;
end $$;

drop trigger if exists trg_tx_created_by on public.transactions;
create trigger trg_tx_created_by
  before insert on public.transactions
  for each row execute function public.set_created_by_uid();

alter table public.transactions enable row level security;

drop policy if exists transactions_all_authenticated on public.transactions;
drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

-- Semua yang login boleh melihat transaksi (dashboard & stok butuh ini).
create policy transactions_select on public.transactions
  for select to authenticated using (true);

create policy transactions_insert on public.transactions
  for insert to authenticated with check (true);

-- Staff hanya boleh mengubah transaksi yang dia sendiri input. Admin bebas.
create policy transactions_update on public.transactions
  for update to authenticated
  using (public.is_admin() or created_by_uid = auth.uid())
  with check (public.is_admin() or created_by_uid = auth.uid());

-- Hapus transaksi: admin saja.
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------------- products
-- Semua boleh lihat (form transaksi butuh daftar produk + HPP).
-- Hanya admin boleh ubah HPP/stok/nama — HPP menentukan profit, jangan
-- diserahkan ke staff. Pengurangan stok otomatis tetap jalan karena trigger
-- di 0002 pakai SECURITY DEFINER.
alter table public.products enable row level security;

drop policy if exists products_all_authenticated on public.products;
drop policy if exists products_select on public.products;
drop policy if exists products_write on public.products;

create policy products_select on public.products
  for select to authenticated using (true);

create policy products_write on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------------- daily_metrics
-- Spend iklan = angka bisnis. Admin saja yang boleh input/ubah; semua boleh baca.
alter table public.daily_metrics enable row level security;

drop policy if exists daily_metrics_all_authenticated on public.daily_metrics;
drop policy if exists daily_metrics_select on public.daily_metrics;
drop policy if exists daily_metrics_write on public.daily_metrics;

create policy daily_metrics_select on public.daily_metrics
  for select to authenticated using (true);

create policy daily_metrics_write on public.daily_metrics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
