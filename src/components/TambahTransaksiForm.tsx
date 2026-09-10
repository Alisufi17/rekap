"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/lib/transactions";
import { fmtIDR, todayStr } from "@/lib/format";
import type { Product } from "@/types/database";

const DRAFT_KEY = "rekap_tx_draft_v2";

interface Draft {
  channel: "online" | "offline";
  tanggal: string;
  customer: string;
  phone: string;
  produkId: string;
  qty: string;
  total: string;
  hpp: string;
  ongkir: string;
  catatan: string;
  lunas: string;
  historis: boolean;
}

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") || {};
  } catch {
    return {};
  }
}
function saveDraft(d: Partial<Draft>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // localStorage penuh atau diblokir browser — draft tidak tersimpan,
    // tidak fatal untuk alur input transaksi.
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // aman diabaikan, lihat catatan di saveDraft
  }
}

export default function TambahTransaksiForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [channel, setChannel] = useState<"online" | "offline">("online");
  const [tanggal, setTanggal] = useState(todayStr());
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [produkId, setProdukId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [hpp, setHpp] = useState(String(products[0]?.hpp ?? 0));
  const [ongkir, setOngkir] = useState("");
  const [catatan, setCatatan] = useState("");
  const [lunas, setLunas] = useState("lunas");
  const [historis, setHistoris] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    if (d.channel) setChannel(d.channel);
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.customer) setCustomer(d.customer);
    if (d.phone) setPhone(d.phone);
    if (d.produkId && products.some((p) => p.id === d.produkId)) setProdukId(d.produkId);
    if (d.qty) setQty(d.qty);
    if (d.total) setTotal(d.total);
    if (d.hpp) setHpp(d.hpp);
    if (d.ongkir) setOngkir(d.ongkir);
    if (d.catatan) setCatatan(d.catatan);
    if (d.lunas) setLunas(d.lunas);
    if (d.historis) setHistoris(d.historis);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveDraft({
      channel,
      tanggal,
      customer,
      phone,
      produkId,
      qty,
      total,
      hpp,
      ongkir,
      catatan,
      lunas,
      historis,
    });
  }, [ready, channel, tanggal, customer, phone, produkId, qty, total, hpp, ongkir, catatan, lunas, historis]);

  if (products.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-ink-faint">
        <div className="mb-2 text-2xl">📦</div>
        Tambahkan produk dulu di tab Produk
        <br />
        sebelum mencatat transaksi.
      </div>
    );
  }

  const qtyNum = parseFloat(qty) || 0;
  const totalNum = parseFloat(total) || 0;
  const hppNum = parseFloat(hpp) || 0;
  const ongkirNum = parseFloat(ongkir) || 0;
  const perPcs = qtyNum > 0 ? totalNum / qtyNum : 0;
  const modal = qtyNum * hppNum;
  const BIAYA_PACKING = 2000;
  const profit =
    (channel === "online" ? totalNum - modal - ongkirNum : totalNum - modal) - BIAYA_PACKING;

  function onProductPick(id: string) {
    setProdukId(id);
    const pr = products.find((p) => p.id === id);
    if (pr) setHpp(String(pr.hpp));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const produk = products.find((p) => p.id === produkId);
    if (!produk || qtyNum <= 0) {
      setError("Lengkapi produk & qty");
      return;
    }
    setSaving(true);
    setError("");
    const res = await createTransaction({
      channel,
      tanggal,
      customer,
      customerPhone: phone,
      produkId,
      produkNama: produk.nama,
      qty: qtyNum,
      totalHarga: totalNum,
      hpp: hppNum,
      ongkir: ongkirNum,
      admin: 0,
      catatan,
      status: channel === "offline" ? lunas : "proses",
      affectsStock: !historis,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan transaksi");
      return;
    }
    clearDraft();
    router.push("/transaksi");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-lg border border-border bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setChannel("online")}
          className={`flex-1 rounded-md py-2 font-medium ${
            channel === "online" ? "bg-online text-white" : "text-ink-soft"
          }`}
        >
          Online
        </button>
        <button
          type="button"
          onClick={() => setChannel("offline")}
          className={`flex-1 rounded-md py-2 font-medium ${
            channel === "offline" ? "bg-offline text-white" : "text-ink-soft"
          }`}
        >
          Offline
        </button>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-border bg-white p-3 text-xs">
        <input
          type="checkbox"
          checked={historis}
          onChange={(e) => setHistoris(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block font-semibold text-ink">Data lama dari buku catatan</span>
          <span className="text-ink-soft">
            Centang ini untuk transaksi lampau yang sedang dipindahkan dari catatan manual — stok
            produk yang ada di rak sekarang <b>tidak akan dikurangi</b>. Biarkan tidak dicentang
            untuk transaksi hari ini / berjalan.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal">
          <input
            type="date"
            value={tanggal}
            max={todayStr()}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </Field>
        <Field label="Customer">
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Nama customer"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </Field>
      </div>

      <Field label="No. HP / WhatsApp">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
      </Field>

      <Field label="Produk">
        <select
          value={produkId}
          onChange={(e) => onProductPick(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama} (stok {p.stok})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Qty">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </Field>
        <Field label="Harga Total (sudah nego)">
          <input
            type="number"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="mis. 120000 untuk semua qty"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
          {qtyNum > 1 && (
            <div className="mt-1 text-xs text-ink-faint">≈ {fmtIDR(perPcs)} / pcs</div>
          )}
        </Field>
      </div>

      <Field label="HPP / pcs">
        <input
          type="number"
          min={0}
          value={hpp}
          onChange={(e) => setHpp(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
      </Field>

      {channel === "online" ? (
        <Field label="Ongkir">
          <input
            type="number"
            min={0}
            value={ongkir}
            onChange={(e) => setOngkir(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </Field>
      ) : (
        <Field label="Status Pembayaran">
          <select
            value={lunas}
            onChange={(e) => setLunas(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          >
            <option value="lunas">Lunas</option>
            <option value="belum">Belum Lunas</option>
          </select>
        </Field>
      )}

      <Field label="Catatan">
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="opsional"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          rows={2}
        />
      </Field>

      <div className="rounded-lg border border-border bg-white p-3 text-sm">
        <Row label="Omset (total deal)" value={fmtIDR(totalNum)} />
        <Row label="Modal (HPP × qty)" value={`-${fmtIDR(modal)}`} />
        {channel === "online" && <Row label="Ongkir" value={`-${fmtIDR(ongkirNum)}`} />}
        <Row label="Biaya Packing" value={`-${fmtIDR(BIAYA_PACKING)}`} />
        <Row label="Estimasi Profit" value={fmtIDR(profit)} bold />
      </div>

      {error && <div className="text-sm text-accent">{error}</div>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Menyimpan..." : "Simpan Transaksi"}
      </button>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
