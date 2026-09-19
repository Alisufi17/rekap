import { createServiceClient } from "@/lib/supabase/service";
import type { WaOrderDeps, WaOrderFinancialsDeps } from "./wa-orders";

export function createRealWaOrderFinancialsDeps(): WaOrderFinancialsDeps {
  const supabase = createServiceClient();
  return {
    async findTransactionsByOrderIds(orderIds) {
      // Read from the view, not the table: it already carries the computed
      // omset/modal/profit_kotor. The `*` is PostgREST's ilike wildcard inside
      // an .or() string; the route only lets [A-Za-z0-9_-] ids through, so
      // nothing here can break out of the filter.
      const { data, error } = await supabase
        .from("v_transactions")
        .select(
          "catatan, produk_nama, qty, harga, hpp, ongkir, admin, omset, modal, biaya_transaksi, profit_kotor, status, terkonfirmasi, estimasi, retur",
        )
        .or(orderIds.map((id) => `catatan.ilike.*${id}*`).join(","));
      if (error) {
        throw new Error(`Financials lookup failed: ${error.message}`);
      }
      return data ?? [];
    },
  };
}

export function createRealWaOrderDeps(): WaOrderDeps {
  const supabase = createServiceClient();
  return {
    async findProductByName(nama) {
      const { data, error } = await supabase.from("products").select("id, hpp").eq("nama", nama).maybeSingle();
      if (error) {
        throw new Error(`Product lookup failed: ${error.message}`);
      }
      return data;
    },
    async insertTransactions(rows) {
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) {
        throw new Error(`Transaction insert failed: ${error.message}`);
      }
    },
    async updateDeliveredByOrderId(orderId) {
      const { data, error } = await supabase
        .from("transactions")
        .update({ status: "selesai", dikemas: true })
        .ilike("catatan", `%${orderId}%`)
        .select("id");
      if (error) {
        throw new Error(`Delivered update failed: ${error.message}`);
      }
      return data?.length ?? 0;
    },
  };
}
