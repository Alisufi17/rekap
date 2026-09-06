import { createClient } from "@/lib/supabase/server";
import TambahTransaksiForm from "@/components/TambahTransaksiForm";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TambahTransaksiPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("nama");

  return <TambahTransaksiForm products={(data ?? []) as Product[]} />;
}
