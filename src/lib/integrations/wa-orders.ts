import type { Transaction, VTransaction } from "@/types/database";
import { hitungOngkir } from "@/lib/pricing";

// Owner request 2026-09-15: wa-ai-cs (the owner's separate WhatsApp AI
// customer-service system, own repo) used to write straight into this app's
// `transactions` table over PostgREST with its own copy of the service-role
// key - bypassing every business rule this app has (and will ever add)
// around HPP and the online-order "dikemas" default. This module is the one
// place those rules live now; wa-ai-cs only ever calls the HTTP route
// wrapping it (see src/app/api/integrations/wa-orders).
//
// Deps are injected (never a real Supabase call in here) so this logic can
// be tested without live credentials - same DI pattern wa-ai-cs's own
// kasirkiojay-sync.service.ts uses for the other side of this integration.

export type TransactionInsertRow = Pick<
  Transaction,
  | "channel"
  | "tanggal"
  | "customer"
  | "customer_phone"
  | "produk_id"
  | "produk_nama"
  | "qty"
  | "harga"
  | "hpp"
  | "ongkir"
  | "admin"
  | "catatan"
  | "status"
  | "affects_stock"
  | "dikemas"
>;

export interface WaOrderDeps {
  findProductByName: (nama: string) => Promise<{ id: string; hpp: number } | null>;
  insertTransactions: (rows: TransactionInsertRow[]) => Promise<void>;
  updateDeliveredByOrderId: (orderId: string) => Promise<number>;
}

export class ProductNotFoundError extends Error {
  constructor(public readonly produkNama: string) {
    super(`No kasirkiojay product named "${produkNama}" - check /produk (it may have been renamed)`);
    this.name = "ProductNotFoundError";
  }
}

// This app's own /produk form silently saves HPP as 0 when left blank (see
// ProductList.tsx) - refusing to insert instead of writing hpp: 0 makes that
// gap visible (the WA order just won't appear here) instead of quietly
// wrecking profit reports for every sale of that product going forward.
export class ProductMissingHppError extends Error {
  constructor(public readonly produkNama: string) {
    super(`Product "${produkNama}" has no HPP set (0) - fill it in on /produk first`);
    this.name = "ProductMissingHppError";
  }
}

export interface PushWaOrderInput {
  orderId: string;
  tanggal: string;
  customer: string;
  customerPhone: string | null;
  items: { produkNama: string; qty: number; harga: number }[];
  // What the CUSTOMER was charged for shipping on top of the item prices
  // (usually 0 - the prices already include it). NOT the cost this shop pays
  // the courier; that comes from the SiCepat tariff below.
  ongkir: number;
}

export async function pushWaOrder(input: PushWaOrderInput, deps: WaOrderDeps): Promise<void> {
  // Resolve + validate every distinct product up front so a bad item never
  // leaves a partial set of rows inserted for this order.
  const products = new Map<string, { id: string; hpp: number }>();
  for (const nama of new Set(input.items.map((item) => item.produkNama))) {
    const product = await deps.findProductByName(nama);
    if (!product) {
      throw new ProductNotFoundError(nama);
    }
    if (!product.hpp || product.hpp <= 0) {
      throw new ProductMissingHppError(nama);
    }
    products.set(nama, product);
  }

  // Owner confirmed 2026-09-19 ("ya di tanggung aku"): the shop pays the
  // courier, so this transaction's ongkir - which v_transactions subtracts
  // from profit - is the standard SiCepat tariff for the order's total number
  // of seedlings, exactly what this app's own "Tambah Transaksi" form fills in
  // (see src/lib/pricing.ts). Before this it was the customer-charged amount,
  // 0 on almost every order, so profit read Rp12.000+ too high. Whatever the
  // customer paid towards shipping offsets it (never below 0).
  const totalQty = input.items.reduce((sum, item) => sum + item.qty, 0);
  const ongkirBiaya = Math.max(0, hitungOngkir(totalQty) - input.ongkir);

  const rows: TransactionInsertRow[] = input.items.map((item, index) => {
    const product = products.get(item.produkNama)!;
    return {
      channel: "online",
      tanggal: input.tanggal,
      customer: input.customer,
      customer_phone: input.customerPhone,
      produk_id: product.id,
      produk_nama: item.produkNama,
      qty: item.qty,
      harga: item.harga,
      hpp: product.hpp,
      // Shipping belongs to the order, not any one line item - only the
      // first row carries it, so it isn't double-counted across items.
      ongkir: index === 0 ? ongkirBiaya : 0,
      admin: 0,
      catatan: `Order WA (otomatis) - order ${input.orderId}`,
      status: "proses",
      affects_stock: true,
      // Online defaults to not-yet-packed, same as this app's own
      // createTransaction() - marked true once markWaOrderDelivered fires.
      dikemas: false,
    };
  });

  await deps.insertTransactions(rows);
}

export async function markWaOrderDelivered(orderId: string, deps: WaOrderDeps): Promise<number> {
  return deps.updateDeliveredByOrderId(orderId);
}

// Owner request 2026-09-19: wa-ai-cs's order page should show the real HPP
// and profit from here instead of guessing them - "di kasir kiojay aku ada
// hppnya, jadi hasilnya lebih akurat". Read-only: nothing here writes, and the
// money math is NOT redone - `v_transactions` (see supabase/migrations/
// 0008_biaya_packing.sql) stays the one place profit is defined, so this
// can't drift if that formula ever changes (it also already reflects any
// edit made to the transaction on this app's own edit-pesanan screen).
export type WaOrderTransactionRow = Pick<
  VTransaction,
  | "catatan"
  | "produk_nama"
  | "qty"
  | "harga"
  | "hpp"
  | "ongkir"
  | "admin"
  | "omset"
  | "modal"
  | "biaya_transaksi"
  | "profit_kotor"
  | "status"
  | "terkonfirmasi"
  | "estimasi"
  | "retur"
>;

export interface WaOrderFinancialsDeps {
  findTransactionsByOrderIds: (orderIds: string[]) => Promise<WaOrderTransactionRow[]>;
}

export interface WaOrderFinancials {
  // "selesai" = delivered, the profit below is final. "proses" = still on its
  // way, so it's an estimate. "rts" = returned to sender.
  status: "proses" | "selesai" | "rts";
  omset: number;
  // Sum of qty x hpp - this app's own cost price, the point of this endpoint.
  modal: number;
  ongkir: number;
  // Everything else this app subtracts per transaction that isn't ongkir:
  // the fixed packing fee plus any marketplace/admin fee.
  biayaLain: number;
  profitKotor: number;
  items: { produkNama: string; qty: number; harga: number; hpp: number }[];
}

function summarizeWaOrderRows(rows: WaOrderTransactionRow[]): WaOrderFinancials {
  // numeric columns can arrive as strings depending on the driver; coerce once.
  const n = (value: unknown) => Number(value ?? 0);
  const ongkir = rows.reduce((sum, r) => sum + n(r.ongkir), 0);
  const biayaTransaksi = rows.reduce((sum, r) => sum + n(r.biaya_transaksi), 0);
  const status = rows.some((r) => r.retur) ? "rts" : rows.every((r) => r.terkonfirmasi) ? "selesai" : "proses";
  return {
    status,
    omset: rows.reduce((sum, r) => sum + n(r.omset), 0),
    modal: rows.reduce((sum, r) => sum + n(r.modal), 0),
    ongkir,
    biayaLain: biayaTransaksi - ongkir,
    profitKotor: rows.reduce((sum, r) => sum + n(r.profit_kotor), 0),
    items: rows.map((r) => ({ produkNama: r.produk_nama, qty: n(r.qty), harga: n(r.harga), hpp: n(r.hpp) })),
  };
}

// An order id absent from the result simply hasn't reached this app (not
// synced yet, or synced under an id nobody can match) - the caller shows "-",
// it isn't an error.
export async function getWaOrderFinancials(
  orderIds: string[],
  deps: WaOrderFinancialsDeps,
): Promise<Record<string, WaOrderFinancials>> {
  const ids = [...new Set(orderIds)];
  if (ids.length === 0) return {};
  const rows = await deps.findTransactionsByOrderIds(ids);
  const result: Record<string, WaOrderFinancials> = {};
  for (const id of ids) {
    // Same match rule markWaOrderDelivered uses: pushWaOrder tags every row's
    // catatan with the order id, and staff may have typed more around it.
    const mine = rows.filter((r) => r.catatan?.includes(id));
    if (mine.length > 0) {
      result[id] = summarizeWaOrderRows(mine);
    }
  }
  return result;
}

// Owner request 2026-09-19 ("aku mau namanya ditulis manual saja", and "biar
// masuk ke kasir ada nama customernya"): the customer name is typed by hand in
// wa-ai-cs, and naming (or renaming) a customer afterwards has to reach the
// transactions that order already created here. Only the `customer` label is
// touched - never money, status or stock.
export interface WaOrderRenameDeps {
  updateCustomerByOrderId: (orderId: string, customer: string) => Promise<number>;
}

export async function renameWaOrderCustomer(
  orderId: string,
  customer: string,
  deps: WaOrderRenameDeps,
): Promise<number> {
  return deps.updateCustomerByOrderId(orderId, customer);
}
