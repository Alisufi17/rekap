import { createClient } from "@/lib/supabase/server";
import PelangganList from "@/components/PelangganList";
import type { VTransaction } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("v_transactions").select("*");

  return <PelangganList transactions={(data ?? []) as VTransaction[]} />;
}
