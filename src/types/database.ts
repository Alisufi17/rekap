// Ditulis tangan mengikuti supabase/migrations/. Kalau schema berubah, cek
// migrasi terbaru dan sesuaikan di sini — atau generate ulang dengan:
//   npx supabase gen types typescript --project-id ayxmrlecjqmhsoirrost > src/types/database.ts
// (perlu Supabase CLI + login; sampai itu dipasang, tipe di bawah adalah sumbernya)
//
// PENTING: semua bentuk row di bawah pakai `type X = {...}`, BUKAN
// `interface X {...}`. Interface tidak punya index signature tersirat,
// sehingga gagal dicocokkan ke `Record<string, unknown>` yang dipakai
// @supabase/postgrest-js secara internal untuk menurunkan tipe
// .insert()/.update()/.upsert() — akibatnya semua tipe itu diam-diam jatuh
// ke `never` tanpa pesan error yang jelas. `type` alias (object literal)
// tidak kena masalah ini.

export type UserRole = "admin" | "staff" | "packing";
export type TxChannel = "online" | "offline";
export type TxStatusOnline = "proses" | "selesai" | "rts";
export type TxStatusOffline = "lunas" | "belum";
export type TxStatus = TxStatusOnline | TxStatusOffline;

export type Profile = {
  id: string;
  email: string | null;
  nama: string | null;
  role: UserRole;
  created_at: string;
};

export type Product = {
  id: string;
  nama: string;
  hpp: number;
  stok: number;
};

export type Transaction = {
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
  // Sudah dikemas & dikirim secara fisik atau belum — terpisah dari status
  // pembayaran/konfirmasi (lihat 0010_dikemas_dan_alert_rts.sql). Cuma
  // relevan untuk channel "online"; offline diserahkan langsung ke pembeli.
  dikemas: boolean;
  created_at: string;
};

export type DailyMetric = {
  tanggal: string;
  spend_iklan: number;
  chat_masuk: number;
};

export type ExpenseCategoryCode =
  | "packing"
  | "ongkir_in"
  | "gaji"
  | "listrik"
  | "sewa"
  | "transport"
  | "platform"
  | "topup_iklan"
  | "lainnya";

export type ExpenseCategory = {
  kode: ExpenseCategoryCode;
  nama: string;
  urutan: number;
  aktif: boolean;
};

export type OperatingExpense = {
  id: string;
  tanggal: string;
  kategori: ExpenseCategoryCode;
  nominal: number;
  catatan: string | null;
  berulang: boolean;
  created_by_uid: string | null;
  created_at: string;
};

export type MonthlyTarget = {
  bulan: string; // selalu tanggal 1, misal "2026-09-01"
  target_omset: number;
  target_profit: number;
  catatan: string | null;
  updated_at: string;
};

// Log kas masuk dari pencairan dana platform pengantaran (mis. "Mengantar").
// Sengaja cuma pencatatan sederhana, bukan rekonsiliasi ke omset tercatat.
export type PencairanDana = {
  id: string;
  tanggal: string;
  sumber: string;
  nominal: number;
  catatan: string | null;
  created_by_uid: string | null;
  created_at: string;
};

// ---- Views (lihat 0004_financial_views.sql) ----

export type VTransaction = Transaction & {
  omset: number;
  modal: number;
  biaya_transaksi: number;
  profit_kotor: number;
  terkonfirmasi: boolean;
  estimasi: boolean;
  piutang: boolean;
  retur: boolean;
};

// Khusus role "packing" (Hansen) — lihat 0011_role_packing.sql. Sengaja
// TIDAK ADA hpp/modal/profit_kotor di sini, cuma harga per transaksi untuk
// dicocokkan ke resi. Jangan tambah kolom uang agregat ke tipe ini.
export type VPackingQueue = {
  id: string;
  tanggal: string;
  customer: string;
  customer_phone: string | null;
  produk_nama: string;
  qty: number;
  harga: number;
  total_harga: number;
  status: TxStatus;
  dikemas: boolean;
  catatan: string | null;
  created_at: string;
};

export type VDailySales = {
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
};

export type VMonthlyPnl = {
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
  jumlah_transaksi_semua: number;
  biaya_packing_bahan: number;
  biaya_packing_hansen: number;
  biaya_packing_total: number;
};

// `Relationships` dan `Functions` di bawah wajib ada persis dengan nama field
// ini — itu bagian dari GenericTable/GenericSchema yang dipakai internal oleh
// @supabase/postgrest-js untuk menurunkan tipe .insert()/.update()/.rpc().
type NoRelationships = { Relationships: never[] };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      } & NoRelationships;
      products: {
        Row: Product;
        Insert: Partial<Product>;
        Update: Partial<Product>;
      } & NoRelationships;
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
      } & NoRelationships;
      daily_metrics: {
        Row: DailyMetric;
        Insert: Partial<DailyMetric>;
        Update: Partial<DailyMetric>;
      } & NoRelationships;
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Partial<ExpenseCategory>;
        Update: Partial<ExpenseCategory>;
      } & NoRelationships;
      operating_expenses: {
        Row: OperatingExpense;
        Insert: Partial<OperatingExpense>;
        Update: Partial<OperatingExpense>;
      } & NoRelationships;
      monthly_targets: {
        Row: MonthlyTarget;
        Insert: Partial<MonthlyTarget>;
        Update: Partial<MonthlyTarget>;
      } & NoRelationships;
      pencairan_dana: {
        Row: PencairanDana;
        Insert: Partial<PencairanDana>;
        Update: Partial<PencairanDana>;
      } & NoRelationships;
    };
    Views: {
      v_transactions: { Row: VTransaction } & NoRelationships;
      v_daily_sales: { Row: VDailySales } & NoRelationships;
      v_monthly_pnl: { Row: VMonthlyPnl } & NoRelationships;
      v_packing_queue: { Row: VPackingQueue } & NoRelationships;
    };
    Functions: {
      salin_biaya_berulang: {
        Args: { p_bulan: string };
        Returns: number;
      };
      mark_dikemas: {
        Args: { p_id: string; p_dikemas: boolean };
        Returns: undefined;
      };
    };
  };
};
