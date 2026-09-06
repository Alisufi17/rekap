"use client";

import { useState } from "react";
import { upsertProduct, deleteProduct } from "@/lib/products";
import { fmtIDR } from "@/lib/format";
import type { Product } from "@/types/database";

export default function ProductList({
  products,
  canEdit,
}: {
  products: Product[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setError("");
    setShowModal(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await upsertProduct({
      id: editing?.id,
      nama: String(form.get("nama") || ""),
      hpp: Number(form.get("hpp") || 0),
      stok: Number(form.get("stok") || 0),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Gagal menyimpan");
      return;
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus produk ini?")) return;
    await deleteProduct(id);
  }

  return (
    <div>
      {canEdit && (
        <button
          onClick={openNew}
          className="mb-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white"
        >
          + Produk Baru
        </button>
      )}

      {products.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-faint">
          <div className="mb-1 text-2xl">📦</div>
          Belum ada produk.
        </div>
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border bg-white p-3.5"
            >
              <div>
                <div className="text-sm font-bold">{p.nama}</div>
                <div className="text-xs text-ink-soft">
                  HPP {fmtIDR(p.hpp)} · Stok {p.stok}
                  {p.stok < 0 && <span className="text-accent"> (selisih!)</span>}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-medium text-accent"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">{editing ? "Ubah Produk" : "Produk Baru"}</h3>
              <button onClick={() => setShowModal(false)} className="text-ink-soft">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  Nama Produk
                </label>
                <input
                  name="nama"
                  type="text"
                  defaultValue={editing?.nama ?? ""}
                  placeholder="mis. Kaos Polos L"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">HPP</label>
                  <input
                    name="hpp"
                    type="number"
                    min={0}
                    defaultValue={editing?.hpp ?? ""}
                    placeholder="0"
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Stok</label>
                  <input
                    name="stok"
                    type="number"
                    defaultValue={editing?.stok ?? ""}
                    placeholder="0"
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
                  />
                </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
