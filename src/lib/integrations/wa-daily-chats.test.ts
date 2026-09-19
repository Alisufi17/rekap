import { describe, expect, it } from "vitest";
import { setWaDailyChats, type WaDailyChatsDeps } from "./wa-daily-chats";

function makeDeps(existing: Set<string>, opts: { insertConflicts?: boolean } = {}) {
  const calls: string[] = [];
  const deps: WaDailyChatsDeps = {
    updateChatMasuk: async (tanggal, chatMasuk) => {
      calls.push(`update ${tanggal} ${chatMasuk}`);
      return existing.has(tanggal);
    },
    insertChatMasuk: async (tanggal, chatMasuk) => {
      calls.push(`insert ${tanggal} ${chatMasuk}`);
      if (opts.insertConflicts) {
        existing.add(tanggal);
        return "conflict";
      }
      existing.add(tanggal);
      return "inserted";
    },
  };
  return { deps, calls };
}

describe("setWaDailyChats", () => {
  it("updates only chat_masuk when the date already has a row (the owner's typed spend is left alone)", async () => {
    const { deps, calls } = makeDeps(new Set(["2026-09-19"]));

    await setWaDailyChats("2026-09-19", 46, deps);

    expect(calls).toEqual(["update 2026-09-19 46"]);
  });

  it("creates the row when the date has none yet", async () => {
    const { deps, calls } = makeDeps(new Set());

    await setWaDailyChats("2026-09-20", 3, deps);

    expect(calls).toEqual(["update 2026-09-20 3", "insert 2026-09-20 3"]);
  });

  it("retries as an update when the row appears between the update and the insert", async () => {
    const { deps, calls } = makeDeps(new Set(), { insertConflicts: true });

    await setWaDailyChats("2026-09-20", 3, deps);

    expect(calls).toEqual(["update 2026-09-20 3", "insert 2026-09-20 3", "update 2026-09-20 3"]);
  });
});
