import { createServiceClient } from "@/lib/supabase/service";
import type { WaDailyChatsDeps } from "./wa-daily-chats";
import type { WaOrderDeps, WaOrderFinancialsDeps, WaOrderRenameDeps } from "./wa-orders";

export function createRealWaOrderRenameDeps(): WaOrderRenameDeps {
  const supabase = createServiceClient();
  return {
    async updateCustomerByOrderId(orderId, customer) {
      // Same match rule as the delivered-mark: pushWaOrder tags every row's
      // catatan with the order id. Only the label column is written.
      const { data, error } = await supabase
        .from("transactions")
        .update({ customer })
        .ilike("catatan", `%${orderId}%`)
        .select("id");
      if (error) {
        throw new Error(`Customer rename failed: ${error.message}`);
      }
      return data?.length ?? 0;
    },
  };
}

export function createRealWaDailyChatsDeps(): WaDailyChatsDeps {
  const supabase = createServiceClient();
  return {
    async updateChatMasuk(tanggal, chatMasuk) {
      // Only chat_masuk in the payload: spend_iklan on the same row is the
      // owner's own input and must never be touched by a sync.
      const { data, error } = await supabase
        .from("daily_metrics")
        .update({ chat_masuk: chatMasuk })
        .eq("tanggal", tanggal)
        .select("tanggal");
      if (error) {
        throw new Error(`Chat count update failed: ${error.message}`);
      }
      return (data?.length ?? 0) > 0;
    },
    async insertChatMasuk(tanggal, chatMasuk) {
      const { error } = await supabase
        .from("daily_metrics")
        .insert({ tanggal, spend_iklan: 0, chat_masuk: chatMasuk });
      if (error) {
        // 23505 = unique violation: that date's row was created a moment ago.
        if (error.code === "23505") return "conflict";
        throw new Error(`Chat count insert failed: ${error.message}`);
      }
      return "inserted";
    },
  };
}

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
