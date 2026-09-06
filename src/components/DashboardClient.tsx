"use client";

import { useState } from "react";
import Link from "next/link";
import { computeDashboard, type Period } from "@/lib/dashboard";
import { fmtIDR, fmtDate } from "@/lib/format";
import TrendChart from "@/components/TrendChart";
import type { VTransaction, DailyMetric, VMonthlyPnl, Product } from "@/types/database";

const PERIOD_LABEL: Record<Period, string> = {
  daily: "Hari ini",
  weekly: "7 hari terakhir",
  monthly: "30 hari terakhir",
};

export default function DashboardClient({
  transactions,
  dailyMetrics,
  monthlyPnl,
  isAdmin,
  lowStockProducts,
}: {
  transactions: VTransaction[];
  dailyMetrics: DailyMetric[];
  monthlyPnl: VMonthlyPnl | null;
  isAdmin: boolean;
  lowStockProducts: Product[];
}) {
  const [period, setPeriod] = useState<Period>("weekly");
  const d = computeDashboard(transactions, dailyMetrics, period);

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

      <div className="flex gap-1 rounded-lg bg-white p-1 text-sm">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-md py-2 font-medium ${
              period === p ? "bg-primary text-white" : "text-ink-soft"
            }`}
          >
            {p === "daily" ? "Harian" : p === "weekly" ? "Mingguan" : "Bulanan"}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-primary p-4 text-white">
        <div className="text-xs opacity-80">Omset Terkonfirmasi · {PERIOD_LABEL[period]}</div>
        <div className="num mt-1 text-2xl font-extrabold">{fmtIDR(d.omset)}</div>
        <div className="mt-3 flex justify-between text-xs opacity-90">
          <div>
            Profit <b className="num block">{fmtIDR(d.profitKotor)}</b>
          </div>
          <div>
            Transaksi <b className="num block">{d.totalTx}</b>
          </div>
          <div>
            Margin{" "}
            <b className="num block">
              {d.omset > 0 ? Math.round((d.profitKotor / d.omset) * 100) : 0}%
            </b>
          </div>
        </div>
      </div>

      {d.pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border-l-4 border-primary bg-white p-3">
          <div>
            <div className="text-sm font-bold">Estimasi: +{fmtIDR(d.pendingOmset)}</div>
            <div className="text-xs text-ink-soft">
              {d.pendingCount} transaksi online masih &quot;Proses&quot; — omset baru fix setelah
              dikonfirmasi Selesai/RTS
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
              helper={PERIOD_LABEL[period].toLowerCase()}
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
