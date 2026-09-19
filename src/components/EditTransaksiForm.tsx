"use client";

import { useState } from "react";
import { updateTransaction } from "@/lib/transactions";
import { fmtIDR, todayStr } from "@/lib/format";
import { BIAYA_PACKING, hitungOngkir, hitungProfitPreview } from "@/lib/pricing";
import type { Product, VTransaction } from "@/types/database";

export default function EditTransaksiForm({
  t,
  products,
  onDone,
}: {
  t: VTransaction;
  products: Product[];
  onDone: () => void;
}) {
  const isOnline = t.channel === "online";
  const [tanggal, setTanggal] = useState(t.tanggal);
  const [customer, setCustomer] = useState(t.customer === "-" ? "" : t.customer);
  const [phone, setPhone] = useState(t.customer_phone ?? "");
  const [produkId, setProdukId] = useState(t.produk_id);
  const [qty, setQty] = useState(String(t.qty));
  const [total, setTotal] = useState(String(t.omset));
  // Ongkir tersimpan yang beda dari tarif standar dianggap sengaja diubah
  // manual — jangan ditimpa diam-diam saat form dibuka.
  const [ongkirOverride, setOngkirOverride] = useState<string | null>(
    t.ongkir === hitungOngkir(t.qty) ? null : String(t.ongkir)
  );
  const [catatan, setCatatan] = useState(t.catatan ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qtyNum = parseFloat(qty) || 0;
  const totalNum = parseFloat(total) || 0;
  const ongkirStandar = hitungOngkir(qtyNum);
  const ongkirNum = ongkirOverride !== null ? parseFloat(ongkirOverride) || 0 : ongkirStandar;
  const produkBerubah = produkId !== t.produk_id;
  const hppPerPcs = produkBerubah ? (products.find((p) => p.id === produkId)?.hpp ?? t.hpp) : t.hpp;
  const profit = hitungProfitPreview({
    channel: t.channel,
    totalHarga: totalNum,
    qty: qtyNum,
    hpp: hppPerPcs,
    ongkir: ongkirNum,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (qtyNum <= 0) {
      setError("Qty harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    const res = await updateTransaction(t.id, {
      tanggal,
      customer,
      customerPhone: phone,
      produkId,
      qty: qtyNum,
      totalHarga: totalNum,
      ongkir: ongkirNum,
      catatan,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan perubahan");
      return;
    }
    onDone();
  }

  const input = "w-full rounded-lg border border-border px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSave} className="rounded-xl border-2 border-primary/40 bg-white p-3.5">
      <div className="mb-3 text-sm font-bold">Edit pesanan</div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal">
            <input
              type="date"
              value={tanggal}
              max={todayStr()}
              onChange={(e) => setTanggal(e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Customer">
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className={input}
            />
          </Field>
        </div>

        <Field label="No. HP / WhatsApp">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
          />
        </Field>

        <Field label="Produk">
          <select value={produkId} onChange={(e) => setProdukId(e.target.value)} className={input}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
          {produkBerubah && (
            <div className="mt-1 text-xs text-ink-faint">
              Produk diganti — HPP ikut HPP produk baru ({fmtIDR(hppPerPcs)}/pcs). Stok kedua produk
              otomatis disesuaikan.
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Harga Total">
            <input
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={input}
            />
          </Field>
        </div>

        {isOnline && (
          <Field label="Ongkir (tarif SiCepat)">
            <input
              type="number"
              min={0}
              value={ongkirOverride ?? String(ongkirStandar)}
              onChange={(e) => setOngkirOverride(e.target.value)}
              className={input}
            />
            <div className="mt-1 text-xs text-ink-faint">
              {ongkirOverride === null ? (
                <>Otomatis sesuai jumlah bibit ({qtyNum || 0} bibit = {fmtIDR(ongkirStandar)})</>
              ) : (
                <>
                  Diubah manual ·{" "}
                  <button
                    type="button"
                    onClick={() => setOngkirOverride(null)}
                    className="font-semibold text-primary"
                  >
                    pakai tarif standar {fmtIDR(ongkirStandar)}
                  </button>
                </>
              )}
            </div>
          </Field>
        )}

        <Field label="Catatan">
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            className={input}
          />
        </Field>

        <div className="rounded-lg bg-surface p-2.5 text-xs text-ink-soft">
          <div className="flex justify-between">
            <span>Modal ({fmtIDR(hppPerPcs)} × {qtyNum || 0})</span>
            <span className="num">−{fmtIDR(qtyNum * hppPerPcs)}</span>
          </div>
          {isOnline && (
            <div className="flex justify-between">
              <span>Ongkir</span>
              <span className="num">−{fmtIDR(ongkirNum)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Biaya packing</span>
            <span className="num">−{fmtIDR(BIAYA_PACKING)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-bold text-ink">
            <span>Estimasi profit</span>
            <span className="num">{fmtIDR(profit)}</span>
          </div>
        </div>

        {error && <div className="text-sm text-accent">{error}</div>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            disabled={saving}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-ink-soft"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}
