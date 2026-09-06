// Ditulis tangan mengikuti supabase/migrations/. Kalau schema berubah, cek
// migrasi terbaru dan sesuaikan di sini — atau generate ulang dengan:
//   npx supabase gen types typescript --project-id ayxmrlecjqmhsoirrost > src/types/database.ts
// (perlu Supabase CLI + login; sampai itu dipasang, tipe di bawah adalah sumbernya)

export type UserRole = "admin" | "staff";
export type TxChannel = "online" | "offline";
export type TxStatusOnline = "proses" | "selesai" | "rts";
export type TxStatusOffline = "lunas" | "belum";
export type TxStatus = TxStatusOnline | TxStatusOffline;

export interface Profile {
  id: string;
  email: string | null;
  nama: string | null;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  nama: string;
  hpp: number;
  stok: number;
}

export interface Transaction {
  id: string;
  channel: TxChannel;
  tanggal: string; // date, format YYYY-MM-DD
  customer: string;
  customer_phone: string | null;
  produk_id: string;
  produk_nama: string;
  qty: number;
  harga: number; // harga per pcs
  hpp: number;
  ongkir: number;
  admin: number;
  catatan: string | null;
  status: TxStatus;
  created_by: string | null; // email, kolom lama
  created_by_uid: string | null;
  affects_stock: boolean;
  created_at: string;
}

export interface DailyMetric {
  tanggal: string;
  spend_iklan: number;
  chat_masuk: number;
}

export type ExpenseCategoryCode =
  | "packing"
  | "ongkir_in"
  | "gaji"
  | "listrik"
  | "sewa"
  | "transport"
  | "platform"
  | "lainnya";

export interface ExpenseCategory {
  kode: ExpenseCategoryCode;
  nama: string;
  urutan: number;
  aktif: boolean;
}

export interface OperatingExpense {
  id: string;
  tanggal: string;
  kategori: ExpenseCategoryCode;
  nominal: number;
  catatan: string | null;
  berulang: boolean;
  created_by_uid: string | null;
  created_at: string;
}

export interface MonthlyTarget {
  bulan: string; // selalu tanggal 1, misal "2026-09-01"
  target_omset: number;
  target_profit: number;
  catatan: string | null;
  updated_at: string;
}

// ---- Views (lihat 0004_financial_views.sql) ----

export interface VTransaction extends Transaction {
  omset: number;
  modal: number;
  biaya_transaksi: number;
  profit_kotor: number;
  terkonfirmasi: boolean;
  estimasi: boolean;
  piutang: boolean;
  retur: boolean;
}

export interface VDailySales {
  tanggal: string;
  jumlah_transaksi: number;
  omset: number;
  profit_kotor: number;
  omset_online: number;
  omset_offline: number;
  omset_estimasi: number;
  profit_estimasi: number;
  piutang: number;
  nilai_retur: number;
  jumlah_retur: number;
}

export interface VMonthlyPnl {
  bulan: string;
  omset: number;
  omset_online: number;
  omset_offline: number;
  jumlah_transaksi: number;
  piutang: number;
  omset_estimasi: number;
  profit_kotor: number;
  spend_iklan: number;
  chat_masuk: number;
  biaya_operasional: number;
  profit_bersih: number;
  target_omset: number | null;
  target_profit: number | null;
  capaian_omset_persen: number | null;
  capaian_profit_persen: number | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
      };
      daily_metrics: {
        Row: DailyMetric;
        Insert: Partial<DailyMetric>;
        Update: Partial<DailyMetric>;
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Partial<ExpenseCategory>;
        Update: Partial<ExpenseCategory>;
      };
      operating_expenses: {
        Row: OperatingExpense;
        Insert: Partial<OperatingExpense>;
        Update: Partial<OperatingExpense>;
      };
      monthly_targets: {
        Row: MonthlyTarget;
        Insert: Partial<MonthlyTarget>;
        Update: Partial<MonthlyTarget>;
      };
    };
    Views: {
      v_transactions: { Row: VTransaction };
      v_daily_sales: { Row: VDailySales };
      v_monthly_pnl: { Row: VMonthlyPnl };
    };
  };
}
