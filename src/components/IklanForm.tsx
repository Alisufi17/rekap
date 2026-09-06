"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertDailyMetric } from "@/lib/metrics";
import { todayStr } from "@/lib/format";
import type { DailyMetric } from "@/types/database";

export default function IklanForm({ existing }: { existing: DailyMetric[] }) {
  const router = useRouter();
  const [tanggal, setTanggal] = useState(todayStr());
  const [spend, setSpend] = useState(() => String(findExisting(existing, todayStr())?.spend_iklan ?? ""));
  const [chat, setChat] = useState(() => String(findExisting(existing, todayStr())?.chat_masuk ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function onDateChange(v: string) {
    setTanggal(v);
    const m = findExisting(existing, v);
    setSpend(m ? String(m.spend_iklan) : "");
    setChat(m ? String(m.chat_masuk) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await upsertDailyMetric({
      tanggal,
      spendIklan: parseFloat(spend) || 0,
      chatMasuk: parseFloat(chat) || 0,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Tanggal</label>
        <input
          type="date"
          value={tanggal}
          max={todayStr()}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Spend Iklan (Rp)</label>
          <input
            type="number"
            min={0}
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Chat Masuk</label>
          <input
            type="number"
            min={0}
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      <div className="text-xs text-ink-soft">
        Pilih tanggal yang sudah pernah diisi untuk mengubah datanya (menimpa data lama).
      </div>
      {error && <div className="text-sm text-accent">{error}</div>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

function findExisting(list: DailyMetric[], tanggal: string) {
  return list.find((m) => m.tanggal === tanggal);
}
