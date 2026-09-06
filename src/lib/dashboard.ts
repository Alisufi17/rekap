import { localDateStr } from "@/lib/format";
import type { VTransaction, DailyMetric } from "@/types/database";

export type DateRange = { from: string; to: string };

export type PresetKey = "hari_ini" | "7_hari" | "30_hari" | "bulan_ini" | "bulan_lalu" | "custom";

function inRange(tanggal: string, range: DateRange) {
  return tanggal >= range.from && tanggal <= range.to;
}

export function rangeForPreset(preset: PresetKey, custom?: DateRange): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  if (preset === "hari_ini") return { from: todayStr, to: todayStr };

  if (preset === "7_hari") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: localDateStr(from), to: todayStr };
  }

  if (preset === "30_hari") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: localDateStr(from), to: todayStr };
  }

  if (preset === "bulan_ini") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: localDateStr(from), to: todayStr };
  }

  if (preset === "bulan_lalu") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localDateStr(from), to: localDateStr(to) };
  }

  return custom ?? { from: todayStr, to: todayStr };
}

export function rangeLabel(preset: PresetKey, range: DateRange): string {
  if (preset === "hari_ini") return "Hari ini";
  if (preset === "7_hari") return "7 hari terakhir";
  if (preset === "30_hari") return "30 hari terakhir";
  if (preset === "bulan_ini") return "Bulan ini";
  if (preset === "bulan_lalu") return "Bulan lalu";
  return range.from === range.to ? range.from : `${range.from} s/d ${range.to}`;
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

function daysBetween(range: DateRange): number {
  const a = new Date(range.from + "T00:00:00");
  const b = new Date(range.to + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

// Bar harian kalau rentangnya pendek; digabung per minggu kalau lebih dari
// sebulan supaya chart tidak dipenuhi ratusan bar tipis.
function buildBuckets(transactions: VTransaction[], range: DateRange): { label: string; value: number }[] {
  const span = daysBetween(range);
  const omsetByDate = new Map<string, number>();
  transactions.forEach((t) => {
    if (!t.terkonfirmasi || !inRange(t.tanggal, range)) return;
    omsetByDate.set(t.tanggal, (omsetByDate.get(t.tanggal) ?? 0) + t.omset);
  });

  const from = new Date(range.from + "T00:00:00");

  if (span <= 31) {
    const buckets: { label: string; value: number }[] = [];
    for (let i = 0; i < span; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = localDateStr(d);
      buckets.push({
        label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        value: omsetByDate.get(key) ?? 0,
      });
    }
    return buckets;
  }

  // Kelompok per minggu (Senin-Minggu).
  const buckets: { label: string; value: number }[] = [];
  const cursor = new Date(from);
  const dow = cursor.getDay();
  cursor.setDate(cursor.getDate() - ((dow + 6) % 7)); // mundur ke Senin

  const to = new Date(range.to + "T00:00:00");
  while (cursor <= to) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    let sum = 0;
    for (const [key, val] of omsetByDate) {
      const d = new Date(key + "T00:00:00");
      if (d >= cursor && d <= weekEnd) sum += val;
    }
    buckets.push({
      label: cursor.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      value: sum,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

// `transactions` dan `dailyMetrics` sudah dimuat untuk jendela waktu yang
// cukup lebar (lihat page.tsx) — fungsi ini murni mengagregasi ulang sesuai
// rentang tanggal yang dipilih user, semua di sisi client tanpa round-trip
// baru ke server.
export function computeDashboard(
  transactions: VTransaction[],
  dailyMetrics: DailyMetric[],
  range: DateRange
): DashboardStats {
  const inPeriod = transactions.filter((t) => inRange(t.tanggal, range) && t.terkonfirmasi);

  const omset = inPeriod.reduce((s, t) => s + t.omset, 0);
  const profitKotor = inPeriod.reduce((s, t) => s + t.profit_kotor, 0);
  const totalTx = transactions.filter((t) => inRange(t.tanggal, range)).length;

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

  const rtsList = transactions.filter((t) => t.retur && inRange(t.tanggal, range));

  const pendingTx = transactions.filter((t) => t.estimasi && inRange(t.tanggal, range));
  const pendingOmset = pendingTx.reduce((s, t) => s + t.omset, 0);
  const pendingProfit = pendingTx.reduce((s, t) => s + t.profit_kotor, 0);

  const piutang = transactions
    .filter((t) => t.piutang && inRange(t.tanggal, range))
    .reduce((s, t) => s + t.omset, 0);

  const metricsInPeriod = dailyMetrics.filter((m) => inRange(m.tanggal, range));
  const totalSpend = metricsInPeriod.reduce((s, m) => s + (m.spend_iklan || 0), 0);
  const totalChat = metricsInPeriod.reduce((s, m) => s + (m.chat_masuk || 0), 0);
  const cpc = totalChat > 0 ? totalSpend / totalChat : 0;
  const konversi = totalChat > 0 ? (totalTx / totalChat) * 100 : 0;
  const cpa = totalTx > 0 ? totalSpend / totalTx : 0;
  const roas = totalSpend > 0 ? onlineOmset / totalSpend : 0;

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
    buckets: buildBuckets(transactions, range),
  };
}
