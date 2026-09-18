import type { ResourceConfig } from './ResourcePage';
import type { Field } from '../components/forms/RecordForm';
import { Badge } from '../components/ui/common';
import { rupiah, date } from '../lib/formatting';
export const select = (
  key: string,
  label: string,
  source: string,
  sourceLabel = 'name',
  required = true,
): Field => ({ key, label, type: 'select', source, sourceLabel, required });
export const options = (key: string, label: string, values: string[], required = true): Field => ({
  key,
  label,
  type: 'select',
  options: values.map((v) => ({ value: v, label: v })),
  required,
});
export const text = (key: string, label: string, required = true): Field => ({
  key,
  label,
  required,
});
export const num = (key: string, label: string, defaultValue = 0): Field => ({
  key,
  label,
  type: 'number',
  default: defaultValue,
});
export const day = (key: string, label: string): Field => ({
  key,
  label,
  type: 'date',
  required: true,
});
export const money = (key: string, label: string) => ({
  key,
  label,
  render: (v: unknown) => rupiah(String(v ?? 0)),
});
export const status = (key = 'status') => ({
  key,
  label: 'Status',
  render: (v: unknown) => <Badge>{String(v)}</Badge>,
});
export const resources: Record<string, ResourceConfig> = {
  products: {
    title: 'Produk & SKU',
    description: 'Master SKU untuk seluruh kanal penjualan.',
    table: 'skus',
    module: 'products',
    editable: true,
    deletable: true,
    columns: [
      { key: 'sku_code', label: 'SKU' },
      { key: 'product_name', label: 'Produk' },
      { key: 'variant_name', label: 'Varian' },
      { key: 'unit', label: 'Satuan' },
      { key: 'minimum_stock', label: 'Stok minimum' },
      { key: 'active', label: 'Aktif', render: (v) => (v ? 'Aktif' : 'Nonaktif') },
    ],
    fields: [
      select('product_id', 'Produk', 'products'),
      text('sku_code', 'Kode SKU'),
      text('variant_name', 'Varian', false),
      text('barcode', 'Barcode', false),
      { ...text('unit', 'Satuan'), default: 'pcs' },
      num('minimum_stock', 'Stok minimum', 10),
      num('safety_stock_days', 'Hari stok pengaman', 7),
      { key: 'active', label: 'Aktif', type: 'checkbox' },
    ],
  },
  'product-master': {
    title: 'Master Produk',
    description: 'Nama, merek, dan kategori produk.',
    table: 'products',
    module: 'products',
    editable: true,
    deletable: true,
    columns: [
      { key: 'name', label: 'Nama produk' },
      { key: 'category', label: 'Kategori' },
    ],
    fields: [
      text('name', 'Nama produk'),
      select('brand_id', 'Merek', 'brands'),
      text('category', 'Kategori'),
    ],
  },
  brands: {
    title: 'Merek',
    description: 'Merek produk Luminails.',
    table: 'brands',
    module: 'products',
    editable: true,
    deletable: true,
    columns: [{ key: 'name', label: 'Merek' }],
    fields: [text('name', 'Nama merek')],
  },
  suppliers: {
    title: 'Supplier',
    description: 'Kelola mitra pasokan dan estimasi waktu pengiriman.',
    table: 'suppliers',
    module: 'suppliers',
    editable: true,
    deletable: true,
    columns: [
      { key: 'name', label: 'Supplier' },
      { key: 'code', label: 'Kode' },
      { key: 'contact_name', label: 'Kontak' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'lead_time_days', label: 'Lead time (hari)' },
    ],
    fields: [
      text('name', 'Nama supplier'),
      text('code', 'Kode'),
      text('contact_name', 'Nama kontak', false),
      text('phone', 'Telepon', false),
      text('whatsapp', 'WhatsApp', false),
      num('lead_time_days', 'Lead time (hari)', 3),
      { key: 'notes', label: 'Catatan', type: 'textarea' },
      { key: 'active', label: 'Aktif', type: 'checkbox' },
    ],
  },
  costs: {
    title: 'Modal Supplier',
    description: 'Versi modal berdasarkan tanggal efektif. Riwayat transaksi tetap tersimpan.',
    table: 'supplier_cost_versions',
    module: 'suppliers',
    rpc: 'change_supplier_cost',
    deletable: true,
    action: 'edit',
    confirmation:
      'Perubahan modal akan berlaku untuk transaksi baru mulai tanggal efektif. Transaksi lama tidak akan berubah.',
    columns: [
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'cost_sku_code', label: 'SKU' },
      money('cost', 'Modal'),
      { key: 'effective_from', label: 'Berlaku mulai' },
      { key: 'created_at', label: 'Dibuat', render: (v) => date(String(v)) },
    ],
    fields: [
      select('supplier_id', 'Supplier', 'suppliers'),
      select('sku_id', 'SKU', 'skus', 'sku_code'),
      { key: 'cost', label: 'Modal per unit (IDR)', type: 'decimal', required: true },
      day('effective_from', 'Tanggal efektif'),
    ],
  },
  branches: {
    title: 'Cabang & Alamat',
    description: 'Satu pelanggan dapat memiliki banyak cabang. Invoice menyimpan salinan alamat.',
    table: 'customer_addresses',
    module: 'b2b',
    editable: true,
    deletable: true,
    columns: [
      { key: 'branch_name', label: 'Cabang' },
      { key: 'customer_name', label: 'Pelanggan' },
      { key: 'recipient', label: 'Penerima' },
      { key: 'address', label: 'Alamat' },
      { key: 'city', label: 'Kota' },
    ],
    fields: [
      select('customer_id', 'Pelanggan', 'customers'),
      text('branch_name', 'Cabang'),
      text('recipient', 'Penerima', false),
      text('phone', 'Telepon', false),
      { key: 'address', label: 'Alamat', type: 'textarea', required: true },
      text('city', 'Kota', false),
      text('province', 'Provinsi', false),
      text('postal_code', 'Kode pos', false),
    ],
  },
  accounts: {
    title: 'Akun Keuangan',
    description: 'Bank, marketplace, valuta asing, aset dibayar di muka, dan kewajiban.',
    table: 'financial_accounts',
    module: 'finance',
    editable: true,
    deletable: true,
    columns: [
      { key: 'name', label: 'Akun' },
      { key: 'account_type', label: 'Jenis' },
      { key: 'currency', label: 'Mata uang' },
    ],
    fields: [
      text('name', 'Nama akun'),
      options('account_type', 'Jenis akun', [
        'BANK',
        'MARKETPLACE_LIQUID',
        'MARKETPLACE_PENDING',
        'CASH',
        'FX_ASSET',
        'PREPAID_ASSET',
        'LIABILITY',
        'OTHER',
      ]),
      { ...text('currency', 'Mata uang'), default: 'IDR' },
    ],
  },
  snapshots: {
    title: 'Snapshot Saldo',
    description:
      'Saldo berkala per akun; tanggal historis dan kurs disimpan tanpa pembulatan di browser.',
    table: 'v_financial_snapshots',
    module: 'finance',
    rpc: 'record_finance',
    entity: 'financial_balance_snapshots',
    editable: true,
    deletable: true,
    editRpc: 'correct_financial_snapshot',
    editFields: [
      {
        key: 'amount_original_currency',
        label: 'Saldo mata uang asal',
        type: 'decimal',
        required: true,
      },
      { key: 'exchange_rate', label: 'Kurs ke IDR', type: 'decimal', required: true },
      text('notes', 'Alasan koreksi'),
    ],
    action: 'post',
    columns: [
      { key: 'snapshot_date', label: 'Tanggal' },
      { key: 'currency', label: 'Mata uang' },
      { key: 'amount_original_currency', label: 'Saldo asal' },
      { key: 'exchange_rate', label: 'Kurs' },
      money('amount_idr', 'Nilai IDR'),
    ],
    fields: [
      select('financial_account_id', 'Akun', 'financial_accounts'),
      day('snapshot_date', 'Tanggal snapshot'),
      {
        key: 'amount_original_currency',
        label: 'Saldo mata uang asal',
        type: 'decimal',
        required: true,
      },
      { ...text('currency', 'Mata uang'), default: 'IDR' },
      { key: 'exchange_rate', label: 'Kurs ke IDR', type: 'decimal', default: '1', required: true },
      text('notes', 'Catatan', false),
    ],
  },
  expenses: {
    title: 'Pengeluaran',
    description: 'Biaya operasional untuk perhitungan laba rugi.',
    table: 'expenses',
    module: 'finance',
    rpc: 'record_finance',
    entity: 'expenses',
    action: 'post',
    columns: [
      { key: 'expense_date', label: 'Tanggal' },
      { key: 'category', label: 'Kategori' },
      { key: 'description', label: 'Keterangan' },
      money('amount', 'Jumlah'),
      status(),
    ],
    fields: [
      day('expense_date', 'Tanggal'),
      options('category', 'Kategori', [
        'Ads',
        'Packaging',
        'Shipping Subsidy',
        'Software',
        'Operational',
        'Other',
      ]),
      { key: 'amount', label: 'Jumlah IDR', type: 'decimal', required: true },
      select('financial_account_id', 'Akun', 'financial_accounts', 'name', false),
      text('description', 'Keterangan'),
      text('reference', 'Referensi', false),
    ],
  },
  payments: {
    title: 'Pembayaran',
    description: 'Catat pembayaran terhadap invoice. Saldo piutang dihitung dari transaksi.',
    table: 'payments',
    module: 'finance',
    rpc: 'record_payment',
    action: 'post',
    columns: [
      { key: 'payment_date', label: 'Tanggal' },
      { key: 'invoice_number', label: 'Invoice' },
      money('amount', 'Jumlah'),
      { key: 'payment_method', label: 'Metode' },
      status(),
    ],
    fields: [
      select('invoice_id', 'Invoice', 'invoices', 'invoice_number'),
      day('payment_date', 'Tanggal bayar'),
      { key: 'amount', label: 'Jumlah IDR', type: 'decimal', required: true },
      options('payment_method', 'Metode', ['Transfer Bank', 'Tunai', 'Marketplace', 'Lainnya']),
      select('financial_account_id', 'Akun', 'financial_accounts', 'name', false),
      text('reference', 'Referensi', false),
    ],
  },
  audit: {
    title: 'Audit Log',
    description: 'Jejak perubahan, posting, dan pembalikan transaksi.',
    table: 'audit_logs',
    module: 'settings',
    columns: [
      { key: 'created_at', label: 'Waktu' },
      { key: 'action', label: 'Aksi' },
      { key: 'entity_type', label: 'Entitas' },
      { key: 'entity_id', label: 'Referensi' },
      { key: 'user_id', label: 'Pengguna' },
      {
        key: 'after_data',
        label: 'Sesudah',
        render: (v) => (
          <details>
            <summary>Lihat data</summary>
            <pre className="json-preview">{JSON.stringify(v, null, 2)}</pre>
          </details>
        ),
      },
      {
        key: 'before_data',
        label: 'Sebelum',
        render: (v) => (
          <details>
            <summary>Lihat data</summary>
            <pre className="json-preview">{JSON.stringify(v, null, 2)}</pre>
          </details>
        ),
      },
    ],
  },
  receivables: {
    title: 'Piutang',
    description: 'Tagihan aktif, pembayaran, dan jatuh tempo.',
    table: 'v_customer_receivables',
    module: 'finance',
    rpc: 'open_receivable',
    action: 'post',
    confirmation: 'Catat piutang awal hanya untuk tagihan historis yang belum ada di aplikasi.',
    columns: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'due_date', label: 'Jatuh tempo' },
      money('total', 'Tagihan'),
      money('paid', 'Dibayar'),
      money('outstanding', 'Sisa'),
      status('payment_status'),
    ],
    fields: [
      select('customer_id', 'Pelanggan', 'customers'),
      day('invoice_date', 'Tanggal tagihan awal'),
      day('due_date', 'Jatuh tempo'),
      { key: 'total', label: 'Saldo piutang awal', type: 'decimal', required: true },
      text('notes', 'Referensi historis', false),
    ],
  },
};
export function customerConfig(type: 'B2B' | 'RESELLER'): ResourceConfig {
  return {
    title: type === 'B2B' ? 'Pelanggan B2B' : 'Reseller',
    description: 'Kelola pelanggan, termin pembayaran, dan informasi kontak.',
    table: 'customers',
    module: type === 'B2B' ? 'b2b' : 'reseller',
    editable: true,
    deletable: true,
    rpc: type === 'RESELLER' ? 'save_reseller_customer' : 'save_b2b_customer',
    filters: { customer_type: type },
    columns: [
      { key: 'name', label: 'Pelanggan' },
      { key: 'contact_name', label: 'Kontak' },
      { key: 'phone', label: 'Telepon' },
      { key: 'payment_terms', label: 'Termin (hari)' },
      money('credit_limit', 'Batas kredit'),
    ],
    fields: [
      { ...options('customer_type', 'Jenis', [type]), default: type },
      text('name', 'Nama pelanggan'),
      text('contact_name', 'Kontak', false),
      text('phone', 'Telepon', false),
      text('email', 'Email', false),
      text('instagram', 'Instagram', false),
      {
        key: 'has_multiple_branches',
        label: 'Memiliki multi cabang',
        type: 'checkbox',
        default: false,
      },
      text('recipient', 'Nama penerima / PIC alamat utama', false),
      { key: 'address', label: 'Alamat utama (wajib jika tanpa multi cabang)', type: 'textarea' },
      text('city', 'Kota', false),
      text('province', 'Provinsi', false),
      text('postal_code', 'Kode pos', false),
      num('payment_terms', 'Termin (hari)', 14),
      num('credit_limit', 'Batas kredit (IDR)', 0),
      { key: 'notes', label: 'Catatan', type: 'textarea' },
      { key: 'active', label: 'Aktif', type: 'checkbox' },
    ],
  };
}
