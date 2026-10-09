import { Download, FileSpreadsheet, Plus, SlidersHorizontal, Upload } from 'lucide-react'
import { useMemo, useState, type ComponentProps, type FormEvent } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ImportSkuModal } from '../components/imports/ImportSkuModal'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { inventoryBalance, inventoryValue } from '../lib/ledger'
import { createId } from '../lib/localDb'
import { formatCompactIdr, formatIdr } from '../lib/money'

export function InventoryPage() {
  const { database, updateDatabase } = useLocalDatabase()
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [skuId, setSkuId] = useState(database.skus[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT')
  const [showImport, setShowImport] = useState(false)
  const balances = useMemo(() => new Map(database.skus.map((sku) => [sku.id, inventoryBalance(database.inventoryMovements, sku.id)])), [database])
  const lowStock = database.skus.filter((sku) => (balances.get(sku.id) ?? 0) <= sku.minimumStock)

  function recordAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    if (!skuId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return
    const sku = database.skus.find((item) => item.id === skuId)
    if (!sku) return
    updateDatabase((current) => ({
      ...current,
      inventoryMovements: [...current.inventoryMovements, { id: createId('movement'), skuId, date: '2026-10-07', qtyDelta: direction === 'IN' ? parsedQuantity : -parsedQuantity, movementType: 'ADJUSTMENT', source: 'Manual adjustment', unitCost: sku.hpp, createdAt: new Date().toISOString() }],
      audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'STOCK_ADJUSTMENT', entity: sku.sellerSku, detail: `${direction === 'IN' ? 'Tambah' : 'Kurangi'} ${parsedQuantity} unit` }, ...current.audits]
    }))
    setQuantity('')
    setShowAdjustment(false)
  }

  async function downloadTemplate() {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('SKU and Inventory')
    worksheet.addRow(['Shopee Product ID', 'Shopee Variation ID', 'Seller SKU', 'Parent SKU', 'Product Name', 'Variation Name', 'Shopee Price', 'Shopee Stock Reference', 'HPP', 'Opening Actual Stock', 'Default Supplier', 'Minimum Stock', 'Safety Stock Days'])
    database.skus.forEach((sku) => worksheet.addRow(['', sku.shopeeVariationId, sku.sellerSku, sku.parentSku, sku.productName, sku.variationName, sku.shopeePrice, 'Tidak digunakan untuk stok aktual.', sku.hpp, sku.openingStock, database.suppliers.find((supplier) => supplier.id === sku.supplierId)?.name ?? '', sku.minimumStock, sku.safetyStockDays]))
    worksheet.getRow(1).font = { bold: true }
    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer]))
    const link = document.createElement('a')
    link.href = url
    link.download = 'luminails-sku-inventory-template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  function confirmImport(rows: Parameters<ComponentProps<typeof ImportSkuModal>['onConfirm']>[0]) {
    updateDatabase((current) => {
      const nextSkus = [...current.skus]
      const nextCostVersions = [...current.costVersions]
      const nextMovements = [...current.inventoryMovements]
      for (const row of rows) {
        const supplier = current.suppliers.find((item) => item.name.toLowerCase() === row.supplierName.toLowerCase()) ?? current.suppliers[0]
        const existingIndex = nextSkus.findIndex((sku) => sku.sellerSku === row.sellerSku)
        const nextSku = { id: existingIndex >= 0 ? nextSkus[existingIndex].id : createId('sku'), sellerSku: row.sellerSku, parentSku: row.sellerSku.split('-').slice(0, -1).join('-'), productName: row.productName, variationName: row.variationName, shopeeVariationId: row.shopeeVariationId, shopeePrice: row.shopeePrice, hpp: row.hpp, openingStock: row.openingStock, supplierId: supplier?.id ?? '', minimumStock: row.minimumStock, safetyStockDays: row.safetyStockDays }
        if (existingIndex >= 0) {
          const previous = nextSkus[existingIndex]
          if (previous.hpp !== row.hpp) {
            nextCostVersions.forEach((version, index) => { if (version.skuId === previous.id && version.effectiveUntil === null) nextCostVersions[index] = { ...version, effectiveUntil: '2026-10-06' } })
            nextCostVersions.push({ id: createId('cost'), skuId: previous.id, cost: row.hpp, effectiveFrom: '2026-10-07', effectiveUntil: null, createdAt: new Date().toISOString() })
          }
          nextSkus[existingIndex] = nextSku
        }
        else {
          nextSkus.push(nextSku)
          if (row.openingStock > 0) nextMovements.push({ id: createId('movement'), skuId: nextSku.id, date: '2026-10-07', qtyDelta: row.openingStock, movementType: 'OPENING_BALANCE', source: 'SKU template opening stock', unitCost: row.hpp, createdAt: new Date().toISOString() })
        }
      }
      return { ...current, skus: nextSkus, costVersions: nextCostVersions, inventoryMovements: nextMovements, audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'SKU_IMPORT_CONFIRMED', entity: 'sku_template_local', detail: `${rows.length} SKU upserted with HPP versioning` }, ...current.audits] }
    })
    setShowImport(false)
  }

  return (
    <div className="space-y-7">
      <PageHeader title="Inventory dan SKU" description="Kelola master SKU dan lihat stok aktual dari inventory ledger. Shopee stock hanya referensi, bukan stok aktual." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-shell px-4 py-3 text-sm font-semibold text-ink hover:bg-linen"><Download className="h-4 w-4" /> Template SKU</button><button type="button" onClick={() => setShowAdjustment(true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"><Plus className="h-4 w-4" /> Penyesuaian stok</button></div>} />

      <div className="rounded-xl border border-amber bg-amber/55 px-4 py-3 text-sm text-amber-950"><strong>Catatan:</strong> Shopee Stock Reference tidak digunakan untuk stok aktual.</div>

      <section className="grid gap-4 md:grid-cols-3">
        {[['Nilai inventory', formatCompactIdr(inventoryValue(database.inventoryMovements, database.skus)), 'Moving weighted average'], ['Total SKU', String(database.skus.length), 'SKU aktif di workspace'], ['Perlu reorder', String(lowStock.length), 'Di bawah minimum stock']].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><p className="text-sm text-stone-500">{label}</p><p className="mt-4 font-display text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-stone-500">{detail}</p></div>)}
      </section>

      {database.skus.length === 0 ? <EmptyState title="Belum ada SKU" description="Import SKU Shopee atau tambahkan SKU baru untuk mulai membentuk inventory ledger." /> : <section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="flex flex-col justify-between gap-3 border-b border-stone-100 px-5 py-4 md:flex-row md:items-center md:px-6"><div><h2 className="font-display text-lg font-semibold">SKU master</h2><p className="mt-1 text-sm text-stone-500">{database.skus.length} SKU dengan saldo aktual terhitung.</p></div><div className="flex gap-2"><button type="button" onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-linen"><Upload className="h-3.5 w-3.5" /> Upload template</button><button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-linen"><FileSpreadsheet className="h-3.5 w-3.5" /> Download</button></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">SKU</th><th className="px-6 py-3 font-semibold">Produk</th><th className="px-6 py-3 font-semibold">Stok aktual</th><th className="px-6 py-3 font-semibold">HPP</th><th className="px-6 py-3 font-semibold">Supplier</th><th className="px-6 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-stone-100">{database.skus.map((sku) => { const balance = balances.get(sku.id) ?? 0; const supplier = database.suppliers.find((item) => item.id === sku.supplierId); return <tr key={sku.id} className="hover:bg-linen/70"><td className="whitespace-nowrap px-6 py-4 font-semibold text-ink">{sku.sellerSku}</td><td className="px-6 py-4"><span className="block font-medium">{sku.productName}</span><span className="mt-1 block text-xs text-stone-500">{sku.variationName}</span></td><td className="px-6 py-4"><span className="font-semibold">{balance}</span><span className="ml-2 text-xs text-stone-500">unit</span></td><td className="whitespace-nowrap px-6 py-4 text-stone-700">{formatIdr(sku.hpp)}</td><td className="px-6 py-4 text-stone-700">{supplier?.name ?? 'Belum dipetakan'}</td><td className="px-6 py-4">{balance <= sku.minimumStock ? <StatusBadge label="Perlu reorder" tone="warning" /> : <StatusBadge label="Aman" tone="positive" />}</td></tr> })}</tbody></table></div></section>}

      {showAdjustment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><form onSubmit={recordAdjustment} className="w-full max-w-md rounded-2xl border border-stone-200 bg-shell p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="font-display text-xl font-semibold">Penyesuaian stok</h2><p className="mt-1 text-sm text-stone-500">Movement akan masuk ke ledger dan audit log.</p></div><button type="button" onClick={() => setShowAdjustment(false)} className="text-sm text-stone-500">Tutup</button></div><label className="mt-6 block text-sm font-medium">SKU<select value={skuId} onChange={(event) => setSkuId(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell">{database.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sellerSku} - {sku.productName}</option>)}</select></label><label className="mt-4 block text-sm font-medium">Arah<select value={direction} onChange={(event) => setDirection(event.target.value as 'IN' | 'OUT')} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell"><option value="OUT">Kurangi stok</option><option value="IN">Tambah stok</option></select></label><label className="mt-4 block text-sm font-medium">Jumlah<input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" /></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowAdjustment(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-linen">Batal</button><button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Simpan movement</button></div></form></div>}
      {showImport && <ImportSkuModal onClose={() => setShowImport(false)} onConfirm={confirmImport} />}

      <div className="flex items-center gap-2 text-xs text-stone-500"><SlidersHorizontal className="h-3.5 w-3.5" /> Semua saldo dihitung dari inventory movements, bukan dari field stok yang bisa diedit.</div>
    </div>
  )
}
