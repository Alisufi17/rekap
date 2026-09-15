import { describe, expect, it } from "vitest";
import {
  markWaOrderDelivered,
  ProductMissingHppError,
  ProductNotFoundError,
  pushWaOrder,
  type TransactionInsertRow,
  type WaOrderDeps,
} from "./wa-orders";

// wa-ai-cs (the owner's separate WhatsApp AI customer-service system) posts
// a confirmed order here instead of writing straight into `transactions`
// with its own copy of the service-role key. Deps are injected fakes (no
// real Supabase call) - same DI pattern wa-ai-cs's own
// kasirkiojay-sync.test.ts uses for the other side of this integration.

function makeDeps(overrides: Partial<WaOrderDeps> = {}) {
  const inserted: TransactionInsertRow[] = [];
  const delivered: string[] = [];
  const deps: WaOrderDeps = {
    findProductByName: async (nama) => (nama === "Kiojay Harga Normal" ? { id: "prod-1", hpp: 18000 } : null),
    insertTransactions: async (rows) => {
      inserted.push(...rows);
    },
    updateDeliveredByOrderId: async (orderId) => {
      delivered.push(orderId);
      return 2;
    },
    ...overrides,
  };
  return { deps, inserted, delivered };
}

describe("pushWaOrder", () => {
  it("inserts one row per item, HPP from the product lookup, shipping only on the first row", async () => {
    const { deps, inserted } = makeDeps();

    await pushWaOrder(
      {
        orderId: "order-1",
        tanggal: "2026-09-15",
        customer: "Budi",
        customerPhone: "6281200000000",
        items: [
          { produkNama: "Kiojay Harga Normal", qty: 1, harga: 99000 },
          { produkNama: "Kiojay Harga Normal", qty: 2, harga: 79500 },
        ],
        ongkir: 20000,
      },
      deps,
    );

    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      channel: "online",
      qty: 1,
      harga: 99000,
      hpp: 18000,
      produk_id: "prod-1",
      ongkir: 20000,
      status: "proses",
      affects_stock: true,
      dikemas: false,
      catatan: "Order WA (otomatis) - order order-1",
    });
    expect(inserted[1]).toMatchObject({ qty: 2, harga: 79500, ongkir: 0 });
  });

  it("throws ProductNotFoundError and inserts nothing when the product doesn't exist", async () => {
    const { deps, inserted } = makeDeps();

    await expect(
      pushWaOrder(
        {
          orderId: "order-2",
          tanggal: "2026-09-15",
          customer: "Budi",
          customerPhone: null,
          items: [{ produkNama: "Produk Hantu", qty: 1, harga: 1000 }],
          ongkir: 0,
        },
        deps,
      ),
    ).rejects.toThrow(ProductNotFoundError);
    expect(inserted).toHaveLength(0);
  });

  it("throws ProductMissingHppError instead of writing hpp: 0", async () => {
    const { deps, inserted } = makeDeps({ findProductByName: async () => ({ id: "p", hpp: 0 }) });

    await expect(
      pushWaOrder(
        {
          orderId: "order-3",
          tanggal: "2026-09-15",
          customer: "Budi",
          customerPhone: null,
          items: [{ produkNama: "Kiojay Harga Normal", qty: 1, harga: 1000 }],
          ongkir: 0,
        },
        deps,
      ),
    ).rejects.toThrow(ProductMissingHppError);
    expect(inserted).toHaveLength(0);
  });

  it("checks every distinct product before inserting anything (no partial rows on a mixed-validity order)", async () => {
    const { deps, inserted } = makeDeps({
      findProductByName: async (nama) => (nama === "OK" ? { id: "p-ok", hpp: 10000 } : null),
    });

    await expect(
      pushWaOrder(
        {
          orderId: "order-4",
          tanggal: "2026-09-15",
          customer: "Budi",
          customerPhone: null,
          items: [
            { produkNama: "OK", qty: 1, harga: 1000 },
            { produkNama: "Ghost", qty: 1, harga: 1000 },
          ],
          ongkir: 0,
        },
        deps,
      ),
    ).rejects.toThrow(ProductNotFoundError);
    expect(inserted).toHaveLength(0);
  });
});

describe("markWaOrderDelivered", () => {
  it("delegates to updateDeliveredByOrderId and returns its count", async () => {
    const { deps, delivered } = makeDeps();

    const count = await markWaOrderDelivered("order-1", deps);

    expect(count).toBe(2);
    expect(delivered).toEqual(["order-1"]);
  });
});
