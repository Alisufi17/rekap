import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidIntegrationSecret } from "@/lib/integrations/auth";
import { createRealWaOrderRenameDeps } from "@/lib/integrations/wa-orders-deps";
import { renameWaOrderCustomer } from "@/lib/integrations/wa-orders";

// Same id whitelist as the financials route: the id only ever goes into an
// ilike filter, so nothing that could carry a wildcard or a comma gets through.
const renameSchema = z.object({
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  customer: z.string().trim().min(1).max(200),
});

// Owner request 2026-09-19: wa-ai-cs calls this when a customer is named or
// renamed, for each of their orders that already reached this app.
export async function POST(request: NextRequest) {
  if (!isValidIntegrationSecret(request.headers.get("x-integration-secret"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  const parsed = renameSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const count = await renameWaOrderCustomer(parsed.data.orderId, parsed.data.customer, createRealWaOrderRenameDeps());
    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
