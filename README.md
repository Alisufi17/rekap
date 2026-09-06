# Rekap — Sales Tracker

Aplikasi tracking penjualan (Meta Ads online + offline). Sedang dipindahkan dari
satu file `index.html` ke aplikasi Next.js dengan database Supabase.

Live saat ini: https://kasirkiojay.vercel.app

## Status

| Bagian | Status |
| --- | --- |
| Skema database (role, biaya operasional, target, mesin stok, view keuangan) | **Selesai ditulis, belum dijalankan** |
| Frontend Next.js | Belum mulai — menunggu Node.js terpasang |
| Repo Git + auto-deploy Vercel | Belum |

## Prasyarat

Node.js belum terpasang di mesin ini:

```
winget install OpenJS.NodeJS.LTS
```

Tutup dan buka ulang terminal setelahnya, lalu cek dengan `node -v`.

## Menjalankan migrasi

Jalankan berurutan di **Supabase Dashboard → SQL Editor**, satu file satu kali
jalan, periksa hasilnya sebelum lanjut ke berikutnya.

| Urutan | File | Isi |
| --- | --- | --- |
| 1 | `supabase/migrations/0001_roles_and_profiles.sql` | Tabel `profiles`, role admin/staff, RLS semua tabel |
| 2 | `supabase/migrations/0002_stock_engine.sql` | Stok pindah ke trigger database, kolom `affects_stock` |
| 3 | `supabase/migrations/0003_expenses_and_targets.sql` | Biaya operasional + target bulanan |
| 4 | `supabase/migrations/0004_financial_views.sql` | View omset/profit/laba rugi |

**Backup dulu** sebelum menjalankan (Supabase → Database → Backups), karena ini
menyentuh data produksi.

### Sesudah migrasi 1 jalan

Semua akun yang sudah ada otomatis jadi **admin** supaya tidak ada yang
terkunci. Turunkan yang perlu jadi staff:

```sql
update public.profiles set role = 'staff' where email = 'staffmu@contoh.com';
select email, role from public.profiles order by role, email;
```

### Sesudah migrasi 2 jalan

Frontend lama (`index.html`) **masih mengurangi stok sendiri dari browser**.
Begitu trigger aktif, stok akan berkurang dua kali lipat. Pilih salah satu:

- **Jangan jalankan 0002 dulu** sampai frontend baru siap, atau
- jalankan 0002 sekarang dan segera hapus tiga blok update stok di
  `index.html` (di `submitTransaction`, `updateTxStatus`, dan `deleteTx`).

## Pembagian akses

| | Admin | Staff |
| --- | --- | --- |
| Lihat transaksi | ya | ya |
| Input transaksi | ya | ya |
| Ubah transaksi | semua | hanya miliknya sendiri |
| Hapus transaksi | ya | tidak |
| Ubah produk & HPP | ya | tidak |
| Input spend iklan | ya | tidak |
| Biaya operasional (termasuk gaji) | ya | tidak bisa lihat |
| Target bulanan | ubah | lihat saja |

Dijaga oleh RLS di database, bukan oleh tampilan — jadi tidak bisa ditembus
lewat browser.

## Input data lama dari buku catatan

Transaksi berapa pun tanggalnya boleh diinput. Yang perlu diperhatikan: **jangan
biarkan transaksi historis mengurangi stok fisik yang ada di rak sekarang.**

Alur yang benar:

1. Input semua transaksi lama dengan `affects_stock = false`.
2. Setelah selesai, hitung stok fisik di gudang dan set manual di tabel produk.
3. Transaksi baru mulai hari ini pakai `affects_stock = true` (default).

Untuk setiap transaksi historis, isi **HPP yang berlaku saat itu**, bukan HPP
sekarang. HPP disimpan per transaksi, jadi profit historis tetap akurat tanpa
perlu tabel riwayat harga terpisah.

## Catatan

- `salin_biaya_berulang(date)` menyalin biaya bertanda `berulang` dari bulan
  sebelumnya. Kalau ada biaya bertanggal 29–31, cek hasilnya di bulan yang
  lebih pendek.
- Stok sekarang boleh negatif — itu disengaja, supaya selisih catatan versus
  fisik kelihatan alih-alih tertutup angka nol.
