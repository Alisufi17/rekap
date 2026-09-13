-- =============================================================================
-- 0012 — Role "packing" (Hansen), langkah 2: RLS, view, dan fungsi
-- =============================================================================
-- WAJIB dijalankan SETELAH 0011_role_packing_enum.sql sudah selesai
-- (nilai enum 'packing' harus sudah ter-commit lebih dulu).
--
-- Kebutuhan: Hansen login sendiri, tapi HARUS TIDAK BISA lihat omset total
-- atau profit sama sekali — biar ini beneran ditegakkan (bukan cuma
-- disembunyikan di UI), pembatasannya dipasang di level database:
--
--   1. transactions_select & transactions_update ditutup untuk role ini —
--      Hansen TIDAK BISA query tabel/v_transactions langsung sama sekali,
--      walau lewat DevTools/Postman sekalipun.
--   2. v_packing_queue: view KHUSUS yang cuma expose kolom non-uang total —
--      customer, produk, qty, harga per pcs, dan total per TRANSAKSI (biar
--      bisa dicocokkan ke resi/COD) — TIDAK ADA hpp/modal/profit_kotor.
--      View ini sengaja TIDAK pakai security_invoker=true (beda dari semua
--      view lain di project ini!) — view berjalan dengan privilege OWNER
--      (postgres, yang bypass RLS), supaya tetap bisa baca transactions
--      walau RLS transactions_select sudah menutup akses Hansen. Batas
--      keamanannya bukan di RLS untuk view ini, tapi di DAFTAR KOLOM yang
--      di-select — jangan pernah tambahkan kolom uang (hpp/modal/
--      profit_kotor/ongkir/admin) ke view ini.
--   3. mark_dikemas(): satu-satunya cara Hansen mengubah data. SECURITY
--      DEFINER, cuma menyentuh kolom `dikemas`, tidak ada jalan lain untuk
--      dia menulis ke tabel manapun.
--   4. products/daily_metrics/monthly_targets: SELECT ditutup untuk role
--      packing juga (dia tidak butuh HPP produk atau spend iklan).
--
-- SETELAH migrasi ini jalan, buat akun Hansen di Supabase Auth seperti
-- biasa, lalu jalankan:
--     update public.profiles set role = 'packing' where email = 'email_hansen@...';
-- =============================================================================

create or replace function public.is_packing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'packing' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'staff' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- transactions: tutup akses langsung untuk role packing.
-- -----------------------------------------------------------------------------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (not public.is_packing());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (not public.is_packing())
  with check (not public.is_packing());

-- -----------------------------------------------------------------------------
-- products, daily_metrics, monthly_targets: role packing tidak butuh ini
-- (HPP produk & spend iklan = data uang yang bukan urusan packing).
-- -----------------------------------------------------------------------------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (not public.is_packing());

drop policy if exists daily_metrics_select on public.daily_metrics;
create policy daily_metrics_select on public.daily_metrics
  for select to authenticated
  using (not public.is_packing());

drop policy if exists monthly_targets_select on public.monthly_targets;
create policy monthly_targets_select on public.monthly_targets
  for select to authenticated
  using (not public.is_packing());

-- -----------------------------------------------------------------------------
-- Antrian packing — HANYA kolom operasional + harga per transaksi (bukan
-- agregat/total). TIDAK ADA hpp, modal, ongkir, admin, profit_kotor.
-- Sengaja bukan security_invoker=true, lihat catatan di atas.
-- -----------------------------------------------------------------------------
drop view if exists public.v_packing_queue;

create view public.v_packing_queue
as
select
  t.id,
  t.tanggal,
  t.customer,
  t.customer_phone,
  t.produk_nama,
  t.qty,
  t.harga,
  (t.qty * t.harga) as total_harga, -- per transaksi, buat cocok resi/COD
  t.status,
  t.dikemas,
  t.catatan,
  t.created_at
from public.transactions t
where t.channel = 'online'
order by t.tanggal desc, t.created_at desc;

grant select on public.v_packing_queue to authenticated;

-- -----------------------------------------------------------------------------
-- Satu-satunya cara role packing menulis data: cuma kolom `dikemas`, cuma
-- transaksi online. Admin/staff juga lewat sini sekarang (satu jalur, satu
-- titik pengecekan) — lihat src/lib/transactions.ts.
-- -----------------------------------------------------------------------------
create or replace function public.mark_dikemas(p_id uuid, p_dikemas boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_staff() or public.is_packing()) then
    raise exception 'Tidak diizinkan';
  end if;

  update public.transactions
    set dikemas = p_dikemas
    where id = p_id
      and channel = 'online';
end $$;

revoke all on function public.mark_dikemas(uuid, boolean) from public;
grant execute on function public.mark_dikemas(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
