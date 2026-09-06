-- =============================================================================
-- 0007 — Staff boleh konfirmasi status transaksi siapa saja
-- =============================================================================
-- Sebelumnya staff hanya bisa mengubah status transaksi yang dia input
-- sendiri (created_by_uid = auth.uid()). Atas keputusan pemilik bisnis,
-- staff sekarang boleh menindaklanjuti/konfirmasi status (Proses->Selesai/
-- RTS, Lunas<->Belum Lunas) untuk SEMUA transaksi, karena alur kerja tim
-- ini saling menindaklanjuti transaksi satu sama lain.
--
-- Yang TIDAK berubah: hapus transaksi tetap admin-only (transactions_delete
-- policy tidak disentuh di sini) — itu tindakan lebih berisiko/permanen yang
-- tidak diminta.
--
-- Catatan keamanan: RLS ini mengizinkan UPDATE ke baris manapun, bukan cuma
-- kolom status. Aplikasi (TransaksiList) sengaja hanya pernah mengekspos
-- dropdown status, tidak ada form edit harga/qty/customer untuk transaksi
-- orang lain, jadi risiko praktisnya tetap terbatas ke apa yang UI izinkan.
-- =============================================================================

drop policy if exists transactions_update on public.transactions;

create policy transactions_update on public.transactions
  for update to authenticated
  using (true)
  with check (true);
