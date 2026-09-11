import { localDateStr } from "@/lib/format";
import type { VTransaction, DailyMetric, OperatingExpense } from "@/types/database";

export type DateRange = { from: string; to: string };

export type PresetKey =
  | "hari_ini"
  | "kemarin"
  | "7_hari"
  | "30_hari"
  | "bulan_ini"
  | "bulan_lalu"
  | "custom";

function inRange(tanggal: string, range: DateRange) {
  return tanggal >= range.from && tanggal <= range.to;
}

export function rangeForPreset(preset: PresetKey, custom?: DateRange): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  if (preset === "hari_ini") return { from: todayStr, to: todayStr };

  if (preset === "kemarin") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: localDateStr(y), to: localDateStr(y) };
  }

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
  if (preset === "kemarin") return "Kemarin";
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
  confirmedCount: number;
  onlineOmset: number;
  offlineOmset: number;
  countOnline: number;
  countOffline: number;
  topProduk: [string, { qty: number; omset: number }][];
  produkQtyPeriode: { nama: string; qty: number }[];
  rtsList: VTransaction[];
  rtsOmset: number;
  // Modal + ongkir + admin + packing yang sudah hangus karena RTS (barang
  // rusak/mati di jalan, ongkir & packing tidak balik) — kerugian nyata,
  // bukan cuma "0" karena dianggap tidak jadi omset.
  rtsLoss: number;
  piutang: number;
  piutangCount: number;
  piutangProfit: number;
  pendingOmset: number;
  pendingProfit: number;
  pendingCount: number;
  // "Masuk" = gabungan yang masih diproses (online) + piutang (offline) —
  // dua-duanya sama-sama belum pasti jadi omset/profit final.
  masukOmset: number;
  masukProfit: number;
  masukCount: number;
  // Modal + ongkir + admin + packing yang akan hangus KALAU semua yang
  // Masuk ternyata gagal/RTS juga — dasar skenario terburuk.
  masukCost: number;
  estimasiOmset: number;
  estimasiProfit: number;
  // Profit bersih yang sudah PASTI sejauh ini: profit dari yang
  // terkonfirmasi, dikurangi kerugian RTS yang sudah terjadi, dikurangi
  // spend iklan periode ini. Ini jawaban "total untungnya berapa" kalau
  // semua transaksi periode ini sudah tidak ada yang Masih Proses.
  profitBersih: number;
  // Rentang skenario untuk yang masih Masih Proses: kalau semua jadi Fix
  // (best case) vs kalau semua jadi RTS/gagal (worst case) — dua-duanya
  // sudah dikurangi kerugian RTS yang sudah terjadi + spend iklan.
  bestCaseProfit: number;
  worstCaseProfit: number;
  totalSpend: number;
  totalChat: number;
  cpc: number;
  konversi: number;
  cpa: number;
  roas: number;
  buckets: { label: string; value: number }[];
  // Upah packing Hansen periode ini — SEMUA transaksi apapun statusnya
  // (packing terjadi begitu paket disiapkan). Sudah ikut terpotong di
  // profitKotor/rtsLoss/masukCost masing-masing; angka ini murni supaya
  // kelihatan, bukan potongan baru.
  hansenWages: number;
  // Belanja operasional (kardus, lakban, gaji, dll — dicatat di halaman
  // Keuangan) untuk tanggal di dalam periode ini.
  biayaOperasional: number;
  // Hasil akhir: uang yang benar-benar sudah masuk (Omset Terkonfirmasi)
  // dikurangi SEMUA pengeluaran nyata sejauh ini — modal & ongkir jualan,
  // kerugian RTS, spend iklan, dan belanja operasional. Ini jawaban pasti
  // "total dapat berapa, total pengeluaran berapa" — bukan perkiraan.
  totalPengeluaran: number;
  hasilFinal: number;
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
  range: DateRange,
  expenses: OperatingExpense[] = []
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

  // Qty per produk dari SEMUA transaksi di periode ini apapun statusnya —
  // pertanyaan operasional ("hari ini terjual berapa bibit/paket"), bukan
  // cuma yang sudah terkonfirmasi.
  const allInPeriod = transactions.filter((t) => inRange(t.tanggal, range));
  const qtyMap: Record<string, number> = {};
  allInPeriod.forEach((t) => {
    qtyMap[t.produk_nama] = (qtyMap[t.produk_nama] ?? 0) + t.qty;
  });
  const produkQtyPeriode = Object.entries(qtyMap)
    .map(([nama, qty]) => ({ nama, qty }))
    .sort((a, b) => b.qty - a.qty);

  const rtsList = transactions.filter((t) => t.retur && inRange(t.tanggal, range));
  const rtsOmset = rtsList.reduce((s, t) => s + t.omset, 0);
  // t.profit_kotor dihitung seolah-olah laku (omset - modal - ongkir -
  // admin - packing); untuk RTS omsetnya tidak pernah cair, jadi biaya yang
  // sudah dikeluarkan (modal+ongkir+admin+packing) = omset - profit_kotor.
  const rtsLoss = rtsList.reduce((s, t) => s + (t.omset - t.profit_kotor), 0);

  const pendingTx = transactions.filter((t) => t.estimasi && inRange(t.tanggal, range));
  const pendingOmset = pendingTx.reduce((s, t) => s + t.omset, 0);
  const pendingProfit = pendingTx.reduce((s, t) => s + t.profit_kotor, 0);

  const piutangTx = transactions.filter((t) => t.piutang && inRange(t.tanggal, range));
  const piutang = piutangTx.reduce((s, t) => s + t.omset, 0);
  const piutangCount = piutangTx.length;
  const piutangProfit = piutangTx.reduce((s, t) => s + t.profit_kotor, 0);

  // "Masuk" = online masih Proses + offline Belum Lunas — dua-duanya sudah
  // diserahkan/diproses tapi uangnya belum pasti final.
  const masukOmset = pendingOmset + piutang;
  const masukProfit = pendingProfit + piutangProfit;
  const masukCount = pendingTx.length + piutangCount;
  const masukCost = masukOmset - masukProfit;

  const metricsInPeriod = dailyMetrics.filter((m) => inRange(m.tanggal, range));
  const totalSpend = metricsInPeriod.reduce((s, m) => s + (m.spend_iklan || 0), 0);
  const totalChat = metricsInPeriod.reduce((s, m) => s + (m.chat_masuk || 0), 0);
  const cpc = totalChat > 0 ? totalSpend / totalChat : 0;
  const konversi = totalChat > 0 ? (totalTx / totalChat) * 100 : 0;
  const cpa = totalTx > 0 ? totalSpend / totalTx : 0;
  const roas = totalSpend > 0 ? onlineOmset / totalSpend : 0;

  const estimasiOmset = omset + masukOmset;
  const estimasiProfit = profitKotor + masukProfit;

  // Profit bersih yang sudah pasti: confirmed profit dikurangi kerugian RTS
  // yang sudah terjadi dan spend iklan periode ini. Kalau tidak ada lagi
  // yang Masih Proses, ini JAWABAN FINAL "untungnya berapa".
  const profitBersih = profitKotor - rtsLoss - totalSpend;
  // Best case: semua yang Masih Proses berhasil cair.
  const bestCaseProfit = profitBersih + masukProfit;
  // Worst case: semua yang Masih Proses ternyata RTS/gagal juga — modal,
  // ongkir, admin, dan packingnya ikut hangus (bukan cuma "tidak dapat").
  const worstCaseProfit = profitBersih - masukCost;

  const hansenWages = totalTx * 2000;
  const biayaOperasional = expenses
    .filter((e) => inRange(e.tanggal, range))
    .reduce((s, e) => s + e.nominal, 0);

  // Modal+ongkir+admin+packing dari yang terkonfirmasi (omset - profitKotor)
  // + kerugian RTS + spend iklan + belanja operasional = semua uang yang
  // sudah benar-benar keluar sejauh ini.
  const totalPengeluaran = omset - profitKotor + rtsLoss + totalSpend + biayaOperasional;
  const hasilFinal = omset - totalPengeluaran;

  return {
    omset,
    profitKotor,
    totalTx,
    confirmedCount: inPeriod.length,
    onlineOmset,
    offlineOmset,
    countOnline: onlineTx.length,
    countOffline: offlineTx.length,
    topProduk,
    produkQtyPeriode,
    rtsList,
    rtsOmset,
    rtsLoss,
    piutang,
    piutangCount,
    piutangProfit,
    masukOmset,
    masukProfit,
    masukCount,
    masukCost,
    pendingOmset,
    pendingProfit,
    pendingCount: pendingTx.length,
    estimasiOmset,
    estimasiProfit,
    profitBersih,
    bestCaseProfit,
    worstCaseProfit,
    totalSpend,
    totalChat,
    cpc,
    konversi,
    cpa,
    roas,
    buckets: buildBuckets(transactions, range),
    hansenWages,
    biayaOperasional,
    totalPengeluaran,
    hasilFinal,
  };
}
