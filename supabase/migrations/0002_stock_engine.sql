-- =============================================================================
-- 0002 — Mesin stok pindah dari browser ke database
-- =============================================================================
-- Masalah yang diperbaiki:
--
-- 1. LOST UPDATE. Kode lama membaca stok dari state di browser lalu menulis
--    balik nilai absolut (stok = 12 - 2 = 10). Kalau dua orang input barengan,
--    keduanya membaca 12, keduanya menulis 10, dan satu pengurangan hilang.
--    Di sini stok diubah relatif (stok = stok - qty) di dalam transaksi
--    database, jadi tidak mungkin bentrok.
--
-- 2. INPUT MUNDUR (backfill dari buku catatan). Transaksi lama tidak boleh
--    mengurangi stok yang ada di rak sekarang. Kolom `affects_stock` = false
--    untuk data historis.
--
-- 3. KONSISTENSI. Semua jalur (insert / ubah status / ubah qty / ganti produk /
--    hapus) lewat satu fungsi yang sama. Tidak ada lagi cabang logika yang
--    kelupaan di frontend.
-- =============================================================================

alter table public.transactions
  add column if not exists affects_stock boolean not null default true;

comment on column public.transactions.affects_stock is
  'false untuk transaksi historis yang diinput dari buku catatan — stok fisik '
  'sekarang tidak boleh ikut berkurang. Set true untuk transaksi berjalan.';

-- -----------------------------------------------------------------------------
-- Berapa unit yang "sedang dipegang" oleh sebuah baris transaksi.
-- RTS = barang kembali ke gudang, jadi nol.
-- -----------------------------------------------------------------------------
create or replace function public.tx_stock_hold(
  p_affects_stock boolean,
  p_status        text,
  p_qty           numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_affects_stock is not true then 0
    when p_status = 'rts'            then 0
    else coalesce(p_qty, 0)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Satu trigger untuk semua perubahan. Kembalikan stok yang dipegang baris lama,
-- lalu tahan stok untuk baris baru. Ganti produk pun otomatis benar karena
-- pengembalian dan pengurangan menargetkan produk masing-masing.
--
-- SECURITY DEFINER supaya staff tetap bisa mengurangi stok lewat transaksi,
-- meskipun policy products melarang staff menulis langsung ke tabel products.
-- -----------------------------------------------------------------------------
create or replace function public.sync_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric := 0;
  v_new numeric := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := public.tx_stock_hold(old.affects_stock, old.status, old.qty);
    if v_old <> 0 then
      update public.products
         set stok = coalesce(stok, 0) + v_old
       where id = old.produk_id;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new := public.tx_stock_hold(new.affects_stock, new.status, new.qty);
    if v_new <> 0 then
      update public.products
         set stok = coalesce(stok, 0) - v_new
       where id = new.produk_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_product_stock on public.transactions;
create trigger trg_sync_product_stock
  after insert or update or delete on public.transactions
  for each row execute function public.sync_product_stock();

-- =============================================================================
-- CATATAN: stok sekarang BOLEH negatif.
-- =============================================================================
-- Kode lama memakai Math.max(0, ...) sehingga stok mentok di nol. Itu menutupi
-- masalah: kalau stok tercatat 3 tapi terjual 5, angka nol membuatnya seolah
-- pas. Dengan stok negatif, selisihnya kelihatan dan bisa ditelusuri.
--
-- Kalau nanti mau melarang penjualan melebihi stok, tambahkan constraint ini
-- SETELAH backfill data historis selesai dan stok sudah dicocokkan dengan
-- hitungan fisik di gudang:
--
--   alter table public.products add constraint products_stok_non_negatif
--     check (stok >= 0);
-- =============================================================================
