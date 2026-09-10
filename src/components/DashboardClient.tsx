"use client";

import { useState } from "react";
import Link from "next/link";
import {
  computeDashboard,
  computeDayComparison,
  rangeForPreset,
  rangeLabel,
  type PresetKey,
  type DateRange,
} from "@/lib/dashboard";
import { fmtIDR, fmtDate, todayStr } from "@/lib/format";
import TrendChart from "@/components/TrendChart";
import type { VTransaction, DailyMetric, VMonthlyPnl, Product } from "@/types/database";

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
  monthlyPnl,
  isAdmin,
  lowStockProducts,
  initialFrom,
  initialTo,
}: {
  transactions: VTransaction[];
  dailyMetrics: DailyMetric[];
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
  const d = computeDashboard(transactions, dailyMetrics, range);
  const cmp = computeDayComparison(transactions, dailyMetrics);

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

      <div className="rounded-xl border-2 border-primary/20 bg-white p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-sm font-bold">Ringkasan Hari Ini</div>
          <div className="text-xs text-ink-faint">{fmtDate(cmp.today.date)} vs kemarin</div>
        </div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Penjualan
        </div>
        <div className="space-y-2">
          <CompareRow
            label="Omset Terkonfirmasi"
            today={fmtIDR(cmp.today.omset)}
            yesterday={fmtIDR(cmp.yesterday.omset)}
            up={cmp.today.omset >= cmp.yesterday.omset}
            judged
          />
          <CompareRow
            label="Transaksi (semua status)"
            today={String(cmp.today.totalTx)}
            yesterday={String(cmp.yesterday.totalTx)}
            up={cmp.today.totalTx >= cmp.yesterday.totalTx}
            judged
          />
        </div>
        {isAdmin && (
          <>
            <div className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Iklan &amp; Closing
            </div>
            <div className="space-y-2">
              <CompareRow
                label="Spend Iklan"
                today={fmtIDR(cmp.today.totalSpend)}
                yesterday={fmtIDR(cmp.yesterday.totalSpend)}
                up={cmp.today.totalSpend >= cmp.yesterday.totalSpend}
              />
              <CompareRow
                label="Chat Masuk"
                today={String(cmp.today.totalChat)}
                yesterday={String(cmp.yesterday.totalChat)}
                up={cmp.today.totalChat >= cmp.yesterday.totalChat}
                judged
              />
              <CompareRow
                label="Closing (transaksi/chat)"
                today={`${cmp.today.konversi.toFixed(1)}%`}
                yesterday={`${cmp.yesterday.konversi.toFixed(1)}%`}
                up={cmp.today.konversi >= cmp.yesterday.konversi}
                judged
              />
              <div
                className={`rounded-lg p-2.5 ${
                  cmp.today.netProfitEstimasi >= 0 ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-soft">Perkiraan Profit (net iklan)</span>
                  <span
                    className={`num font-bold ${
                      cmp.today.netProfitEstimasi >= 0 ? "text-primary" : "text-accent"
                    }`}
                  >
                    {fmtIDR(cmp.today.netProfitEstimasi)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {cmp.today.netProfitEstimasi >= 0 ? "Untung" : "Rugi"} kalau semua transaksi hari
                  ini terkirim/lunas, sudah dikurangi spend iklan · kemarin{" "}
                  <span className="num">{fmtIDR(cmp.yesterday.netProfitEstimasi)}</span>
                </div>
              </div>
            </div>
          </>
        )}
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-xs font-semibold text-ink-soft">Terjual Hari Ini per Produk</div>
          {cmp.today.produk.length === 0 ? (
            <div className="text-xs text-ink-faint">Belum ada transaksi hari ini.</div>
          ) : (
            <div className="space-y-1">
              {cmp.today.produk.map((p) => {
                const qtyKemarin = cmp.yesterday.produk.find((x) => x.nama === p.nama)?.qty ?? 0;
                return (
                  <div key={p.nama} className="flex items-center justify-between text-sm">
                    <span>{p.nama}</span>
                    <span className="num font-medium">
                      {p.qty} pcs{" "}
                      <span className="text-xs font-normal text-ink-faint">
                        (kemarin {qtyKemarin})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
          <div className="text-xs font-semibold text-ink-soft">Estimasi Omset (kalau semua masuk cair)</div>
          <div className="num text-base font-extrabold">{fmtIDR(d.estimasiOmset)}</div>
        </div>
        <div className="space-y-2">
          <BreakdownRow
            tone="confirmed"
            label="Terkonfirmasi"
            count={d.confirmedCount}
            value={d.omset}
          />
          <BreakdownRow tone="pending" label="Masuk (Proses/Piutang)" count={d.masukCount} value={d.masukOmset} />
          <BreakdownRow tone="rts" label="RTS (Retur)" count={d.rtsList.length} value={d.rtsOmset} />
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-2.5 text-xs">
          <div>
            Profit (dari yang Terkonfirmasi){" "}
            <b className="num">{fmtIDR(d.profitKotor)}</b>
          </div>
          <div>
            Margin{" "}
            <b className="num">{d.omset > 0 ? Math.round((d.profitKotor / d.omset) * 100) : 0}%</b>
          </div>
        </div>
      </div>

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

function CompareRow({
  label,
  today,
  yesterday,
  up,
  judged,
}: {
  label: string;
  today: string;
  yesterday: string;
  up: boolean;
  /** Kalau true, panah diwarnai hijau/merah (naik = bagus). Kalau false
   * (mis. Spend Iklan), panah cuma penanda arah netral — naik tidak
   * otomatis berarti buruk. */
  judged?: boolean;
}) {
  const arrow = up ? "▲" : "▼";
  const arrowColor = !judged ? "text-ink-faint" : up ? "text-primary" : "text-accent";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="num font-semibold">{today}</span>
        <span className={`text-xs ${arrowColor}`}>{arrow}</span>
        <span className="num text-xs text-ink-faint">kmrn {yesterday}</span>
      </span>
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
