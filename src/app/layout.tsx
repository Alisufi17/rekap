import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rekap",
  description: "Dashboard penjualan tim",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-surface">{children}</body>
    </html>
  );
}
