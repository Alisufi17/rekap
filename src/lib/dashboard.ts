import { localDateStr } from "@/lib/format";
import type { VTransaction, DailyMetric } from "@/types/database";

export type Period = "daily" | "weekly" | "monthly";

export function periodDays(p: Period) {
  return p === "daily" ? 1 : p === "weekly" ? 7 : 30;
}

function inRange(tanggal: string, days: number) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return tanggal >= localDateStr(cutoff);
}

export interface DashboardStats {
  omset: number;
  profitKotor: number;
  totalTx: number;
  onlineOmset: number;
  offlineOmset: number;
  countOnline: number;
  countOffline: number;
  topProduk: [string, { qty: number; omset: number }][];
  rtsList: VTransaction[];
  piutang: number;
  pendingOmset: number;
  pendingProfit: number;
  pendingCount: number;
  estimasiOmset: number;
  estimasiProfit: number;
  totalSpend: number;
  totalChat: number;
  cpc: number;
  konversi: number;
  cpa: number;
  roas: number;
  buckets: { label: string; value: number }[];
}

// `transactions` dan `dailyMetrics` sudah difilter ke jendela waktu yang cukup
// (lihat page.tsx) — fungsi ini hanya mengagregasi ulang sesuai periode yang
// dipilih user, semua di sisi client tanpa round-trip baru ke server.
export function computeDashboard(
  transactions: VTransaction[],
  dailyMetrics: DailyMetric[],
  period: Period
): DashboardStats {
  const days = periodDays(period);
  const inPeriod = transactions.filter((t) => inRange(t.tanggal, days) && t.terkonfirmasi);

  const omset = inPeriod.reduce((s, t) => s + t.omset, 0);
  const profitKotor = inPeriod.reduce((s, t) => s + t.profit_kotor, 0);
  const totalTx = transactions.filter((t) => inRange(t.tanggal, days)).length;

  const onlineTx = inPeriod.filter((t) => t.channel === "online");
  const offlineTx = inPeriod.filter((t) => t.channel === "offline");
  const onlineOmset = onlineTx.reduce((s, t) => s + t.omset, 0);
  const offlineOmset = offlineTx.reduce((s, t) => s + t.omset, 0);

  const prodMap: Record<string, { qty: number; omset: number }> = {};
  inPeriod.forEach((t) => {
    prodMap[t.produk_nama] ??= { qty: 0, omset: 0 };
    prodMap[t.produk_nama]!.qty += t.qty;
    prodMap[t.produk_nama]!.omset += t.omset;
  });
  const topProduk = Object.entries(prodMap)
    .sort((a, b) => b[1].omset - a[1].omset)
    .slice(0, 5);

  const rtsList = transactions.filter((t) => t.retur && inRange(t.tanggal, days));

  const pendingTx = transactions.filter((t) => t.estimasi && inRange(t.tanggal, days));
  const pendingOmset = pendingTx.reduce((s, t) => s + t.omset, 0);
  const pendingProfit = pendingTx.reduce((s, t) => s + t.profit_kotor, 0);

  const piutang = transactions
    .filter((t) => t.piutang && inRange(t.tanggal, days))
    .reduce((s, t) => s + t.omset, 0);

  const metricsInPeriod = dailyMetrics.filter((m) => inRange(m.tanggal, days));
  const totalSpend = metricsInPeriod.reduce((s, m) => s + (m.spend_iklan || 0), 0);
  const totalChat = metricsInPeriod.reduce((s, m) => s + (m.chat_masuk || 0), 0);
  const cpc = totalChat > 0 ? totalSpend / totalChat : 0;
  const konversi = totalChat > 0 ? (totalTx / totalChat) * 100 : 0;
  const cpa = totalTx > 0 ? totalSpend / totalTx : 0;
  const roas = totalSpend > 0 ? onlineOmset / totalSpend : 0;

  const bucketCount = period === "monthly" ? 30 : 7;
  const buckets: { label: string; value: number }[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const dayOmset = transactions
      .filter((t) => t.tanggal === key && t.terkonfirmasi)
      .reduce((s, t) => s + t.omset, 0);
    buckets.push({
      label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      value: dayOmset,
    });
  }

  return {
    omset,
    profitKotor,
    totalTx,
    onlineOmset,
    offlineOmset,
    countOnline: onlineTx.length,
    countOffline: offlineTx.length,
    topProduk,
    rtsList,
    piutang,
    pendingOmset,
    pendingProfit,
    pendingCount: pendingTx.length,
    estimasiOmset: omset + pendingOmset,
    estimasiProfit: profitKotor + pendingProfit,
    totalSpend,
    totalChat,
    cpc,
    konversi,
    cpa,
    roas,
    buckets,
  };
}
