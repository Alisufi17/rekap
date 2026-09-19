import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidIntegrationSecret } from "@/lib/integrations/auth";
import { createRealWaDailyChatsDeps } from "@/lib/integrations/wa-orders-deps";
import { setWaDailyChats } from "@/lib/integrations/wa-daily-chats";

const dailyChatsSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chatMasuk: z.number().int().min(0).max(100_000),
});

// Owner request 2026-09-19: wa-ai-cs posts the day's new chats from ads here
// (an absolute count, so posting it again is harmless). Same shared-secret
// boundary as the other wa-orders routes.
export async function POST(request: NextRequest) {
  if (!isValidIntegrationSecret(request.headers.get("x-integration-secret"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const json = await request.json().catch(() => undefined);
  const parsed = dailyChatsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    await setWaDailyChats(parsed.data.tanggal, parsed.data.chatMasuk, createRealWaDailyChatsDeps());
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
