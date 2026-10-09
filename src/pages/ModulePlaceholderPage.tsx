import { ArrowUpRight, CircleDashed } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const copy: Record<string, { title: string; description: string; next: string }> = {
  '/orders/shopee': { title: 'Shopee Orders', description: 'Import Order.all, petakan SKU, lalu siapkan fulfillment sebelum posting.', next: 'Import Order.all' },
  '/orders/manual': { title: 'Manual dan Reseller', description: 'Catat penjualan manual dan reseller dengan sumber pengiriman yang eksplisit.', next: 'Buat pesanan manual' },
  '/orders/b2b': { title: 'B2B Orders', description: 'Kelola pesanan B2B, invoice, pembayaran, dan receivables dalam satu alur.', next: 'Buat pesanan B2B' },
  '/operations/inventory': { title: 'Inventory dan SKU', description: 'Sumber kebenaran stok akan berasal dari inventory ledger, bukan stok marketplace.', next: 'Import SKU Shopee' },
  '/operations/restock': { title: 'Restock', description: 'Siapkan restock, posting kewajiban supplier, dan terima barang secara parsial.', next: 'Buat restock' },
  '/operations/supplier-deposit': { title: 'Supplier Deposit', description: 'Pantau saldo deposit supplier dan riwayat top up atau pemakaian.', next: 'Catat top up' },
  '/operations/reconciliation': { title: 'Daily Reconciliation', description: 'Bandingkan laporan upload dengan catatan manual sebelum movement diposting.', next: 'Buat rekonsiliasi' },
  '/finance/profit-loss': { title: 'Profit dan Loss', description: 'Tampilkan hasil operasi berdasarkan sales, COGS, fee settlement, dan biaya usaha.', next: 'Atur periode' },
  '/finance/business-position': { title: 'Business Position', description: 'Lihat assets, liabilities, dan net business position tanpa mencampurnya dengan profit.', next: 'Atur snapshot' },
  '/finance/expenses': { title: 'Expenses dan Liabilities', description: 'Pisahkan pengeluaran bisnis, personal, kas, bank, dan kartu kredit dengan audit trail.', next: 'Catat transaksi' },
  '/settings/users': { title: 'Users dan Permissions', description: 'Atur anggota workspace, status aktif, role, dan akses per modul.', next: 'Tambah anggota' },
  '/settings/suppliers': { title: 'Suppliers', description: 'Kelola supplier dan HPP yang berlaku untuk transaksi baru.', next: 'Tambah supplier' },
  '/settings/accounts': { title: 'Financial Accounts', description: 'Siapkan akun kas, bank, marketplace, prepaid asset, dan liabilities.', next: 'Tambah akun' },
  '/settings/invoices': { title: 'Invoice Settings', description: 'Atur identitas invoice dan konfigurasi dokumen B2B.', next: 'Atur invoice' },
  '/settings/audit-log': { title: 'Audit Log', description: 'Telusuri perubahan penting yang terjadi di workspace.', next: 'Filter audit log' },
  '/reports': { title: 'Reports', description: 'Laporan operasional akan membaca view dan RPC yang sudah dioptimalkan.', next: 'Pilih laporan' }
}

export function ModulePlaceholderPage() {
  const { pathname } = useLocation()
  const page = copy[pathname] ?? { title: 'Modul', description: 'Modul ini sedang disiapkan.', next: 'Mulai' }
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-7 md:flex-row md:items-end">
        <div><p className="text-sm font-medium text-stone-500">Luminails Ops</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{page.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{page.description}</p></div>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700">{page.next}<ArrowUpRight className="h-4 w-4" /></button>
      </div>
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-shell px-6 text-center shadow-panel">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linen"><CircleDashed className="h-7 w-7 text-blushDeep" /></div>
        <h2 className="mt-6 font-display text-xl font-semibold">Alur modul siap dibangun</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">Struktur route, permission, dan batas data sudah disiapkan agar implementasi berikutnya tetap konsisten.</p>
      </div>
    </div>
  )
}
