# Rekap — Sales Tracker

Aplikasi tracking penjualan (Meta Ads online + offline). Sedang dipindahkan dari
satu file `index.html` ke aplikasi Next.js dengan database Supabase.

Live saat ini: https://kasirkiojay.vercel.app

## Status

| Bagian | Status |
| --- | --- |
| Skema database (role, biaya operasional, target, mesin stok, view keuangan) | **Selesai ditulis, belum dijalankan** |
| Frontend Next.js (dashboard, transaksi, produk, keuangan, pelanggan, akun) | **Ditulis lengkap, belum pernah di-`npm install` / dijalankan / di-build** — lihat peringatan di bawah |
| Repo Git | Sudah (`git init` + 2 commit) |
| Auto-deploy Vercel | Belum |

⚠️ **Kode frontend belum pernah dijalankan sama sekali.** Ditulis manual tanpa
`npm install`, `next dev`, atau `tsc` karena Node.js gagal terpasang di mesin
ini (lihat Prasyarat). Kemungkinan ada typo, import salah, atau ketidakcocokan
versi paket yang baru kelihatan saat pertama kali dijalankan. Jalankan
`npm run typecheck` dan `npm run dev` lalu perbaiki error yang muncul sebelum
menganggap bagian ini selesai.

## Prasyarat

Node.js belum berhasil terpasang di mesin ini — instalasi lewat `winget`
berulang kali berhenti menunggu **prompt izin admin (UAC)** yang tidak
ter-approve (kemungkinan karena dijalankan dari sesi non-interaktif). Pasang
sendiri lewat salah satu cara ini:

**Cara 1 — winget** (jalankan dari PowerShell/Command Prompt kamu sendiri,
bukan lewat Claude, supaya prompt UAC bisa langsung diklik):
```
winget install OpenJS.NodeJS.LTS
```

**Cara 2 — installer manual** kalau winget tetap bermasalah: unduh installer
`.msi` versi LTS dari https://nodejs.org, jalankan, ikuti wizard-nya.

Setelah salah satu selesai, **tutup dan buka ulang terminal**, cek dengan:
```
node -v
npm -v
```

Lalu jalankan:
```
npm install
npm run dev
```
Buka `http://localhost:3000` — akan redirect ke `/login`. Login pakai akun
Supabase yang sama dengan `kasirkiojay.vercel.app`.

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

## Struktur halaman

| Route | Isi | Akses |
| --- | --- | --- |
| `/login` | Login email/password | semua |
| `/dashboard` | Omset, profit, tren, produk terlaris, RTS, target bulan ini | semua (target & iklan hanya tampil untuk admin) |
| `/dashboard/iklan` | Input spend iklan & chat masuk harian | admin |
| `/transaksi` | Daftar transaksi + filter + ubah status + hapus | semua (hapus & ubah status transaksi orang lain: admin) |
| `/transaksi/tambah` | Input transaksi baru, boleh tanggal mundur, toggle "data historis" | semua |
| `/produk` | Daftar produk + stok | semua (ubah HPP/stok: admin) |
| `/keuangan` | Biaya operasional + target bulanan + ringkasan laba rugi | admin |
| `/pelanggan` | Database pelanggan agregat dari transaksi + tombol WA | semua |
| `/akun` | Info akun, role, logout | semua |

`src/lib/*.ts` (kecuali `format.ts` dan `dashboard.ts`) berisi Server Actions
— jalan di server, dipanggil langsung dari Client Component. RLS di database
tetap jadi pertahanan utama; pengecekan role di situ hanya untuk pesan error
yang lebih ramah.

## Catatan

- `salin_biaya_berulang(date)` menyalin biaya bertanda `berulang` dari bulan
  sebelumnya. Kalau ada biaya bertanggal 29–31, cek hasilnya di bulan yang
  lebih pendek.
- Stok sekarang boleh negatif — itu disengaja, supaya selisih catatan versus
  fisik kelihatan alih-alih tertutup angka nol.
