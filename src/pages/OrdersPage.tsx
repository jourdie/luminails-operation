import { Check, Download, FileUp, Plus, Send, Split, Truck } from 'lucide-react'
import { useMemo, useState, type ComponentProps, type FormEvent } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ImportOrderModal } from '../components/imports/ImportOrderModal'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { getSkuBalance, getSupplierBalance } from '../lib/ledger'
import { createId, type DepositMovement, type FulfillmentAllocation, type InventoryMovement, type SalesOrder } from '../lib/localDb'

type PageChannel = 'SHOPEE' | 'MANUAL' | 'B2B'
type FulfillmentSource = FulfillmentAllocation['source']
type DraftAllocation = { source: FulfillmentSource; qty: string }

const sourceToSupplier: Record<'PARTY' | 'BLUESKY', string> = { PARTY: 'supplier-party', BLUESKY: 'supplier-bluesky' }

function statusTone(status: SalesOrder['status']) {
  if (status === 'COMPLETED') return 'positive' as const
  if (status === 'SHIPPED') return 'warning' as const
  if (status === 'CANCELLED' || status === 'RETURNED') return 'critical' as const
  return 'neutral' as const
}

export function OrdersPage({ channel }: { channel: PageChannel }) {
  const { database, updateDatabase } = useLocalDatabase()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [customer, setCustomer] = useState('')
  const [skuId, setSkuId] = useState(database.skus[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [selectedSource, setSelectedSource] = useState<'INVENTORY' | 'PARTY' | 'BLUESKY'>('INVENTORY')
  const [allocationDraft, setAllocationDraft] = useState<Record<string, DraftAllocation[]>>({})
  const [showImport, setShowImport] = useState(false)
  const orders = useMemo(() => database.salesOrders.filter((order) => channel === 'MANUAL' ? order.channel === 'MANUAL' || order.channel === 'RESELLER' : order.channel === channel), [channel, database.salesOrders])
  const selectedOrder = database.salesOrders.find((order) => order.id === selectedOrderId)

  function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    const sku = database.skus.find((item) => item.id === skuId)
    if (!sku || !customer.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return
    const order: SalesOrder = { id: createId('order'), externalOrderId: `${channel === 'B2B' ? 'B2B' : 'MAN'}-202610-${String(database.salesOrders.length + 1).padStart(3, '0')}`, channel: channel === 'MANUAL' ? 'RESELLER' : channel, customer: customer.trim(), date: '2026-10-07', status: 'READY_TO_SHIP', items: [{ skuId, qty: parsedQuantity, unitPrice: sku.shopeePrice, discountPrice: sku.shopeePrice }], allocations: [] }
    updateDatabase((current) => ({ ...current, salesOrders: [order, ...current.salesOrders], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'SALES_ORDER_CREATED', entity: order.externalOrderId, detail: `${parsedQuantity} unit untuk ${order.customer}` }, ...current.audits] }))
    setCustomer('')
    setQuantity('')
    setShowCreate(false)
  }

  function postFulfillment(order: SalesOrder) {
    const allocations = order.allocations
    const bySku = new Map<string, number>()
    for (const allocation of allocations) bySku.set(allocation.skuId, (bySku.get(allocation.skuId) ?? 0) + allocation.qty)
    const allQuantitiesMatch = order.items.every((item) => (bySku.get(item.skuId) ?? 0) === item.qty)
    if (!allQuantitiesMatch || allocations.length === 0) return
    const inventoryMovements: InventoryMovement[] = []
    const depositMovements: DepositMovement[] = []
    for (const allocation of allocations) {
      if (allocation.posted) continue
      const sku = database.skus.find((item) => item.id === allocation.skuId)
      if (!sku) return
      if (allocation.source === 'INVENTORY') {
        if (getSkuBalance(database, sku.id) < allocation.qty) return
        inventoryMovements.push({ id: createId('movement'), skuId: sku.id, date: order.date, qtyDelta: -allocation.qty, movementType: 'SALE' as const, source: order.externalOrderId, unitCost: sku.hpp, createdAt: new Date().toISOString() })
      } else {
        const supplierId = sourceToSupplier[allocation.source]
        const total = allocation.qty * sku.hpp
        if (getSupplierBalance(database, supplierId) < total) return
        depositMovements.push({ id: createId('deposit'), supplierId, date: order.date, amountDelta: -total, movementType: 'DROPSHIP_USAGE' as const, source: order.externalOrderId, createdAt: new Date().toISOString() })
      }
    }
    updateDatabase((current) => ({ ...current, salesOrders: current.salesOrders.map((item) => item.id === order.id ? { ...item, status: 'COMPLETED', allocations: item.allocations.map((allocation) => ({ ...allocation, posted: true })) } : item), inventoryMovements: [...current.inventoryMovements, ...inventoryMovements], depositMovements: [...current.depositMovements, ...depositMovements], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'FULFILLMENT_POSTED', entity: order.externalOrderId, detail: 'Inventory dan supplier source berhasil diposting' }, ...current.audits] }))
    setSelectedOrderId(null)
  }

  function assignOrderSource(order: SalesOrder) {
    const newAllocations: FulfillmentAllocation[] = order.items.map((item) => ({ skuId: item.skuId, source: selectedSource, qty: item.qty, posted: false }))
    updateDatabase((current) => ({ ...current, salesOrders: current.salesOrders.map((item) => item.id === order.id ? { ...item, allocations: newAllocations, status: 'SHIPPED' } : item), audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'FULFILLMENT_ALLOCATED', entity: order.externalOrderId, detail: `Sumber ${selectedSource} dipilih` }, ...current.audits] }))
    setAllocationDraft(Object.fromEntries(order.items.map((item) => [item.skuId, [{ source: selectedSource, qty: String(item.qty) }]])))
    setSelectedOrderId(order.id)
  }

  function saveAllocation(order: SalesOrder) {
    const allocations: FulfillmentAllocation[] = []
    for (const item of order.items) {
      const lines = allocationDraft[item.skuId] ?? []
      const total = lines.reduce((sum, line) => sum + Number(line.qty), 0)
      if (total !== item.qty || lines.some((line) => !Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0)) return
      allocations.push(...lines.map((line) => ({ skuId: item.skuId, source: line.source, qty: Number(line.qty), posted: false })))
    }
    updateDatabase((current) => ({ ...current, salesOrders: current.salesOrders.map((item) => item.id === order.id ? { ...item, allocations } : item), audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'FULFILLMENT_ALLOCATION_UPDATED', entity: order.externalOrderId, detail: 'Split fulfillment disimpan' }, ...current.audits] }))
  }

  function updateDraft(skuId: string, index: number, field: keyof DraftAllocation, value: string) {
    setAllocationDraft((current) => ({ ...current, [skuId]: (current[skuId] ?? []).map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }))
  }

  function addDraftSource(skuId: string) {
    setAllocationDraft((current) => ({ ...current, [skuId]: [...(current[skuId] ?? []), { source: 'PARTY', qty: '0' }] }))
  }

  async function downloadInvoice(order: SalesOrder) {
    const { downloadInvoicePdf } = await import('../lib/invoicePdf')
    await downloadInvoicePdf(order, database.skus)
  }

  function confirmImport(result: Parameters<ComponentProps<typeof ImportOrderModal>['onConfirm']>[0]) {
    const grouped = new Map<string, SalesOrder>()
    let skipped = 0
    for (const row of result.mapped) {
      const sku = database.skus.find((item) => item.sellerSku === row.sellerSku)
      if (!sku) {
        skipped += 1
        continue
      }
      const existing = grouped.get(row.externalOrderId) ?? database.salesOrders.find((order) => order.channel === 'SHOPEE' && order.externalOrderId === row.externalOrderId)
      const item = { skuId: sku.id, qty: row.qty, unitPrice: sku.shopeePrice, discountPrice: sku.shopeePrice }
      if (existing) {
        grouped.set(row.externalOrderId, { ...existing, date: row.date, status: row.status.toLowerCase().includes('ship') ? 'SHIPPED' : 'READY_TO_SHIP', items: [...existing.items.filter((line) => line.skuId !== sku.id), item] })
      } else {
        grouped.set(row.externalOrderId, { id: createId('order'), externalOrderId: row.externalOrderId, channel: 'SHOPEE', customer: row.customer || 'Shopee customer', date: row.date, status: row.status.toLowerCase().includes('ship') ? 'SHIPPED' : 'READY_TO_SHIP', items: [item], allocations: [] })
      }
    }
    const importedOrders = [...grouped.values()]
    updateDatabase((current) => ({ ...current, salesOrders: [...current.salesOrders.filter((order) => !importedOrders.some((imported) => imported.externalOrderId === order.externalOrderId)), ...importedOrders], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'SHOPEE_ORDER_IMPORT_CONFIRMED', entity: 'import_batch_local', detail: `${importedOrders.length} order upserted, ${skipped} SKU belum dipetakan` }, ...current.audits] }))
    setShowImport(false)
  }

  const title = channel === 'SHOPEE' ? 'Shopee Orders' : channel === 'B2B' ? 'B2B Orders' : 'Manual dan Reseller'
  const description = channel === 'SHOPEE' ? 'Order.all menjadi sumber operasional. Upload, mapping, alokasi fulfillment, lalu posting.' : channel === 'B2B' ? 'Kelola pesanan B2B dan siapkan invoice dari unified sales engine.' : 'Catat penjualan manual dan reseller dengan sumber pengiriman yang eksplisit.'
  return <div className="space-y-7"><PageHeader title={title} description={description} action={<div className="flex gap-2">{channel === 'SHOPEE' && <button type="button" onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-shell px-4 py-3 text-sm font-semibold text-ink hover:bg-linen"><FileUp className="h-4 w-4" /> Upload Order.all</button>}<button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"><Plus className="h-4 w-4" /> {channel === 'SHOPEE' ? 'Import order' : 'Buat pesanan'}</button></div>} />
    <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><p className="text-sm text-stone-500">Total order</p><p className="mt-4 font-display text-3xl font-semibold">{orders.length}</p><p className="mt-2 text-xs text-stone-500">Dalam local database</p></div><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><p className="text-sm text-stone-500">Perlu fulfillment</p><p className="mt-4 font-display text-3xl font-semibold">{orders.filter((order) => order.status === 'SHIPPED' && order.allocations.length === 0).length}</p><p className="mt-2 text-xs text-stone-500">Belum ada sumber</p></div><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><p className="text-sm text-stone-500">Sudah diposting</p><p className="mt-4 font-display text-3xl font-semibold">{orders.filter((order) => order.allocations.some((allocation) => allocation.posted)).length}</p><p className="mt-2 text-xs text-stone-500">Movement terlindungi audit</p></div></div>
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-6 py-4"><h2 className="font-display text-lg font-semibold">Order queue</h2><p className="mt-1 text-sm text-stone-500">Sumber pengiriman wajib sama dengan jumlah barang sebelum posting.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">Order</th><th className="px-6 py-3 font-semibold">Customer</th><th className="px-6 py-3 font-semibold">Tanggal</th><th className="px-6 py-3 font-semibold">Item</th><th className="px-6 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Aksi</th></tr></thead><tbody className="divide-y divide-stone-100">{orders.map((order) => { const quantityTotal = order.items.reduce((sum, item) => sum + item.qty, 0); const posted = order.allocations.length > 0 && order.allocations.every((allocation) => allocation.posted); return <tr key={order.id}><td className="px-6 py-4 font-semibold">{order.externalOrderId}</td><td className="px-6 py-4">{order.customer}</td><td className="px-6 py-4 text-stone-600">{order.date}</td><td className="px-6 py-4 text-stone-600">{quantityTotal} unit</td><td className="px-6 py-4"><StatusBadge label={posted ? 'POSTED' : order.status} tone={posted ? 'positive' : statusTone(order.status)} /></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2">{channel === 'B2B' && <button type="button" onClick={() => void downloadInvoice(order)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-linen"><Download className="h-3.5 w-3.5" /> PDF</button>}{!posted && order.status === 'SHIPPED' && order.allocations.length === 0 && <button type="button" onClick={() => assignOrderSource(order)} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"><Split className="h-3.5 w-3.5" /> Atur sumber</button>}{!posted && order.allocations.length > 0 && <button type="button" onClick={() => postFulfillment(order)} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" /> Post fulfillment</button>}</div></td></tr> })}</tbody></table></div></section>
    {selectedOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="w-full max-w-lg rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Fulfillment {selectedOrder.externalOrderId}</h2><p className="mt-1 text-sm text-stone-500">Total sumber harus sama dengan jumlah terjual. Split per SKU didukung.</p></div><button type="button" onClick={() => setSelectedOrderId(null)} className="text-sm text-stone-500">Tutup</button></div><div className="mt-6 space-y-3">{selectedOrder.items.map((item) => { const sku = database.skus.find((entry) => entry.id === item.skuId); const drafts = allocationDraft[item.skuId] ?? selectedOrder.allocations.filter((entry) => entry.skuId === item.skuId).map((entry) => ({ source: entry.source, qty: String(entry.qty) })); return <div key={item.skuId} className="rounded-xl bg-linen p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{sku?.sellerSku}</p><p className="mt-1 text-xs text-stone-500">Terjual {item.qty} unit</p></div><button type="button" onClick={() => addDraftSource(item.skuId)} className="text-xs font-semibold text-blushDeep">Tambah sumber</button></div><div className="mt-3 space-y-2">{drafts.map((line, index) => <div key={`${item.skuId}-${index}`} className="grid grid-cols-[1fr_90px] gap-2"><select value={line.source} onChange={(event) => updateDraft(item.skuId, index, 'source', event.target.value)} className="rounded-lg border-stone-200 bg-shell text-xs"><option value="INVENTORY">Inventory</option><option value="PARTY">PARTY</option><option value="BLUESKY">Bluesky</option></select><input min="0" type="number" value={line.qty} onChange={(event) => updateDraft(item.skuId, index, 'qty', event.target.value)} className="rounded-lg border-stone-200 bg-shell text-xs" /></div>)}</div></div> })}</div><div className="mt-5 flex items-center gap-2 rounded-lg border border-sage bg-sage/45 p-3 text-xs text-emerald-950"><Truck className="h-4 w-4" /> Allocation tersimpan dapat diposting sebagai satu transaksi.</div><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => saveAllocation(selectedOrder)} className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-semibold text-ink hover:bg-linen">Simpan alokasi</button><button type="button" onClick={() => postFulfillment(selectedOrder)} className="rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white"><Check className="mr-2 inline h-4 w-4" /> Post fulfillment</button></div></div></div>}
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><form onSubmit={createOrder} className="w-full max-w-md rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Buat pesanan</h2><p className="mt-1 text-sm text-stone-500">Order masuk sebagai ready to ship.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-sm text-stone-500">Tutup</button></div><label className="mt-6 block text-sm font-medium">Customer<input required value={customer} onChange={(event) => setCustomer(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" placeholder="Nama customer" /></label><label className="mt-4 block text-sm font-medium">SKU<select value={skuId} onChange={(event) => setSkuId(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell">{database.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sellerSku} - {sku.productName}</option>)}</select></label><label className="mt-4 block text-sm font-medium">Jumlah<input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" /></label><label className="mt-4 block text-sm font-medium">Sumber awal<select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value as typeof selectedSource)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell"><option value="INVENTORY">Inventory</option><option value="PARTY">PARTY</option><option value="BLUESKY">Bluesky</option></select></label><button type="submit" className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white">Simpan pesanan</button></form></div>}
    {showImport && <ImportOrderModal onClose={() => setShowImport(false)} onConfirm={confirmImport} />}
    <p className="text-xs text-stone-500">Harga HPP pada posting fulfillment memakai snapshot HPP SKU saat transaksi. Riwayat tidak berubah jika HPP berikutnya berubah.</p>
  </div>
}
