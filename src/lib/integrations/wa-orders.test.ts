import { describe, expect, it } from "vitest";
import {
  getWaOrderFinancials,
  markWaOrderDelivered,
  ProductMissingHppError,
  ProductNotFoundError,
  pushWaOrder,
  type TransactionInsertRow,
  type WaOrderDeps,
  type WaOrderTransactionRow,
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

// Owner request 2026-09-19: wa-ai-cs shows this app's real HPP/profit next to
// its own orders. The money columns come straight from v_transactions (fed in
// here as rows) - what's tested is the grouping by order id and the summing.
function row(overrides: Partial<WaOrderTransactionRow> = {}): WaOrderTransactionRow {
  return {
    catatan: "Order WA (otomatis) - order order-1",
    produk_nama: "Kiojay Harga Normal",
    qty: 1,
    harga: 99000,
    hpp: 18000,
    ongkir: 0,
    admin: 0,
    omset: 99000,
    modal: 18000,
    biaya_transaksi: 2000,
    profit_kotor: 79000,
    status: "proses",
    terkonfirmasi: false,
    estimasi: true,
    retur: false,
    ...overrides,
  };
}

describe("getWaOrderFinancials", () => {
  it("sums a multi-row order: HPP as modal, shipping once, packing fee under biayaLain, profit as Kasir computed it", async () => {
    const rows = [
      row({ qty: 1, harga: 99000, omset: 99000, modal: 18000, ongkir: 20000, biaya_transaksi: 22000, profit_kotor: 59000 }),
      row({ qty: 2, harga: 79500, omset: 159000, modal: 36000, ongkir: 0, biaya_transaksi: 2000, profit_kotor: 121000 }),
    ];

    const result = await getWaOrderFinancials(["order-1"], { findTransactionsByOrderIds: async () => rows });

    expect(result["order-1"]).toEqual({
      status: "proses",
      omset: 258000,
      modal: 54000,
      ongkir: 20000,
      biayaLain: 4000,
      profitKotor: 180000,
      items: [
        { produkNama: "Kiojay Harga Normal", qty: 1, harga: 99000, hpp: 18000 },
        { produkNama: "Kiojay Harga Normal", qty: 2, harga: 79500, hpp: 18000 },
      ],
    });
  });

  it("keeps different orders apart and leaves an order Kasir never received out of the result", async () => {
    const rows = [
      row({ catatan: "Order WA (otomatis) - order order-1" }),
      row({ catatan: "Order WA (otomatis) - order order-2", profit_kotor: 50000 }),
    ];

    const result = await getWaOrderFinancials(["order-1", "order-2", "order-3"], {
      findTransactionsByOrderIds: async () => rows,
    });

    expect(Object.keys(result).sort()).toEqual(["order-1", "order-2"]);
    expect(result["order-2"]!.profitKotor).toBe(50000);
  });

  it("is final (selesai) only once every row is confirmed, and rts wins over everything", async () => {
    const done = row({ terkonfirmasi: true, estimasi: false, status: "selesai" });
    const pending = row({ terkonfirmasi: false });
    const returned = row({ retur: true, status: "rts", terkonfirmasi: false });

    const status = async (rows: WaOrderTransactionRow[]) =>
      (await getWaOrderFinancials(["order-1"], { findTransactionsByOrderIds: async () => rows }))["order-1"]!.status;

    expect(await status([done, done])).toBe("selesai");
    expect(await status([done, pending])).toBe("proses");
    expect(await status([done, returned])).toBe("rts");
  });

  it("still matches when staff typed extra text around the order id in catatan", async () => {
    const rows = [row({ catatan: "Order WA (otomatis) - order order-1 | sudah dikonfirmasi lewat telepon" })];

    const result = await getWaOrderFinancials(["order-1"], { findTransactionsByOrderIds: async () => rows });

    expect(result["order-1"]).toBeDefined();
  });

  it("coerces numeric strings (a driver may return numeric as text) instead of concatenating them", async () => {
    const rows = [row({ modal: "18000" as unknown as number, profit_kotor: "79000" as unknown as number })];

    const result = await getWaOrderFinancials(["order-1"], { findTransactionsByOrderIds: async () => rows });

    expect(result["order-1"]!.modal).toBe(18000);
    expect(result["order-1"]!.profitKotor).toBe(79000);
  });

  it("does not query at all for an empty id list", async () => {
    let called = false;
    const result = await getWaOrderFinancials([], {
      findTransactionsByOrderIds: async () => {
        called = true;
        return [];
      },
    });

    expect(result).toEqual({});
    expect(called).toBe(false);
  });
});
