import { ArrowDownRight, ArrowUpRight, Plus, WalletCards } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { getSupplierBalance } from '../lib/ledger'
import { createId } from '../lib/localDb'
import { formatCompactIdr, formatIdr } from '../lib/money'

export function SupplierDepositPage() {
  const { database, updateDatabase } = useLocalDatabase()
  const [showTopUp, setShowTopUp] = useState(false)
  const [supplierId, setSupplierId] = useState(database.suppliers[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const balances = database.suppliers.map((supplier) => ({ supplier, balance: getSupplierBalance(database, supplier.id) }))

  function submitTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!supplierId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return
    updateDatabase((current) => ({ ...current, depositMovements: [{ id: createId('deposit'), supplierId, date: '2026-10-07', amountDelta: parsedAmount, movementType: 'TOP_UP', source: 'Manual top up', createdAt: new Date().toISOString() }, ...current.depositMovements], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'SUPPLIER_DEPOSIT_TOP_UP', entity: supplierId, detail: formatIdr(parsedAmount) }, ...current.audits] }))
    setAmount('')
    setShowTopUp(false)
  }

  return <div className="space-y-7"><PageHeader title="Supplier Deposit" description="Pantau saldo supplier dropship dari ledger deposit. Pemakaian dropship mengurangi deposit, bukan inventory lokal." action={<button type="button" onClick={() => setShowTopUp(true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"><Plus className="h-4 w-4" /> Catat top up</button>} />
    <section className="grid gap-4 md:grid-cols-2">{balances.map(({ supplier, balance }) => <div key={supplier.id} className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-blush/35 p-2.5"><WalletCards className="h-5 w-5 text-blushDeep" /></div><div><p className="font-display text-lg font-semibold">{supplier.name}</p><p className="text-xs text-stone-500">Saldo deposit supplier</p></div></div><StatusBadge label={balance < 3000000 ? 'Runway pendek' : 'Aman'} tone={balance < 3000000 ? 'warning' : 'positive'} /></div><p className="mt-7 font-display text-3xl font-semibold">{formatCompactIdr(balance)}</p><div className="mt-3 flex items-center gap-2 text-xs text-stone-500"><ArrowDownRight className="h-4 w-4 text-blushDeep" /> Berkurang saat dropship atau restock diposting</div></div>)}</section>
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-6 py-4"><h2 className="font-display text-lg font-semibold">Riwayat deposit</h2><p className="mt-1 text-sm text-stone-500">Setiap perubahan saldo menyimpan sumber dan waktu.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">Tanggal</th><th className="px-6 py-3 font-semibold">Supplier</th><th className="px-6 py-3 font-semibold">Jenis</th><th className="px-6 py-3 font-semibold">Sumber</th><th className="px-6 py-3 text-right font-semibold">Perubahan</th></tr></thead><tbody className="divide-y divide-stone-100">{database.depositMovements.map((movement) => { const supplier = database.suppliers.find((item) => item.id === movement.supplierId); const positive = movement.amountDelta >= 0; return <tr key={movement.id}><td className="px-6 py-4 text-stone-600">{movement.date}</td><td className="px-6 py-4 font-medium">{supplier?.name ?? '-'}</td><td className="px-6 py-4 text-stone-600">{movement.movementType}</td><td className="px-6 py-4 text-stone-600">{movement.source}</td><td className={`px-6 py-4 text-right font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}><span className="inline-flex items-center gap-1">{positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{formatIdr(Math.abs(movement.amountDelta))}</span></td></tr> })}</tbody></table></div></section>
    {showTopUp && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><form onSubmit={submitTopUp} className="w-full max-w-md rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Top up supplier deposit</h2><p className="mt-1 text-sm text-stone-500">Catatan ini hanya untuk preview lokal.</p></div><button type="button" onClick={() => setShowTopUp(false)} className="text-sm text-stone-500">Tutup</button></div><label className="mt-6 block text-sm font-medium">Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell">{database.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="mt-4 block text-sm font-medium">Jumlah<input required min="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" /></label><button type="submit" className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white">Simpan top up</button></form></div>}
  </div>
}
