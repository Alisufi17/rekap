import { createClient } from "@/lib/supabase/server";
import PackingClient from "@/components/PackingClient";
import type { VPackingQueue } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PackingPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_packing_queue")
    .select("*")
    .order("tanggal", { ascending: false });

  return <PackingClient orders={(data ?? []) as VPackingQueue[]} />;
}
