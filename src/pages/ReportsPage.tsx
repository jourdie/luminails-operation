import { BarChart3, Download, FileSpreadsheet, LineChart } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { inventoryBalance, supplierDepositBalance } from '../lib/ledger'

type ReportKind = 'inventory' | 'supplier' | 'sales'
const reports: Array<{ kind: ReportKind; title: string; description: string; icon: typeof BarChart3 }> = [
  { kind: 'inventory', title: 'Inventory balance', description: 'Saldo SKU, minimum stock, dan nilai inventory.', icon: BarChart3 },
  { kind: 'supplier', title: 'Supplier runway', description: 'Saldo deposit supplier dan estimasi kebutuhan restock.', icon: LineChart },
  { kind: 'sales', title: 'Sales profit', description: 'Sales, COGS, fulfillment source, dan profit per channel.', icon: FileSpreadsheet }
]

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const { database } = useLocalDatabase()
  const exportReport = (kind: ReportKind) => {
    if (kind === 'inventory') downloadCsv('luminails-inventory-balance.csv', database.skus.map((sku) => ({ seller_sku: sku.sellerSku, product: sku.productName, variation: sku.variationName, balance: inventoryBalance(database.inventoryMovements, sku.id), minimum_stock: sku.minimumStock, hpp: sku.hpp, inventory_value: inventoryBalance(database.inventoryMovements, sku.id) * sku.hpp })))
    if (kind === 'supplier') downloadCsv('luminails-supplier-runway.csv', database.suppliers.map((supplier) => ({ supplier: supplier.name, code: supplier.code, deposit_balance: supplierDepositBalance(database.depositMovements, supplier.id), ledger_entries: database.depositMovements.filter((movement) => movement.supplierId === supplier.id).length })))
    if (kind === 'sales') downloadCsv('luminails-sales-profit.csv', database.salesOrders.map((order) => { const sales = order.items.reduce((sum, item) => sum + item.qty * item.discountPrice, 0); const cogs = order.items.reduce((sum, item) => sum + item.qty * (database.skus.find((sku) => sku.id === item.skuId)?.hpp ?? 0), 0); return { order_id: order.externalOrderId, channel: order.channel, date: order.date, customer: order.customer, sales, cogs, gross_profit: sales - cogs, status: order.status } }))
  }

  return <div className="space-y-7"><PageHeader title="Reports" description="Ekspor laporan operasional dari data local workspace. Production akan mengganti sumbernya dengan view atau RPC Supabase." action={<button type="button" onClick={() => reports.forEach((report) => exportReport(report.kind))} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-shell px-4 py-3 text-sm font-semibold text-ink"><Download className="h-4 w-4" /> Export semua CSV</button>} /><div className="grid gap-4 md:grid-cols-3">{reports.map(({ kind, title, description, icon: Icon }) => <div key={kind} className="rounded-2xl border border-stone-200 bg-shell p-6 shadow-panel"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blush/35"><Icon className="h-5 w-5 text-blushDeep" /></div><h2 className="mt-6 font-display text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{description}</p><button type="button" onClick={() => exportReport(kind)} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-blushDeep"><Download className="h-3.5 w-3.5" /> Download CSV</button></div>)}</div></div>
}
