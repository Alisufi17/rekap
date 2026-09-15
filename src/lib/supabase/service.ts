import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client for trusted server-to-server integrations ONLY - never
// reachable from a browser, never gated by a real staff session's RLS
// (bypasses it entirely). The one consumer is
// src/lib/integrations/wa-orders-deps.ts, behind isValidIntegrationSecret.
// Every other server-side read/write in this app goes through
// src/lib/supabase/server.ts's cookie-scoped client instead.
export function createServiceClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
