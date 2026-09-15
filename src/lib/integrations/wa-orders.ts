import type { Transaction } from "@/types/database";

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
      ongkir: index === 0 ? input.ongkir : 0,
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
