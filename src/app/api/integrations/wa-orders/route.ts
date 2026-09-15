import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidIntegrationSecret } from "@/lib/integrations/auth";
import { createRealWaOrderDeps } from "@/lib/integrations/wa-orders-deps";
import { ProductMissingHppError, ProductNotFoundError, pushWaOrder } from "@/lib/integrations/wa-orders";

const orderItemSchema = z.object({
  produkNama: z.string().min(1),
  qty: z.number().int().positive(),
  harga: z.number().min(0),
});

const pushOrderSchema = z.object({
  orderId: z.string().min(1),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer: z.string().min(1),
  customerPhone: z.string().nullable(),
  items: z.array(orderItemSchema).min(1),
  ongkir: z.number().min(0),
});

// Owner request 2026-09-15: a confirmed order from wa-ai-cs lands here
// instead of that app writing straight into `transactions` itself - see
// src/lib/integrations/wa-orders.ts for why (HPP + dikemas rules live in one
// place now). Auth is a shared secret header, not a Supabase user session -
// there is no staff member logged in on the other end of this call.
export async function POST(request: NextRequest) {
  if (!isValidIntegrationSecret(request.headers.get("x-integration-secret"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  const parsed = pushOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await pushWaOrder(parsed.data, createRealWaOrderDeps());
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND", produkNama: err.produkNama }, { status: 404 });
    }
    if (err instanceof ProductMissingHppError) {
      return NextResponse.json({ error: "PRODUCT_MISSING_HPP", produkNama: err.produkNama }, { status: 422 });
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
