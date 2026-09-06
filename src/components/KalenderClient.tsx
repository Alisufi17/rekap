"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtIDR, localDateStr, todayStr } from "@/lib/format";
import type { VDailySales } from "@/types/database";

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type DayCell = {
  day: number;
  key: string;
  omset: number;
  profit: number;
  count: number;
  trend: "up" | "down" | "flat";
};

export default function KalenderClient({ dailySales }: { dailySales: VDailySales[] }) {
  const [calDate, setCalDate] = useState(() => new Date());

  const byDate = useMemo(() => {
    const map = new Map<string, VDailySales>();
    dailySales.forEach((d) => map.set(d.tanggal, d));
    return map;
  }, [dailySales]);

  function omsetOn(key: string) {
    return byDate.get(key)?.omset ?? 0;
  }

  const { cells, firstWeekday, maxOmset, monthOmset, monthProfit } = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    const days: DayCell[] = [];
    let maxOmset = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = localDateStr(new Date(year, month, day));
      const row = byDate.get(key);
      const omset = row?.omset ?? 0;
      const profit = row?.profit_kotor ?? 0;
      const count = row?.jumlah_transaksi ?? 0;
      if (omset > maxOmset) maxOmset = omset;

      const prevKey = localDateStr(new Date(year, month, day - 1));
      const prevOmset = omsetOn(prevKey);
      const trend: DayCell["trend"] =
        omset === prevOmset ? "flat" : omset > prevOmset ? "up" : "down";

      days.push({ day, key, omset, profit, count, trend });
    }

    const monthOmset = days.reduce((s, d) => s + d.omset, 0);
    const monthProfit = days.reduce((s, d) => s + d.profit, 0);

    return { cells: days, firstWeekday, maxOmset, monthOmset, monthProfit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calDate, byDate]);

  function changeMonth(delta: number) {
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  const monthLabel = calDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const monthFrom = localDateStr(new Date(calDate.getFullYear(), calDate.getMonth(), 1));
  const lastDayOfMonth = localDateStr(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0));
  const monthTo = lastDayOfMonth < todayStr() ? lastDayOfMonth : todayStr();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-lg"
        >
          ‹
        </button>
        <div className="text-sm font-bold">{monthLabel}</div>
        <button
          onClick={() => changeMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-lg"
        >
          ›
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border-l-4 border-online bg-white p-3">
          <div className="text-xs text-ink-soft">Omset bulan ini</div>
          <div className="num text-lg font-bold">{fmtIDR(monthOmset)}</div>
        </div>
        <div className="rounded-xl border-l-4 border-offline bg-white p-3">
          <div className="text-xs text-ink-soft">Profit bulan ini</div>
          <div className="num text-lg font-bold">{fmtIDR(monthProfit)}</div>
        </div>
      </div>

      <Link
        href={`/dashboard?from=${monthFrom}&to=${monthTo}`}
        className="mb-4 block rounded-lg border border-border bg-white py-2 text-center text-xs font-medium text-primary"
      >
        Lihat detail {monthLabel} di Dashboard →
      </Link>

      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold text-ink-faint">
            {d}
          </div>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {cells.map((c) => {
          const intensity = maxOmset > 0 ? Math.max(0.06, c.omset / maxOmset) : 0;
          const bg = c.omset > 0 ? `rgba(14,124,90,${intensity.toFixed(2)})` : undefined;
          const textColor = intensity > 0.5 ? "#fff" : undefined;
          return (
            <Link
              key={c.key}
              href={`/dashboard?from=${c.key}&to=${c.key}`}
              title={`${fmtIDR(c.omset)} · profit ${fmtIDR(c.profit)} · ${c.count} transaksi`}
              className={`relative block aspect-square rounded-lg p-1 text-left ${
                c.omset > 0 ? "" : "bg-surface"
              }`}
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {c.trend === "up" && (
                <span className="absolute right-1 top-1 text-[9px] text-primary">▲</span>
              )}
              {c.trend === "down" && (
                <span className="absolute right-1 top-1 text-[9px] text-accent">▼</span>
              )}
              <div
                className="text-[11px] font-semibold"
                style={{ color: textColor ?? (c.omset > 0 ? "#1B1F1C" : "#5B6660") }}
              >
                {c.day}
              </div>
              <div className="text-[9px]" style={{ color: textColor ?? "#9AA39D" }}>
                {c.omset > 0
                  ? c.omset >= 1_000_000
                    ? (c.omset / 1_000_000).toFixed(1) + "jt"
                    : (c.omset / 1_000).toFixed(0) + "rb"
                  : "-"}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded"
            style={{ backgroundColor: "rgba(14,124,90,.15)" }}
          />
          Sepi
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: "rgba(14,124,90,.9)" }} />
          Ramai
        </span>
        <span>▲ naik dari hari sebelumnya · ▼ turun</span>
      </div>
    </div>
  );
}
