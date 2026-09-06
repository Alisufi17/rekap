export const fmtIDR = (n: number | null | undefined) =>
  "Rp" + Math.round(n || 0).toLocaleString("id-ID");

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Format tanggal lokal sebagai YYYY-MM-DD tanpa lewat toISOString/UTC.
// index.html lama memakai d.toISOString().slice(0,10) yang di WIB (UTC+7)
// menggeser tanggal mundur satu hari untuk jam-jam sebelum tengah malam UTC.
export const localDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayStr = () => localDateStr(new Date());

export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (!d.startsWith("62")) d = "62" + d;
  return "https://wa.me/" + d;
}
