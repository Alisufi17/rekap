import { describe, it, expect } from "vitest";
import { hitungOngkir, hitungProfitPreview, BIAYA_PACKING } from "./pricing";

describe("hitungOngkir", () => {
  it("1-3 bibit memakai tarif tetap dari owner", () => {
    expect(hitungOngkir(1)).toBe(12_000);
    expect(hitungOngkir(2)).toBe(24_000);
    expect(hitungOngkir(3)).toBe(30_000);
  });

  it("4 bibit ke atas dihitung lanjut Rp10.000 per bibit dari tarif 3 bibit", () => {
    expect(hitungOngkir(4)).toBe(40_000);
    expect(hitungOngkir(5)).toBe(50_000);
    expect(hitungOngkir(10)).toBe(100_000);
  });

  it("qty 0, negatif, atau bukan angka = 0", () => {
    expect(hitungOngkir(0)).toBe(0);
    expect(hitungOngkir(-2)).toBe(0);
    expect(hitungOngkir(NaN)).toBe(0);
  });

  it("qty pecahan dibulatkan ke atas", () => {
    expect(hitungOngkir(1.2)).toBe(24_000);
  });
});

describe("hitungProfitPreview", () => {
  it("online: omset - modal - ongkir - packing", () => {
    expect(
      hitungProfitPreview({ channel: "online", totalHarga: 120_000, qty: 2, hpp: 30_000, ongkir: 24_000 })
    ).toBe(120_000 - 60_000 - 24_000 - BIAYA_PACKING);
  });

  it("offline: ongkir diabaikan walau terisi", () => {
    expect(
      hitungProfitPreview({ channel: "offline", totalHarga: 100_000, qty: 1, hpp: 40_000, ongkir: 99_000 })
    ).toBe(100_000 - 40_000 - BIAYA_PACKING);
  });
});
