import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidIntegrationSecret } from "@/lib/integrations/auth";
import { markWaOrderDelivered } from "@/lib/integrations/wa-orders";
import { createRealWaOrderDeps } from "@/lib/integrations/wa-orders-deps";

const deliverSchema = z.object({ orderId: z.string().min(1) });

// Owner request 2026-09-15: "sekalian konfirmasi udah datengnya juga
// terhubung" - wa-ai-cs calls this once a WA order is marked delivered, so
// the matching transaction(s) here flip to "selesai" AND "dikemas" together
// (the earlier raw-REST version only touched status, so it silently never
// got packing-verified). Matched via the same catatan tag pushWaOrder wrote.
export async function POST(request: NextRequest) {
  if (!isValidIntegrationSecret(request.headers.get("x-integration-secret"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  const parsed = deliverSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const count = await markWaOrderDelivered(parsed.data.orderId, createRealWaOrderDeps());
  return NextResponse.json({ ok: true, count });
}
