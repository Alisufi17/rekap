import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidIntegrationSecret } from "@/lib/integrations/auth";
import { createRealWaOrderFinancialsDeps } from "@/lib/integrations/wa-orders-deps";
import { getWaOrderFinancials } from "@/lib/integrations/wa-orders";

// Ids only ever go into a PostgREST .or() filter string, so anything that
// could carry a comma, dot or parenthesis is refused up front.
const financialsSchema = z.object({
  orderIds: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
    .min(1)
    .max(100),
});

// Owner request 2026-09-19: wa-ai-cs asks for the real HPP/profit of its own
// orders (read-only) so its order page can show them next to each order. Same
// shared-secret boundary as the two write routes beside it.
export async function POST(request: NextRequest) {
  if (!isValidIntegrationSecret(request.headers.get("x-integration-secret"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  const parsed = financialsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const financials = await getWaOrderFinancials(parsed.data.orderIds, createRealWaOrderFinancialsDeps());
    return NextResponse.json({ financials });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
