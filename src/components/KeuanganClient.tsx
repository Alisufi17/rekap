"use client";

import { useState } from "react";
import {
  upsertMonthlyTarget,
  addOperatingExpense,
  deleteOperatingExpense,
  copyRecurringExpenses,
  addPencairanDana,
  deletePencairanDana,
} from "@/lib/finance";
import { fmtIDR, fmtDate, localDateStr, todayStr } from "@/lib/format";
import type {
  ExpenseCategory,
  ExpenseCategoryCode,
  OperatingExpense,
  MonthlyTarget,
  VMonthlyPnl,
  PencairanDana,
} from "@/types/database";

function firstOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return localDateStr(x);
}

export default function KeuanganClient({
  categories,
  expenses,
  target,
  pnl,
  pencairanDana,
}: {
  categories: ExpenseCategory[];
  expenses: OperatingExpense[];
  target: MonthlyTarget | null;
  pnl: VMonthlyPnl | null;
  pencairanDana: PencairanDana[];
}) {
  const bulanIni = firstOfMonth();

  return (
    <div className="space-y-5">
      <RingkasanBulan pnl={pnl} />
      <TargetForm bulan={bulanIni} target={target} />
      <PencairanDanaSection dana={pencairanDana} />
      <TopUpIklanForm />
      <BiayaOperasional bulan={bulanIni} categories={categories} expenses={expenses} />
    </div>
  );
}

function PencairanDanaSection({ dana }: { dana: PencairanDana[] }) {
  const [tanggal, setTanggal] = useState(todayStr());
  const [sumber, setSumber] = useState("Mengantar");
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const totalBulanIni = dana.reduce((s, d) => s + d.nominal, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await addPencairanDana({
      tanggal,
      sumber,
      nominal: parseFloat(nominal) || 0,
      catatan,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setNominal("");
    setCatatan("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan pencairan ini?")) return;
    await deletePencairanDana(id);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold">Pencairan Dana</div>
        <div className="text-xs text-ink-soft">
          Bulan ini <b className="num text-ink">{fmtIDR(totalBulanIni)}</b>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              max={todayStr()}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Sumber</label>
            <input
              type="text"
              value={sumber}
              onChange={(e) => setSumber(e.target.value)}
              placeholder="Mengantar"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Nominal Cair</label>
          <input
            type="number"
            min={0}
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
        {error && <div className="text-sm text-accent">{error}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Catat Pencairan"}
        </button>
      </form>

      {dana.length === 0 ? (
        <div className="py-4 text-center text-sm text-ink-faint">
          Belum ada pencairan dana bulan ini.
        </div>
      ) : (
        <div className="space-y-2">
          {dana.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-border bg-white p-3"
            >
              <div>
                <div className="text-sm font-medium">{d.sumber}</div>
                <div className="text-xs text-ink-faint">
                  {fmtDate(d.tanggal)}
                  {d.catatan ? ` · ${d.catatan}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="num text-sm font-semibold text-primary">{fmtIDR(d.nominal)}</div>
                <button onClick={() => handleDelete(d.id)} className="text-xs text-accent">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopUpIklanForm() {
  const [tanggal, setTanggal] = useState(todayStr());
  const [transfer, setTransfer] = useState("");
  const [saldoMasuk, setSaldoMasuk] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const transferNum = parseFloat(transfer) || 0;
  const saldoNum = parseFloat(saldoMasuk) || 0;
  const fee = Math.max(0, transferNum - saldoNum);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fee <= 0) {
      setError("Isi Transfer dan Saldo Masuk dulu — fee dihitung dari selisihnya");
      return;
    }
    setSaving(true);
    setError("");
    setSavedMsg("");
    const res = await addOperatingExpense({
      tanggal,
      kategori: "topup_iklan",
      nominal: fee,
      catatan: `Transfer ${fmtIDR(transferNum)} → saldo masuk ${fmtIDR(saldoNum)}`,
      berulang: false,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setTransfer("");
    setSaldoMasuk("");
    setSavedMsg(`Fee ${fmtIDR(fee)} dicatat sebagai Biaya Operasional`);
  }

  return (
    <div>
      <div className="mb-2 text-sm font-bold">Catat Top Up Iklan</div>
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            max={todayStr()}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Transfer (uang keluar)
            </label>
            <input
              type="number"
              min={0}
              value={transfer}
              onChange={(e) => setTransfer(e.target.value)}
              placeholder="505000"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Saldo Masuk</label>
            <input
              type="number"
              min={0}
              value={saldoMasuk}
              onChange={(e) => setSaldoMasuk(e.target.value)}
              placeholder="475000"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-sm">
          <span className="text-ink-soft">Fee (otomatis)</span>
          <span className="num font-bold text-accent">{fmtIDR(fee)}</span>
        </div>
        {error && <div className="text-sm text-accent">{error}</div>}
        {savedMsg && <div className="text-xs text-ink-soft">{savedMsg}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Catat Fee Top Up"}
        </button>
      </form>
    </div>
  );
}

function RingkasanBulan({ pnl }: { pnl: VMonthlyPnl | null }) {
  if (!pnl) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Laba Rugi Bulan Ini
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <Row label="Omset" value={fmtIDR(pnl.omset)} />
        <Row label="Profit kotor (setelah HPP, ongkir, admin)" value={fmtIDR(pnl.profit_kotor)} />
        <Row label="Spend iklan" value={`-${fmtIDR(pnl.spend_iklan)}`} />
        <Row label="Biaya operasional" value={`-${fmtIDR(pnl.biaya_operasional)}`} />
        <div className="my-1 border-t border-border" />
        <Row label="Profit bersih" value={fmtIDR(pnl.profit_bersih)} bold />
        {pnl.piutang > 0 && (
          <div className="mt-1 text-xs text-offline">Piutang belum lunas: {fmtIDR(pnl.piutang)}</div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-surface p-3 text-xs">
        <div className="mb-1.5 font-semibold text-ink-soft">Rincian Biaya Packing</div>
        <Row label="Bahan (kardus, lakban, dll)" value={fmtIDR(pnl.biaya_packing_bahan)} />
        <Row
          label={`Upah Hansen (${pnl.jumlah_transaksi_semua} transaksi × Rp2.000)`}
          value={fmtIDR(pnl.biaya_packing_hansen)}
        />
        <div className="my-1 border-t border-border" />
        <Row label="Total Biaya Packing" value={fmtIDR(pnl.biaya_packing_total)} bold />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : "text-ink-soft"}`}>
      <span>{label}</span>
      <span className="num text-ink">{value}</span>
    </div>
  );
}

function TargetForm({ bulan, target }: { bulan: string; target: MonthlyTarget | null }) {
  const [targetOmset, setTargetOmset] = useState(String(target?.target_omset ?? ""));
  const [targetProfit, setTargetProfit] = useState(String(target?.target_profit ?? ""));
  const [catatan, setCatatan] = useState(target?.catatan ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    const res = await upsertMonthlyTarget({
      bulan,
      targetOmset: parseFloat(targetOmset) || 0,
      targetProfit: parseFloat(targetProfit) || 0,
      catatan,
    });
    setSaving(false);
    setSavedMsg(res.ok ? "Target disimpan" : res.error || "Gagal menyimpan");
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-sm font-bold">
        Target Bulan {new Date(bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
      </div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Target Omset</label>
            <input
              type="number"
              min={0}
              value={targetOmset}
              onChange={(e) => setTargetOmset(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Target Profit Bersih</label>
            <input
              type="number"
              min={0}
              value={targetProfit}
              onChange={(e) => setTargetProfit(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
        {savedMsg && <div className="text-xs text-ink-soft">{savedMsg}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan Target"}
        </button>
      </form>
    </div>
  );
}

function BiayaOperasional({
  bulan,
  categories,
  expenses,
}: {
  bulan: string;
  categories: ExpenseCategory[];
  expenses: OperatingExpense[];
}) {
  const [tanggal, setTanggal] = useState(todayStr());
  const [kategori, setKategori] = useState<ExpenseCategoryCode>(categories[0]?.kode ?? "lainnya");
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berulang, setBerulang] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await addOperatingExpense({
      tanggal,
      kategori: kategori as OperatingExpense["kategori"],
      nominal: parseFloat(nominal) || 0,
      catatan,
      berulang,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setNominal("");
    setCatatan("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus biaya ini?")) return;
    await deleteOperatingExpense(id);
  }

  async function handleCopyRecurring() {
    setCopyMsg("Menyalin...");
    const res = await copyRecurringExpenses(bulan);
    setCopyMsg(res.ok ? `${res.count ?? 0} biaya berulang disalin` : res.error || "Gagal");
  }

  const catName = (kode: string) => categories.find((c) => c.kode === kode)?.nama ?? kode;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold">Biaya Operasional</div>
        <button onClick={handleCopyRecurring} className="text-xs font-semibold text-primary">
          Salin biaya berulang bulan lalu
        </button>
      </div>
      {copyMsg && <div className="mb-2 text-xs text-ink-soft">{copyMsg}</div>}

      <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              max={todayStr()}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Kategori</label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value as ExpenseCategoryCode)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.kode} value={c.kode}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Nominal</label>
          <input
            type="number"
            min={0}
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={berulang} onChange={(e) => setBerulang(e.target.checked)} />
          Biaya berulang tiap bulan (gaji, listrik, sewa)
        </label>
        {error && <div className="text-sm text-accent">{error}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Tambah Biaya"}
        </button>
      </form>

      {expenses.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-faint">Belum ada biaya operasional.</div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-border bg-white p-3"
            >
              <div>
                <div className="text-sm font-medium">{catName(e.kategori)}</div>
                <div className="text-xs text-ink-faint">
                  {fmtDate(e.tanggal)}
                  {e.catatan ? ` · ${e.catatan}` : ""}
                  {e.berulang ? " · berulang" : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="num text-sm font-semibold">{fmtIDR(e.nominal)}</div>
                <button onClick={() => handleDelete(e.id)} className="text-xs text-accent">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
