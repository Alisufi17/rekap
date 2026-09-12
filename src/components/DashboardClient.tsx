"use client";

import { useState } from "react";
import Link from "next/link";
import {
  computeDashboard,
  computeAlerts,
  rangeForPreset,
  rangeLabel,
  RTS_RISK_DAYS,
  type PresetKey,
  type DateRange,
} from "@/lib/dashboard";
import { fmtIDR, fmtDate, todayStr } from "@/lib/format";
import TrendChart from "@/components/TrendChart";
import type { VTransaction, DailyMetric, VMonthlyPnl, Product, OperatingExpense } from "@/types/database";

const PRESETS: [PresetKey, string][] = [
  ["hari_ini", "Hari ini"],
  ["kemarin", "Kemarin"],
  ["7_hari", "7 hari"],
  ["30_hari", "30 hari"],
  ["bulan_ini", "Bulan ini"],
  ["bulan_lalu", "Bulan lalu"],
];

export default function DashboardClient({
  transactions,
  dailyMetrics,
  expenses,
  monthlyPnl,
  isAdmin,
  lowStockProducts,
  initialFrom,
  initialTo,
}: {
  transactions: VTransaction[];
  dailyMetrics: DailyMetric[];
  expenses: OperatingExpense[];
  monthlyPnl: VMonthlyPnl | null;
  isAdmin: boolean;
  lowStockProducts: Product[];
  initialFrom?: string;
  initialTo?: string;
}) {
  const hasInitialRange = Boolean(initialFrom);
  const [preset, setPreset] = useState<PresetKey>(hasInitialRange ? "custom" : "7_hari");
  const [customRange, setCustomRange] = useState<DateRange>(
    hasInitialRange
      ? { from: initialFrom!, to: initialTo || initialFrom! }
      : { from: todayStr(), to: todayStr() }
  );
  const [showCustomPicker, setShowCustomPicker] = useState(hasInitialRange);
  const [draftFrom, setDraftFrom] = useState(customRange.from);
  const [draftTo, setDraftTo] = useState(customRange.to);

  const range = preset === "custom" ? customRange : rangeForPreset(preset);
  const d = computeDashboard(transactions, dailyMetrics, range, expenses);
  // Alert operasional, lepas dari periode yang dipilih di atas — jangan
  // sampai pesanan yang perlu ditindaklanjuti tersembunyi gara-gara filter
  // tanggal sedang di periode lain.
  const alerts = computeAlerts(transactions);

  function applyPreset(p: PresetKey) {
    setPreset(p);
    setShowCustomPicker(false);
  }

  function applyCustomRange() {
    const from = draftFrom > draftTo ? draftTo : draftFrom;
    const to = draftFrom > draftTo ? draftFrom : draftTo;
    setCustomRange({ from, to });
    setPreset("custom");
  }

  return (
    <div className="space-y-4">
      {alerts.potensiRts.length > 0 && (
        <Link
          href="/transaksi?filter=rts_risk"
          className="block rounded-xl border-2 border-accent/40 bg-accent/5 p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-accent">
              ⚠ {alerts.potensiRts.length} pesanan berpotensi RTS
            </div>
            <span className="text-xs font-semibold text-accent">Cek →</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            Masih &quot;Proses&quot; {RTS_RISK_DAYS}+ hari — segera ditindaklanjuti sebelum jadi
            kerugian.
          </div>
        </Link>
      )}

      {alerts.belumDikemas.length > 0 && (
        <Link
          href="/transaksi?filter=belum_dikemas"
          className="block rounded-xl border-2 border-offline/40 bg-offline/5 p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-offline">
              📦 {alerts.belumDikemas.length} paket belum ditandai dikemas
            </div>
            <span className="text-xs font-semibold text-offline">Cek →</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            Statusnya sudah &quot;Proses&quot; di sistem, tapi belum ada yang menandai fisiknya
            sudah dikemas &amp; dikirim.
          </div>
        </Link>
      )}

      {lowStockProducts.length > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
          <div className="font-semibold text-accent">Stok menipis</div>
          <div className="mt-1 space-y-0.5 text-ink-soft">
            {lowStockProducts.map((p) => (
              <div key={p.id}>
                {p.nama} — tinggal {p.stok}
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && monthlyPnl && (monthlyPnl.target_omset || monthlyPnl.target_profit) ? (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Target Bulan Ini
          </div>
          {monthlyPnl.target_omset ? (
            <TargetBar
              label="Omset"
              current={monthlyPnl.omset}
              target={monthlyPnl.target_omset}
              percent={monthlyPnl.capaian_omset_persen}
            />
          ) : null}
          {monthlyPnl.target_profit ? (
            <TargetBar
              label="Profit bersih"
              current={monthlyPnl.profit_bersih}
              target={monthlyPnl.target_profit}
              percent={monthlyPnl.capaian_profit_persen}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 rounded-lg bg-white p-1.5 text-xs">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className={`rounded-md px-2.5 py-1.5 font-medium ${
              preset === key ? "bg-primary text-white" : "text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomPicker((v) => !v)}
          className={`rounded-md px-2.5 py-1.5 font-medium ${
            preset === "custom" ? "bg-primary text-white" : "text-ink-soft"
          }`}
        >
          Pilih tanggal
        </button>
      </div>

      {showCustomPicker && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-white p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Dari</label>
            <input
              type="date"
              value={draftFrom}
              max={todayStr()}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded-lg border border-border px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Sampai</label>
            <input
              type="date"
              value={draftTo}
              max={todayStr()}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded-lg border border-border px-2.5 py-2 text-sm"
            />
          </div>
          <button
            onClick={applyCustomRange}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            Terapkan
          </button>
        </div>
      )}

      <div className="text-xs text-ink-faint">{rangeLabel(preset, range)}</div>

      <div className="rounded-xl border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold text-ink-soft">Perkiraan Omset</div>
          <div className="num text-base font-extrabold">{fmtIDR(d.estimasiOmset)}</div>
        </div>
        <div className="space-y-2">
          <BreakdownRow
            tone="confirmed"
            label="Omset Terkonfirmasi"
            count={d.confirmedCount}
            value={d.omset}
          />
          <BreakdownRow tone="pending" label="Masih Proses" count={d.masukCount} value={d.masukOmset} />
          <BreakdownRow tone="rts" label="RTS (Retur)" count={d.rtsList.length} value={d.rtsOmset} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold text-ink-soft">Perkiraan Profit</div>
          <div className="num text-base font-extrabold">{fmtIDR(d.estimasiProfit)}</div>
        </div>
        <div className="space-y-2">
          <BreakdownRow
            tone="confirmed"
            label="Profit Terkonfirmasi"
            count={d.confirmedCount}
            value={d.profitKotor}
          />
          <BreakdownRow tone="pending" label="Profit Masih Proses" count={d.masukCount} value={d.masukProfit} />
          {d.rtsList.length > 0 && (
            <BreakdownRow
              tone="rts"
              label="Kerugian RTS (modal+ongkir+packing hangus)"
              count={d.rtsList.length}
              value={-d.rtsLoss}
            />
          )}
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-2.5 text-xs">
          <div>
            Transaksi <b className="num">{d.totalTx}</b>
          </div>
          <div>
            Margin{" "}
            <b className="num">{d.omset > 0 ? Math.round((d.profitKotor / d.omset) * 100) : 0}%</b>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-3 rounded-lg bg-surface p-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink-soft">Profit Bersih (sudah pasti)</span>
              <span
                className={`num font-bold ${
                  d.profitBersih >= 0 ? "text-primary" : "text-accent"
                }`}
              >
                {fmtIDR(d.profitBersih)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">
              Terkonfirmasi ({fmtIDR(d.profitKotor)}) − Kerugian RTS ({fmtIDR(d.rtsLoss)}) − Spend
              Iklan ({fmtIDR(d.totalSpend)})
            </div>
            {d.masukCount > 0 && (
              <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">+ Kalau semua Masih Proses jadi Fix</span>
                  <span className="num font-bold text-primary">{fmtIDR(d.bestCaseProfit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">− Kalau semua Masih Proses jadi RTS/gagal</span>
                  <span
                    className={`num font-bold ${
                      d.worstCaseProfit >= 0 ? "text-primary" : "text-accent"
                    }`}
                  >
                    {fmtIDR(d.worstCaseProfit)}
                  </span>
                </div>
                <div className="text-xs text-ink-faint">
                  Rentang untung/rugi tergantung berapa yang Masih Proses benar-benar terkonfirmasi
                  nanti.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-xl border-2 border-primary/30 bg-white p-4">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Hasil Final (bukan perkiraan)
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Total Dapat (Omset Terkonfirmasi)</span>
              <span className="num font-bold text-primary">{fmtIDR(d.omset)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Total Pengeluaran</span>
              <span className="num font-bold text-accent">−{fmtIDR(d.totalPengeluaran)}</span>
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5 rounded-lg bg-surface p-3 text-xs text-ink-soft">
            <div className="flex items-center justify-between">
              <span>Modal, Ongkir &amp; Admin (penjualan terkonfirmasi)</span>
              <span className="num">{fmtIDR(d.omset - d.profitKotor)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Kerugian RTS</span>
              <span className="num">{fmtIDR(d.rtsLoss)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Spend Iklan</span>
              <span className="num">{fmtIDR(d.totalSpend)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Biaya Operasional (kardus, lakban, gaji, dll)</span>
              <span className="num">{fmtIDR(d.biayaOperasional)}</span>
            </div>
            <div className="mt-1 border-t border-border pt-1.5 text-ink-faint">
              <div className="flex items-center justify-between">
                <span>↳ termasuk Upah Hansen packing ({d.totalTx} paket × Rp2.000)</span>
                <span className="num">{fmtIDR(d.hansenWages)}</span>
              </div>
              <div className="mt-0.5">
                Sudah masuk di baris Modal/Ongkir &amp; Kerugian RTS di atas — bukan tambahan.
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <span className="text-sm font-bold">Hasil Final</span>
            <span
              className={`num text-lg font-extrabold ${
                d.hasilFinal >= 0 ? "text-primary" : "text-accent"
              }`}
            >
              {fmtIDR(d.hasilFinal)}
            </span>
          </div>
        </div>
      )}

      {d.produkQtyPeriode.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-soft">Paket & Produk Terjual</div>
            <div className="text-sm font-bold">
              <span className="num">{d.totalTx}</span> paket
            </div>
          </div>
          <div className="space-y-1">
            {d.produkQtyPeriode.map((p) => (
              <div key={p.nama} className="flex items-center justify-between text-sm">
                <span>{p.nama}</span>
                <span className="num font-medium">{p.qty} pcs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border-l-4 border-primary bg-white p-3">
          <div>
            <div className="text-sm font-bold">{d.pendingCount} transaksi masih Proses</div>
            <div className="text-xs text-ink-soft">
              Omset jadi fix setelah dikonfirmasi Selesai/RTS
            </div>
          </div>
          <Link
            href="/transaksi?filter=proses"
            className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
          >
            Cek
          </Link>
        </div>
      )}

      {d.piutang > 0 && (
        <div className="flex items-center justify-between rounded-xl border-l-4 border-offline bg-white p-3">
          <div>
            <div className="text-sm font-bold">Piutang: {fmtIDR(d.piutang)}</div>
            <div className="text-xs text-ink-soft">Transaksi offline yang belum lunas</div>
          </div>
          <Link
            href="/transaksi?filter=belum"
            className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
          >
            Cek
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <StatBox
          label="Online"
          value={fmtIDR(d.onlineOmset)}
          helper={`${d.countOnline} transaksi selesai`}
          borderColor="border-online"
        />
        <StatBox
          label="Offline"
          value={fmtIDR(d.offlineOmset)}
          helper={`${d.countOffline} transaksi lunas`}
          borderColor="border-offline"
        />
      </div>

      <SectionTitle>Tren Omset</SectionTitle>
      <TrendChart buckets={d.buckets} />

      <SectionTitle>Produk Terlaris</SectionTitle>
      <div className="rounded-xl border border-border bg-white p-3">
        {d.topProduk.length === 0 ? (
          <Empty icon="📦">Belum ada penjualan di periode ini</Empty>
        ) : (
          d.topProduk.map(([nama, v], i) => (
            <div
              key={nama}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-0"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs font-bold">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{nama}</div>
                <div className="text-xs text-ink-faint">{v.qty} terjual</div>
              </div>
              <div className="num text-sm font-semibold">{fmtIDR(v.omset)}</div>
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <>
          <SectionTitle>
            Iklan &amp; Chat Masuk{" "}
            <Link href="/dashboard/iklan" className="text-xs font-semibold text-primary">
              + Input
            </Link>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <StatBox
              label="Spend Iklan"
              value={fmtIDR(d.totalSpend)}
              helper={rangeLabel(preset, range).toLowerCase()}
              borderColor="border-accent"
            />
            <StatBox
              label="Chat Masuk"
              value={String(Math.round(d.totalChat))}
              helper="percakapan"
              borderColor="border-offline"
            />
          </div>
          <div className="rounded-xl border border-border bg-white p-3 text-sm">
            <Row label="Biaya per chat" value={fmtIDR(d.cpc)} />
            <Row label="Konversi (transaksi/chat)" value={`${d.konversi.toFixed(1)}%`} />
            <Row label="Biaya per transaksi (CPA)" value={fmtIDR(d.cpa)} />
            <Row label="ROAS (omset online / spend)" value={`${d.roas.toFixed(1)}x`} last />
          </div>
        </>
      )}

      <SectionTitle>
        Retur / RTS {d.rtsList.length > 0 && <Badge>{d.rtsList.length}</Badge>}
      </SectionTitle>
      <div className="rounded-xl border border-border bg-white p-3">
        {d.rtsList.length === 0 ? (
          <Empty icon="✅">Tidak ada retur di periode ini</Empty>
        ) : (
          d.rtsList.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{t.produk_nama}</div>
                <div className="text-xs text-ink-faint">
                  {t.customer} · {fmtDate(t.tanggal)}
                </div>
              </div>
              <div className="num text-sm font-semibold text-accent">{fmtIDR(t.omset)}</div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 pt-1">
        <Link
          href="/kalender"
          className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
        >
          Lihat Kalender Harian →
        </Link>
        <Link
          href="/pelanggan"
          className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
        >
          Lihat Database Pelanggan →
        </Link>
        {isAdmin && (
          <Link
            href="/keuangan"
            className="block rounded-lg border border-border bg-white py-2.5 text-center text-sm font-medium"
          >
            Biaya Operasional &amp; Target →
          </Link>
        )}
      </div>
    </div>
  );
}

function TargetBar({
  label,
  current,
  target,
  percent,
}: {
  label: string;
  current: number;
  target: number;
  percent: number | null;
}) {
  const pct = Math.min(100, percent ?? 0);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="num text-ink-soft">
          {fmtIDR(current)} / {fmtIDR(target)} ({percent ?? 0}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-primary" : "bg-offline"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownRow({
  tone,
  label,
  count,
  value,
}: {
  tone: "confirmed" | "pending" | "rts";
  label: string;
  count: number;
  value: number;
}) {
  const dot = tone === "confirmed" ? "bg-primary" : tone === "rts" ? "bg-accent" : "bg-ink-faint";
  const valueColor = tone === "rts" ? "text-accent" : "text-ink";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-ink-soft">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label} <span className="text-xs text-ink-faint">({count})</span>
      </span>
      <span className={`num font-semibold ${valueColor}`}>{fmtIDR(value)}</span>
    </div>
  );
}

function StatBox({
  label,
  value,
  helper,
  borderColor,
}: {
  label: string;
  value: string;
  helper: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl border-l-4 ${borderColor} bg-white p-3`}>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="num text-lg font-bold">{value}</div>
      <div className="text-xs text-ink-faint">{helper}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pt-1 text-sm font-bold text-ink">{children}</div>;
}

function Empty({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="py-6 text-center text-sm text-ink-faint">
      <div className="mb-1 text-2xl">{icon}</div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
      {children}
    </span>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${last ? "" : "border-b border-border"}`}>
      <span>{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
