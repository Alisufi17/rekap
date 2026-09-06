"use client";

import { fmtIDR, fmtDate, waLink } from "@/lib/format";
import type { VTransaction } from "@/types/database";

interface Customer {
  nama: string;
  phone: string;
  totalOmset: number;
  jumlahOrder: number;
  terakhir: string;
}

function computeCustomers(transactions: VTransaction[]): Customer[] {
  const map: Record<string, Customer> = {};
  transactions.forEach((t) => {
    const key = t.customer_phone?.trim() ? t.customer_phone.trim() : `noname:${t.customer}`;
    map[key] ??= {
      nama: t.customer,
      phone: t.customer_phone || "",
      totalOmset: 0,
      jumlahOrder: 0,
      terakhir: t.tanggal,
    };
    map[key]!.totalOmset += t.omset;
    map[key]!.jumlahOrder += 1;
    if (t.tanggal > map[key]!.terakhir) map[key]!.terakhir = t.tanggal;
  });
  return Object.values(map).sort((a, b) => b.totalOmset - a.totalOmset);
}

export default function PelangganList({ transactions }: { transactions: VTransaction[] }) {
  const customers = computeCustomers(transactions);
  const withPhone = customers.filter((c) => c.phone);

  function copyAllPhones() {
    const nums = withPhone.map((c) => c.phone.replace(/\D/g, "")).join(", ");
    if (!nums) {
      alert("Belum ada nomor HP tersimpan");
      return;
    }
    navigator.clipboard.writeText(nums).then(() => alert("Semua nomor disalin ke clipboard"));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-white p-3.5">
        <div>
          <div className="text-sm font-extrabold">{customers.length} pelanggan</div>
          <div className="text-xs text-ink-soft">{withPhone.length} punya nomor HP</div>
        </div>
        <button
          onClick={copyAllPhones}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
        >
          Salin Semua No. HP
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-faint">
          <div className="mb-2 text-2xl">👥</div>
          Belum ada data pelanggan.
        </div>
      ) : (
        <div className="space-y-2.5">
          {customers.map((c) => {
            const wa = waLink(c.phone);
            return (
              <div key={c.phone || c.nama} className="rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold">{c.nama}</div>
                    <div className="text-xs text-ink-soft">
                      {c.phone || "Nomor HP belum diisi"} · {c.jumlahOrder} order · terakhir{" "}
                      {fmtDate(c.terakhir)}
                    </div>
                  </div>
                  <div className="num text-sm font-extrabold">{fmtIDR(c.totalOmset)}</div>
                </div>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block rounded-lg bg-primary py-2 text-center text-xs font-semibold text-white"
                  >
                    Chat WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
