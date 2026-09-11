import { describe, it, expect, afterEach, vi } from "vitest";
import { computeDashboard, rangeForPreset, rangeLabel, type DateRange } from "./dashboard";
import type {
  VTransaction,
  DailyMetric,
  OperatingExpense,
  TxChannel,
  TxStatus,
} from "@/types/database";

// Biaya packing tetap per transaksi, migrasi 0008. Kalau angka ini pernah
// berubah di database, ubah juga di sini supaya fixture tetap merefleksikan
// rumus v_transactions yang sebenarnya.
const PACKING_FEE = 2000;

let seq = 0;

// Meniru persis rumus view v_transactions (lihat
// supabase/migrations/0008_biaya_packing.sql) supaya test ini benar-benar
// memverifikasi kontrak antara database dan dashboard.ts, bukan cuma
// menegaskan ulang implementasi computeDashboard dengan cara lain.
function makeTx(input: {
  channel: TxChannel;
  status: TxStatus;
  tanggal: string;
  qty?: number;
  harga?: number;
  hpp?: number;
  ongkir?: number;
  admin?: number;
  produk_nama?: string;
}): VTransaction {
  seq += 1;
  const qty = input.qty ?? 1;
  const harga = input.harga ?? 100_000;
  const hpp = input.hpp ?? 40_000;
  const ongkir = input.ongkir ?? 0;
  const admin = input.admin ?? 0;

  const omset = qty * harga;
  const modal = qty * hpp;
  const profit_kotor = omset - modal - ongkir - admin - PACKING_FEE;

  const terkonfirmasi =
    (input.channel === "online" && input.status === "selesai") ||
    (input.channel === "offline" && input.status === "lunas");
  const estimasi = input.channel === "online" && input.status === "proses";
  const piutang = input.channel === "offline" && input.status === "belum";
  const retur = input.status === "rts";

  return {
    id: `tx-${seq}`,
    channel: input.channel,
    tanggal: input.tanggal,
    customer: "Budi",
    customer_phone: null,
    produk_id: "prod-1",
    produk_nama: input.produk_nama ?? "Bibit Cabai",
    qty,
    harga,
    hpp,
    ongkir,
    admin,
    catatan: null,
    status: input.status,
    created_by: null,
    created_by_uid: null,
    affects_stock: true,
    created_at: `${input.tanggal}T00:00:00Z`,
    omset,
    modal,
    biaya_transaksi: ongkir + admin + PACKING_FEE,
    profit_kotor,
    terkonfirmasi,
    estimasi,
    piutang,
    retur,
  };
}

const RANGE: DateRange = { from: "2026-09-01", to: "2026-09-30" };
const noMetrics: DailyMetric[] = [];
const noExpenses: OperatingExpense[] = [];

function metric(tanggal: string, spend_iklan = 0, chat_masuk = 0): DailyMetric {
  return { tanggal, spend_iklan, chat_masuk };
}

describe("computeDashboard — omset & profit dasar", () => {
  it("cuma menghitung transaksi terkonfirmasi ke omset/profit, yang Proses masuk ke pending", () => {
    const confirmed = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 2,
      harga: 50_000,
      hpp: 20_000,
    });
    const proses = makeTx({
      channel: "online",
      status: "proses",
      tanggal: "2026-09-06",
      qty: 1,
      harga: 100_000,
      hpp: 30_000,
    });

    const d = computeDashboard([confirmed, proses], noMetrics, RANGE, noExpenses);

    expect(d.omset).toBe(100_000); // 2 x 50.000
    expect(d.profitKotor).toBe(100_000 - 40_000 - PACKING_FEE); // 58.000
    expect(d.confirmedCount).toBe(1);
    expect(d.pendingOmset).toBe(100_000);
    expect(d.pendingCount).toBe(1);
    expect(d.totalTx).toBe(2); // semua status dihitung operasional
  });
});

describe("computeDashboard — piutang (regresi bug: sempat tidak ikut Estimasi Omset)", () => {
  it("piutang offline masuk ke masukOmset/masukProfit dan ikut di estimasiOmset/estimasiProfit", () => {
    const piutangTx = makeTx({
      channel: "offline",
      status: "belum",
      tanggal: "2026-09-10",
      qty: 1,
      harga: 80_000,
      hpp: 30_000,
      ongkir: 5_000,
    });

    const d = computeDashboard([piutangTx], noMetrics, RANGE, noExpenses);
    const expectedProfit = 80_000 - 30_000 - 5_000 - PACKING_FEE; // 43.000

    expect(d.piutang).toBe(80_000);
    expect(d.masukOmset).toBe(80_000);
    expect(d.masukProfit).toBe(expectedProfit);
    // Ini bug yang pernah kejadian: estimasiOmset/estimasiProfit dulu cuma
    // omset + pendingOmset, piutang tidak pernah ditambahkan.
    expect(d.estimasiOmset).toBe(d.omset + d.masukOmset);
    expect(d.estimasiOmset).toBe(80_000);
    expect(d.estimasiProfit).toBe(d.profitKotor + d.masukProfit);
    expect(d.estimasiProfit).toBe(expectedProfit);
  });
});

describe("computeDashboard — kerugian RTS (regresi bug: RTS dulu dianggap 0, bukan rugi)", () => {
  it("RTS memotong profitBersih sebesar modal+ongkir+admin+packing yang hangus, bukan diabaikan", () => {
    const confirmed = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 1,
      harga: 100_000,
      hpp: 40_000,
    });
    const rts = makeTx({
      channel: "online",
      status: "rts",
      tanggal: "2026-09-07",
      qty: 1,
      harga: 120_000,
      hpp: 50_000,
      ongkir: 10_000,
    });

    const d = computeDashboard(
      [confirmed, rts],
      [metric("2026-09-05", 30_000), metric("2026-09-07", 0)],
      RANGE,
      noExpenses
    );

    const confirmedProfit = 100_000 - 40_000 - PACKING_FEE; // 58.000
    const rtsLoss = 50_000 + 10_000 + PACKING_FEE; // 62.000 (modal+ongkir+packing)

    expect(d.profitKotor).toBe(confirmedProfit);
    expect(d.rtsOmset).toBe(120_000);
    expect(d.rtsLoss).toBe(rtsLoss);

    // profitBersih HARUS memotong rtsLoss. Sebelum diperbaiki, RTS dianggap
    // 0 sehingga profitBersih keliru dilaporkan untung +28.000 padahal
    // sebenarnya rugi.
    const expectedProfitBersih = confirmedProfit - rtsLoss - 30_000;
    expect(expectedProfitBersih).toBe(-34_000);
    expect(d.profitBersih).toBe(expectedProfitBersih);
    expect(d.profitBersih).toBeLessThan(0);
  });
});

describe("computeDashboard — skenario best/worst case untuk yang Masih Proses", () => {
  it("bestCase menambah profit pending penuh, worstCase mengurangi biaya pending penuh (bukan cuma 0)", () => {
    const confirmed = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 1,
      harga: 100_000,
      hpp: 40_000,
    });
    const pending = makeTx({
      channel: "online",
      status: "proses",
      tanggal: "2026-09-06",
      qty: 1,
      harga: 90_000,
      hpp: 30_000,
      ongkir: 5_000,
    });

    const d = computeDashboard(
      [confirmed, pending],
      [metric("2026-09-05", 10_000)],
      RANGE,
      noExpenses
    );

    const confirmedProfit = 100_000 - 40_000 - PACKING_FEE; // 58.000
    const pendingProfit = 90_000 - 30_000 - 5_000 - PACKING_FEE; // 53.000
    const pendingCost = 90_000 - pendingProfit; // 37.000 (modal+ongkir+packing)
    const profitBersih = confirmedProfit - 0 - 10_000; // 48.000

    expect(d.profitBersih).toBe(profitBersih);
    expect(d.masukCost).toBe(pendingCost);
    expect(d.bestCaseProfit).toBe(profitBersih + pendingProfit);
    expect(d.worstCaseProfit).toBe(profitBersih - pendingCost);
    expect(d.bestCaseProfit).toBeGreaterThan(d.worstCaseProfit);
  });
});

describe("computeDashboard — biaya packing & upah Hansen", () => {
  it("tiap transaksi terpotong Rp2.000 packing di profit_kotor, hansenWages = semua transaksi x Rp2.000", () => {
    const a = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 1,
      harga: 50_000,
      hpp: 20_000,
    });
    const b = makeTx({ channel: "online", status: "proses", tanggal: "2026-09-06" });
    const c = makeTx({ channel: "online", status: "rts", tanggal: "2026-09-07" });

    const d = computeDashboard([a, b, c], noMetrics, RANGE, noExpenses);

    expect(a.profit_kotor).toBe(50_000 - 20_000 - PACKING_FEE); // 28.000
    expect(d.totalTx).toBe(3);
    expect(d.hansenWages).toBe(3 * PACKING_FEE);
  });
});

describe("computeDashboard — qty produk operasional", () => {
  it("produkQtyPeriode menjumlah qty dari SEMUA status, bukan cuma yang terkonfirmasi", () => {
    const confirmed = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 3,
      produk_nama: "Bibit Cabai",
    });
    const proses = makeTx({
      channel: "online",
      status: "proses",
      tanggal: "2026-09-06",
      qty: 2,
      produk_nama: "Bibit Cabai",
    });

    const d = computeDashboard([confirmed, proses], noMetrics, RANGE, noExpenses);
    const bibit = d.produkQtyPeriode.find((p) => p.nama === "Bibit Cabai");

    expect(bibit?.qty).toBe(5);
  });
});

describe("computeDashboard — Total Pengeluaran & Hasil Final", () => {
  it("biayaOperasional cuma menjumlah expense yang tanggalnya di dalam rentang", () => {
    const confirmed = makeTx({
      channel: "online",
      status: "selesai",
      tanggal: "2026-09-05",
      qty: 1,
      harga: 100_000,
      hpp: 40_000,
    });
    const expenses: OperatingExpense[] = [
      {
        id: "e1",
        tanggal: "2026-09-10", // di dalam RANGE
        kategori: "packing",
        nominal: 15_000,
        catatan: null,
        berulang: false,
        created_by_uid: null,
        created_at: "2026-09-10T00:00:00Z",
      },
      {
        id: "e2",
        tanggal: "2026-08-01", // di luar RANGE
        kategori: "packing",
        nominal: 99_999,
        catatan: null,
        berulang: false,
        created_by_uid: null,
        created_at: "2026-08-01T00:00:00Z",
      },
    ];

    const d = computeDashboard([confirmed], noMetrics, RANGE, expenses);

    expect(d.biayaOperasional).toBe(15_000);

    const modalOngkirAdmin = d.omset - d.profitKotor;
    expect(d.totalPengeluaran).toBe(modalOngkirAdmin + d.rtsLoss + d.totalSpend + 15_000);
    expect(d.hasilFinal).toBe(d.omset - d.totalPengeluaran);
  });
});

describe("rangeForPreset & rangeLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hari_ini dan kemarin menghasilkan tanggal yang benar relatif ke 'sekarang'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T09:00:00"));

    expect(rangeForPreset("hari_ini")).toEqual({ from: "2026-09-15", to: "2026-09-15" });
    expect(rangeForPreset("kemarin")).toEqual({ from: "2026-09-14", to: "2026-09-14" });
    expect(rangeForPreset("7_hari")).toEqual({ from: "2026-09-09", to: "2026-09-15" });
  });

  it("rangeLabel mengembalikan label yang sesuai preset", () => {
    const range = { from: "2026-09-15", to: "2026-09-15" };
    expect(rangeLabel("hari_ini", range)).toBe("Hari ini");
    expect(rangeLabel("kemarin", range)).toBe("Kemarin");
    expect(rangeLabel("custom", { from: "2026-09-01", to: "2026-09-05" })).toBe(
      "2026-09-01 s/d 2026-09-05"
    );
  });
});
