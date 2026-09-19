// Owner request 2026-09-19 ("ya boleh" to sending chat masuk automatically):
// wa-ai-cs counts the day's new chats from ads and posts that number here, so
// the "Chat Masuk" on the Iklan page (which drives cost per chat and
// conversion) no longer has to be typed by hand.
//
// Only `chat_masuk` is ever written. `spend_iklan` on the same row is typed in
// by the owner and must survive every sync, so an existing row gets a plain
// UPDATE of that one column - never an upsert of the whole row.

export interface WaDailyChatsDeps {
  // true when a row for that date existed (and was updated)
  updateChatMasuk: (tanggal: string, chatMasuk: number) => Promise<boolean>;
  // "conflict" = someone else created that date's row a moment ago
  insertChatMasuk: (tanggal: string, chatMasuk: number) => Promise<"inserted" | "conflict">;
}

export async function setWaDailyChats(tanggal: string, chatMasuk: number, deps: WaDailyChatsDeps): Promise<void> {
  if (await deps.updateChatMasuk(tanggal, chatMasuk)) return;
  const result = await deps.insertChatMasuk(tanggal, chatMasuk);
  if (result === "conflict") {
    await deps.updateChatMasuk(tanggal, chatMasuk);
  }
}
