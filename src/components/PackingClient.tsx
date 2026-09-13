"use client";

import { useMemo, useState } from "react";
import { setDikemas } from "@/lib/transactions";
import { fmtIDR, fmtDate, waLink } from "@/lib/format";
import type { VPackingQueue } from "@/types/database";

export default function PackingClient({ orders }: { orders: VPackingQueue[] }) {
  const perluDikemas = useMemo(
    () =>
      orders
        .filter((o) => o.status === "proses" && !o.dikemas)
        // Paling lama diinput duluan — itu yang risiko RTS-nya paling tinggi.
        .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0)),
    [orders]
  );
  const sudahDikemas = useMemo(() => orders.filter((o) => o.dikemas).slice(0, 20), [orders]);

  const qtyPerProduk = useMemo(() => {
    const map: Record<string, number> = {};
    perluDikemas.forEach((o) => {
      map[o.produk_nama] = (map[o.produk_nama] ?? 0) + o.qty;
    });
    return Object.entries(map)
      .map(([nama, qty]) => ({ nama, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [perluDikemas]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-primary/30 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Perlu Dikemas
        </div>
        <div className="num mt-1 text-3xl font-extrabold text-ink">
          {perluDikemas.length} <span className="text-base font-medium text-ink-soft">paket</span>
        </div>
        {qtyPerProduk.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            {qtyPerProduk.map((p) => (
              <div key={p.nama} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{p.nama}</span>
                <span className="num font-bold">{p.qty} pcs</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {perluDikemas.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-faint">
          <div className="mb-2 text-2xl">✅</div>
          Semua paket sudah dikemas.
        </div>
      ) : (
        <div className="space-y-3">
          {perluDikemas.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      {sudahDikemas.length > 0 && (
        <div>
          <div className="mb-2 pt-2 text-sm font-bold text-ink">
            Sudah Dikemas <span className="text-ink-faint">(terbaru)</span>
          </div>
          <div className="space-y-2">
            {sudahDikemas.map((o) => (
              <OrderCard key={o.id} order={o} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, compact }: { order: VPackingQueue; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const wa = waLink(order.customer_phone);

  async function handleToggle() {
    setBusy(true);
    await setDikemas(order.id, !order.dikemas);
    setBusy(false);
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm">
        <div>
          <div className="font-medium">{order.produk_nama}</div>
          <div className="text-xs text-ink-faint">
            {order.customer} · qty {order.qty} · {fmtDate(order.tanggal)}
          </div>
        </div>
        <button
          disabled={busy}
          onClick={handleToggle}
          className="whitespace-nowrap rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft"
        >
          ✓ Batal tandai
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{order.produk_nama}</div>
          <div className="text-xs text-ink-soft">
            {order.customer} · qty {order.qty}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-sm font-bold">{fmtIDR(order.total_harga)}</div>
          <div className="text-xs text-ink-faint">{fmtIDR(order.harga)}/pcs</div>
        </div>
      </div>
      {order.catatan && (
        <div className="mt-2 text-xs italic text-ink-soft">&quot;{order.catatan}&quot;</div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={busy}
          onClick={handleToggle}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          📦 Tandai Sudah Dikemas &amp; Dikirim
        </button>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-primary"
          >
            WA
          </a>
        )}
      </div>
    </div>
  );
}
