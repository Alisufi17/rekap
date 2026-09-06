import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import ProductList from "@/components/ProductList";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("nama");

  return <ProductList products={(data ?? []) as Product[]} canEdit={isAdmin(profile)} />;
}
