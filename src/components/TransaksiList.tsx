"use client";

import { useMemo, useState } from "react";
import { updateTransactionStatus, deleteTransaction, setDikemas } from "@/lib/transactions";
import { fmtIDR, fmtDate, waLink, todayStr } from "@/lib/format";
import { rangeForPreset, RTS_RISK_DAYS, type PresetKey } from "@/lib/dashboard";
import EditTransaksiForm from "@/components/EditTransaksiForm";
import type { Product, VTransaction } from "@/types/database";

const FILTERS: [string, string][] = [
  ["all", "Semua"],
  ["online", "Online"],
  ["offline", "Offline"],
  ["proses", "Proses"],
  ["belum_dikemas", "Belum Dikemas"],
  ["rts_risk", "Potensi RTS"],
  ["belum", "Belum Lunas"],
  ["rts", "RTS"],
];

function hariLalu(tanggal: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tgl = new Date(tanggal + "T00:00:00");
  return Math.floor((today.getTime() - tgl.getTime()) / 86_400_000);
}

const DATE_PRESETS: [PresetKey | "semua", string][] = [
  ["hari_ini", "Hari ini"],
  ["kemarin", "Kemarin"],
  ["7_hari", "7 hari"],
  ["30_hari", "30 hari"],
  ["semua", "Semua"],
];

export default function TransaksiList({
  transactions,
  products,
  isAdmin,
  initialFilter,
}: {
  transactions: VTransaction[];
  products: Product[];
  isAdmin: boolean;
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState(initialFilter || "all");
  // Kalau datang dari link alarm Dashboard (mis. "proses"/"belum"), jangan
  // batasi tanggal — transaksinya bisa saja lebih lama dari 7 hari terakhir.
  const [datePreset, setDatePreset] = useState<PresetKey | "semua">(
    initialFilter ? "semua" : "7_hari"
  );
  const [customDate, setCustomDate] = useState(todayStr());
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [search, setSearch] = useState("");
  const isSearching = search.trim().length > 0;

  const dateFiltered = useMemo(() => {
    // Lagi cari nama? Cari di SEMUA tanggal — user biasanya tidak ingat
    // persis kapan transaksinya, cuma ingat namanya.
    if (isSearching) return transactions;
    if (useCustomDate) return transactions.filter((t) => t.tanggal === customDate);
    if (datePreset === "semua") return transactions;
    const range = rangeForPreset(datePreset);
    return transactions.filter((t) => t.tanggal >= range.from && t.tanggal <= range.to);
  }, [transactions, datePreset, useCustomDate, customDate, isSearching]);

  const searchFiltered = useMemo(() => {
    if (!isSearching) return dateFiltered;
    const q = search.trim().toLowerCase();
    return dateFiltered.filter(
      (t) =>
        t.customer.toLowerCase().includes(q) ||
        (t.customer_phone ?? "").toLowerCase().includes(q)
    );
  }, [dateFiltered, isSearching, search]);

  const filtered = searchFiltered.filter((t) => {
    if (filter === "all") return true;
    if (filter === "online") return t.channel === "online";
    if (filter === "offline") return t.channel === "offline";
    if (filter === "proses") return t.status === "proses";
    if (filter === "belum") return t.status === "belum";
    if (filter === "rts") return t.status === "rts";
    if (filter === "belum_dikemas")
      return t.channel === "online" && t.status === "proses" && !t.dikemas;
    if (filter === "rts_risk")
      return t.channel === "online" && t.status === "proses" && hariLalu(t.tanggal) >= RTS_RISK_DAYS;
    return true;
  });

  const groups = useMemo(() => {
    const map = new Map<string, VTransaction[]>();
    filtered.forEach((t) => {
      const list = map.get(t.tanggal);
      if (list) list.push(t);
      else map.set(t.tanggal, [t]);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function pickDatePreset(p: PresetKey | "semua") {
    setDatePreset(p);
    setUseCustomDate(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
        <svg
          className="h-4 w-4 flex-shrink-0 text-ink-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau nomor HP pelanggan..."
          className="w-full text-sm outline-none placeholder:text-ink-faint"
        />
        {isSearching && (
          <button onClick={() => setSearch("")} className="text-xs font-medium text-ink-faint">
            ✕
          </button>
        )}
      </div>

      <div
        className={`mb-2 flex flex-wrap gap-1.5 rounded-lg bg-white p-1.5 text-xs ${
          isSearching ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {DATE_PRESETS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => pickDatePreset(key)}
            className={`rounded-md px-2.5 py-1.5 font-medium ${
              !useCustomDate && datePreset === key ? "bg-primary text-white" : "text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          value={customDate}
          max={todayStr()}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setUseCustomDate(true);
          }}
          className={`rounded-md border px-2 py-1.5 text-xs ${
            useCustomDate ? "border-primary text-ink" : "border-border text-ink-soft"
          }`}
        />
      </div>
      {isSearching && (
        <div className="mb-2 text-xs text-ink-faint">
          Menampilkan hasil pencarian dari semua tanggal — filter tanggal dinonaktifkan sementara.
        </div>
      )}

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === key ? "bg-primary text-white" : "bg-white text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-faint">
          <div className="mb-2 text-2xl">🧾</div>
          Belum ada transaksi di periode ini.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([tanggal, txs]) => (
            <DateGroup
              key={tanggal}
              tanggal={tanggal}
              transactions={txs}
              products={products}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DateGroup({
  tanggal,
  transactions,
  products,
  isAdmin,
}: {
  tanggal: string;
  transactions: VTransaction[];
  products: Product[];
  isAdmin: boolean;
}) {
  const omsetTerkonfirmasi = transactions
    .filter((t) => t.terkonfirmasi)
    .reduce((s, t) => s + t.omset, 0);
  const isToday = tanggal === todayStr();

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <div className="text-sm font-bold">
          {fmtDate(tanggal)}
          {isToday && <span className="ml-1.5 text-xs font-medium text-primary">· Hari ini</span>}
        </div>
        <div className="text-xs text-ink-soft">
          {transactions.length} transaksi · <span className="num">{fmtIDR(omsetTerkonfirmasi)}</span>
        </div>
      </div>
      <div className="space-y-3">
        {transactions.map((t) => (
          <TxCard key={t.id} t={t} products={products} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

function TxCard({
  t,
  products,
  isAdmin,
}: {
  t: VTransaction;
  products: Product[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dikemasBusy, setDikemasBusy] = useState(false);
  const statusLabel =
    t.channel === "online"
      ? t.status === "proses"
        ? "Proses"
        : t.status === "selesai"
          ? "Selesai"
          : "RTS"
      : t.status === "lunas"
        ? "Lunas"
        : "Belum Lunas";

  const isOpenOnline = t.channel === "online" && t.status === "proses";
  const umur = isOpenOnline ? hariLalu(t.tanggal) : 0;
  const isRtsRisk = isOpenOnline && umur >= RTS_RISK_DAYS;
  const isBelumDikemas = isOpenOnline && !t.dikemas;

  async function handleStatusChange(newStatus: string) {
    setBusy(true);
    await updateTransactionStatus(t.id, newStatus);
    setBusy(false);
  }

  async function handleToggleDikemas() {
    setDikemasBusy(true);
    await setDikemas(t.id, !t.dikemas);
    setDikemasBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Hapus transaksi ini? Stok produk akan dikembalikan otomatis.")) return;
    setBusy(true);
    await deleteTransaction(t.id);
    setBusy(false);
  }

  const wa = waLink(t.customer_phone);

  if (editing) {
    return <EditTransaksiForm t={t} products={products} onDone={() => setEditing(false)} />;
  }

  return (
    <div
      className={`rounded-xl border bg-white p-3.5 ${
        isRtsRisk ? "border-accent/40" : isBelumDikemas ? "border-offline/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{t.produk_nama}</div>
          <div className="text-xs text-ink-soft">
            {t.customer} · qty {t.qty}
          </div>
        </div>
        <div className="num text-sm font-bold">{fmtIDR(t.omset)}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={t.channel === "online" ? "online" : "offline"}>
          {t.channel === "online" ? "Online" : "Offline"}
        </Badge>
        <Badge tone={t.status === "rts" ? "danger" : "neutral"}>{statusLabel}</Badge>
        {isRtsRisk && (
          <Badge tone="danger">⚠ {umur} hari lalu · potensi RTS</Badge>
        )}
        {!t.affects_stock && <Badge tone="neutral">Data historis</Badge>}
        <Badge tone="neutral">Profit {fmtIDR(t.profit_kotor)}</Badge>
      </div>
      {t.catatan && <div className="mt-2 text-xs italic text-ink-soft">&quot;{t.catatan}&quot;</div>}
      {t.created_by && <div className="text-xs text-ink-faint">dicatat oleh {t.created_by}</div>}

      {isOpenOnline && (
        <button
          disabled={dikemasBusy}
          onClick={handleToggleDikemas}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
            t.dikemas
              ? "bg-surface text-ink-soft"
              : "bg-offline/15 text-offline"
          }`}
        >
          {t.dikemas ? "✓ Sudah Dikemas & Dikirim" : "📦 Tandai Sudah Dikemas & Dikirim"}
        </button>
      )}
      {!isOpenOnline && t.channel === "online" && !t.dikemas && (
        <div className="mt-2 text-xs text-ink-faint">Belum pernah ditandai dikemas</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          disabled={busy}
          defaultValue={t.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-border px-2 py-1.5 text-xs"
        >
          {t.channel === "online" ? (
            <>
              <option value="proses">Proses</option>
              <option value="selesai">Selesai</option>
              <option value="rts">RTS</option>
            </>
          ) : (
            <>
              <option value="lunas">Lunas</option>
              <option value="belum">Belum Lunas</option>
            </>
          )}
        </select>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-primary"
          >
            Chat WA
          </a>
        )}
        <button
          disabled={busy}
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-ink-soft"
        >
          Edit
        </button>
        {isAdmin && (
          <button
            disabled={busy}
            onClick={handleDelete}
            className="rounded-lg border border-accent/30 px-2 py-1.5 text-xs font-medium text-accent"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "online" | "offline" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "online"
      ? "bg-online/10 text-online"
      : tone === "offline"
        ? "bg-offline/10 text-offline"
        : tone === "danger"
          ? "bg-accent/10 text-accent"
          : "bg-surface text-ink-soft";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
  );
}
