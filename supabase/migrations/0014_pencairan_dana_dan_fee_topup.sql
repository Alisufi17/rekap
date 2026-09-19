-- =============================================================================
-- 0014 — Catat Pencairan Dana (Mengantar) + kategori Fee Top Up Iklan
-- =============================================================================
-- Dua kebutuhan terpisah:
--
--   1. Pencairan Dana: catatan sederhana tiap kali dana cair dari platform
--      pengantaran (mis. "Mengantar") ke rekening pemilik. Ini BUKAN
--      rekonsiliasi otomatis ke omset tercatat — cuma log kas masuk biar
--      ada jejaknya. Tabel baru karena ini uang MASUK, beda arah dari
--      operating_expenses yang isinya uang KELUAR.
--
--   2. Fee Top Up Iklan: kategori baru di expense_categories. Tiap top up
--      iklan (mis. transfer Rp505.000 ke penyedia, tapi saldo iklan yang
--      benar-benar masuk cuma Rp475.000) sekarang bisa dicatat selisihnya
--      (fee Rp30.000) sebagai biaya operasional — sebelumnya biaya ini
--      tidak tercatat di mana pun, bikin Total Pengeluaran & Hasil Final
--      di dashboard kurang akurat (pola yang sama dengan biaya packing).
-- =============================================================================

insert into public.expense_categories (kode, nama, urutan) values
  ('topup_iklan', 'Fee Top Up Iklan', 15)
on conflict (kode) do nothing;

create table if not exists public.pencairan_dana (
  id             uuid primary key default gen_random_uuid(),
  tanggal        date not null,
  sumber         text not null default 'Mengantar',
  nominal        numeric not null check (nominal >= 0),
  catatan        text,
  created_by_uid uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_pencairan_dana_tanggal
  on public.pencairan_dana (tanggal desc);

-- Uang masuk = data finansial, admin saja — sama seperti operating_expenses.
alter table public.pencairan_dana enable row level security;

drop policy if exists pencairan_dana_admin on public.pencairan_dana;
create policy pencairan_dana_admin on public.pencairan_dana
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
