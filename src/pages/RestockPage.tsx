import { Check, ClipboardList, Plus, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { getSupplierBalance } from '../lib/ledger'
import { createId, type Restock } from '../lib/localDb'
import { formatIdr } from '../lib/money'

function statusTone(status: Restock['status']) {
  if (status === 'RECEIVED') return 'positive' as const
  if (status === 'IN_TRANSIT' || status === 'PARTIAL') return 'warning' as const
  return 'neutral' as const
}

export function RestockPage() {
  const { database, updateDatabase } = useLocalDatabase()
  const [showCreate, setShowCreate] = useState(false)
  const [supplierId, setSupplierId] = useState(database.suppliers[0]?.id ?? '')
  const [skuId, setSkuId] = useState(database.skus[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [receivingRestock, setReceivingRestock] = useState<Restock | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})

  function createRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    const sku = database.skus.find((item) => item.id === skuId)
    if (!sku || !supplierId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return
    const restock: Restock = { id: createId('restock'), reference: `RST-202610-${String(database.restocks.length + 1).padStart(3, '0')}`, supplierId, date: '2026-10-07', status: 'DRAFT', lines: [{ skuId, qty: parsedQuantity, unitCost: sku.hpp, receivedQty: 0 }], postedAt: null, receivedAt: null }
    updateDatabase((current) => ({ ...current, restocks: [restock, ...current.restocks], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'RESTOCK_CREATED', entity: restock.reference, detail: `${parsedQuantity} unit` }, ...current.audits] }))
    setQuantity('')
    setShowCreate(false)
  }

  function postRestock(restockId: string) {
    const restock = database.restocks.find((item) => item.id === restockId)
    if (!restock || restock.status !== 'DRAFT') return
    const total = restock.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0)
    if (getSupplierBalance(database, restock.supplierId) < total) return
    updateDatabase((current) => ({ ...current, restocks: current.restocks.map((item) => item.id === restockId ? { ...item, status: 'IN_TRANSIT', postedAt: new Date().toISOString() } : item), depositMovements: [{ id: createId('deposit'), supplierId: restock.supplierId, date: restock.date, amountDelta: -total, movementType: 'RESTOCK_POSTED', source: restock.reference, createdAt: new Date().toISOString() }, ...current.depositMovements], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'RESTOCK_POSTED', entity: restock.reference, detail: `Deposit berkurang ${formatIdr(total)}` }, ...current.audits] }))
  }

  function openReceive(restock: Restock) {
    setReceivingRestock(restock)
    setReceiveQuantities(Object.fromEntries(restock.lines.map((line) => [line.skuId, '0'])))
  }

  function receiveRestock(restockId: string) {
    const restock = database.restocks.find((item) => item.id === restockId)
    if (!restock || (restock.status !== 'IN_TRANSIT' && restock.status !== 'PARTIAL')) return
    const receivedLines = restock.lines.map((line) => ({ ...line, receivedQty: Math.min(line.qty, line.receivedQty + Math.max(0, Number(receiveQuantities[line.skuId] ?? 0))) }))
    const movements = receivedLines.filter((line, index) => line.receivedQty > restock.lines[index].receivedQty).map((line, index) => ({ id: createId('movement'), skuId: line.skuId, date: '2026-10-07', qtyDelta: line.receivedQty - restock.lines[index].receivedQty, movementType: 'RESTOCK_RECEIVED' as const, source: restock.reference, unitCost: line.unitCost, createdAt: new Date().toISOString() }))
    if (movements.length === 0) return
    const nextStatus = receivedLines.every((line) => line.receivedQty >= line.qty) ? 'RECEIVED' as const : 'PARTIAL' as const
    updateDatabase((current) => ({ ...current, restocks: current.restocks.map((item) => item.id === restockId ? { ...item, status: nextStatus, lines: receivedLines, receivedAt: nextStatus === 'RECEIVED' ? new Date().toISOString() : null } : item), inventoryMovements: [...current.inventoryMovements, ...movements], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'RESTOCK_RECEIVED', entity: restock.reference, detail: `${movements.reduce((sum, movement) => sum + movement.qtyDelta, 0)} unit diterima` }, ...current.audits] }))
    setReceivingRestock(null)
  }

  return <div className="space-y-7"><PageHeader title="Restock" description="Posting restock mengurangi supplier deposit. Inventory hanya bertambah saat barang benar-benar diterima." action={<button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"><Plus className="h-4 w-4" /> Buat restock</button>} />
    <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><ClipboardList className="h-5 w-5 text-blushDeep" /><p className="mt-5 text-sm text-stone-500">Total dokumen</p><p className="mt-2 font-display text-3xl font-semibold">{database.restocks.length}</p></div><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><Truck className="h-5 w-5 text-blushDeep" /><p className="mt-5 text-sm text-stone-500">Masih dalam perjalanan</p><p className="mt-2 font-display text-3xl font-semibold">{database.restocks.filter((item) => item.status === 'IN_TRANSIT' || item.status === 'PARTIAL').length}</p></div><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><Check className="h-5 w-5 text-blushDeep" /><p className="mt-5 text-sm text-stone-500">Sudah diterima</p><p className="mt-2 font-display text-3xl font-semibold">{database.restocks.filter((item) => item.status === 'RECEIVED').length}</p></div></div>
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-6 py-4"><h2 className="font-display text-lg font-semibold">Daftar restock</h2><p className="mt-1 text-sm text-stone-500">Status posting dan penerimaan dipisahkan.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">Referensi</th><th className="px-6 py-3 font-semibold">Supplier</th><th className="px-6 py-3 font-semibold">Tanggal</th><th className="px-6 py-3 font-semibold">Isi</th><th className="px-6 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Aksi</th></tr></thead><tbody className="divide-y divide-stone-100">{database.restocks.map((restock) => { const supplier = database.suppliers.find((item) => item.id === restock.supplierId); const qty = restock.lines.reduce((sum, line) => sum + line.qty, 0); const received = restock.lines.reduce((sum, line) => sum + line.receivedQty, 0); return <tr key={restock.id}><td className="px-6 py-4 font-semibold">{restock.reference}</td><td className="px-6 py-4">{supplier?.name ?? '-'}</td><td className="px-6 py-4 text-stone-600">{restock.date}</td><td className="px-6 py-4 text-stone-600">{received} / {qty} unit</td><td className="px-6 py-4"><StatusBadge label={restock.status} tone={statusTone(restock.status)} /></td><td className="px-6 py-4 text-right">{restock.status === 'DRAFT' && <button type="button" onClick={() => postRestock(restock.id)} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">Post restock</button>}{(restock.status === 'IN_TRANSIT' || restock.status === 'PARTIAL') && <button type="button" onClick={() => openReceive(restock)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-ink hover:bg-linen">Terima barang</button>}</td></tr> })}</tbody></table></div></section>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><form onSubmit={createRestock} className="w-full max-w-md rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Buat restock</h2><p className="mt-1 text-sm text-stone-500">Dokumen dimulai sebagai draft.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-sm text-stone-500">Tutup</button></div><label className="mt-6 block text-sm font-medium">Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell">{database.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="mt-4 block text-sm font-medium">SKU<select value={skuId} onChange={(event) => setSkuId(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell">{database.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sellerSku} - {sku.productName}</option>)}</select></label><label className="mt-4 block text-sm font-medium">Jumlah<input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" /></label><button type="submit" className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white">Simpan draft</button></form></div>}
    {receivingRestock && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="w-full max-w-md rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Terima barang</h2><p className="mt-1 text-sm text-stone-500">Penerimaan boleh dilakukan sebagian.</p></div><button type="button" onClick={() => setReceivingRestock(null)} className="text-sm text-stone-500">Tutup</button></div><div className="mt-6 space-y-3">{receivingRestock.lines.map((line) => <label key={line.skuId} className="block rounded-xl bg-linen p-4 text-sm font-medium">{database.skus.find((sku) => sku.id === line.skuId)?.sellerSku}<span className="mt-1 block text-xs font-normal text-stone-500">Diterima {line.receivedQty} dari {line.qty}</span><input min="0" max={line.qty - line.receivedQty} type="number" value={receiveQuantities[line.skuId] ?? '0'} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [line.skuId]: event.target.value }))} className="mt-3 block w-full rounded-lg border-stone-200 bg-shell" /></label>)}</div><button type="button" onClick={() => receiveRestock(receivingRestock.id)} className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white">Simpan penerimaan</button></div></div>}
  </div>
}
