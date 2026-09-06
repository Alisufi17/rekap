# Bug di `index.html` versi lama

Ditemukan saat membaca kode sebelum rebuild. Dicatat supaya tidak ikut terbawa
ke versi baru.

## 1. Chart tren harian bergeser satu hari — `index.html:487`

```js
const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
const key = d.toISOString().slice(0,10);
```

`setHours(0,0,0,0)` memberi tengah malam **waktu lokal**. `toISOString()`
mengubahnya ke UTC. Di WIB (UTC+7), tengah malam 6 Sep = 5 Sep pukul 17:00 UTC,
sehingga `key` menjadi `"2026-09-05"`.

Akibatnya batang berlabel "6 Sep" menjumlahkan transaksi bertanggal 5 September.
Kalender bulanan (`computeCalendarData`) menyusun tanggalnya secara manual dan
**benar**, jadi angka kalender dan angka chart tidak pernah cocok.

Perbaikan: susun tanggal dari komponen lokal, jangan lewat `toISOString`.

## 2. `todayStr()` salah tanggal antara 00:00–07:00 WIB — `index.html:209`

Sebab yang sama. Transaksi yang diinput lewat tengah malam tersimpan dengan
tanggal kemarin.

## 3. Box "Offline" muncul dua kali di dashboard — `index.html:589` dan `591`

Duplikat hasil copy-paste, plus satu `</div>` nyasar yang menutup `.screen`
lebih awal.

## 4. Update stok bisa hilang

`submitTransaction`, `updateTxStatus`, dan `deleteTx` membaca stok dari state
browser lalu menulis balik nilai absolut. Dua orang input bersamaan → keduanya
membaca angka yang sama → satu pengurangan hilang.

Diperbaiki di `0002_stock_engine.sql` (perubahan relatif di dalam transaksi
database).

## 5. Offline "Belum Lunas" dihitung sebagai omset terkonfirmasi — `index.html:447`

```js
function isCounted(tx){ if(tx.channel==='online') return tx.status==='selesai'; return true; }
```

Semua offline dihitung, termasuk yang belum dibayar. Tidak konsisten dengan
online "proses" yang dipisahkan sebagai estimasi.

Diperbaiki di `0004_financial_views.sql`: offline baru terkonfirmasi kalau
`lunas`, yang `belum` masuk kolom `piutang`.

## 6. `deleteTx` mengembalikan stok sebelum menghapus

Kalau delete gagal, stok sudah terlanjur dikembalikan sementara transaksinya
masih ada. Hilang dengan sendirinya setelah 0002 (satu trigger, satu transaksi
database).

## 7. `escapeHtml` tidak konsisten

`t.customer` dan `t.produk_nama` masuk `innerHTML` mentah di `renderTxCard`.
Risiko rendah (input dari tim sendiri), hilang otomatis di React.

## 8. Realtime memicu reload penuh

Setiap perubahan dari anggota tim lain memanggil `loadData()` lalu
`render()` yang menimpa seluruh `innerHTML` — form yang sedang diisi
ter-render ulang. Ditambah `select('*')` tanpa pagination.
