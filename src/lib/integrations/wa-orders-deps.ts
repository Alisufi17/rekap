import { createServiceClient } from "@/lib/supabase/service";
import type { WaOrderDeps } from "./wa-orders";

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
