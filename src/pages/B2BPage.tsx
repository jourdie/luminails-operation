import { Check, CreditCard, Download, FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { createId, type LocalInvoice, type SalesOrder } from '../lib/localDb'
import { formatIdr } from '../lib/money'

function statusTone(status: LocalInvoice['status']) {
  if (status === 'PAID') return 'positive' as const
  if (status === 'OVERDUE' || status === 'VOID') return 'critical' as const
  if (status === 'PARTIALLY_PAID') return 'warning' as const
  return 'neutral' as const
}

export function B2BPage() {
  const { database, updateDatabase } = useLocalDatabase()
  const [selectedInvoice, setSelectedInvoice] = useState<LocalInvoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const orders = database.salesOrders.filter((order) => order.channel === 'B2B')
  const outstanding = useMemo(() => database.invoices.reduce((sum, invoice) => sum + invoice.total - database.payments.filter((payment) => payment.invoiceId === invoice.id).reduce((paid, payment) => paid + payment.amount, 0), 0), [database])

  function createInvoice(order: SalesOrder) {
    if (database.invoices.some((invoice) => invoice.orderId === order.id)) return
    const total = order.items.reduce((sum, item) => sum + item.qty * item.discountPrice, 0)
    const invoice: LocalInvoice = { id: createId('invoice'), invoiceNumber: `LUM-INV-2026-${String(database.invoices.length + 1).padStart(4, '0')}`, orderId: order.id, customer: order.customer, total, dueDate: '2026-10-17', status: 'ISSUED', customerSnapshot: { name: order.customer, address: 'Belum diisi' } }
    updateDatabase((current) => ({ ...current, invoices: [invoice, ...current.invoices], audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'INVOICE_CREATED', entity: invoice.invoiceNumber, detail: 'Customer snapshot disimpan' }, ...current.audits] }))
  }

  function recordPayment() {
    if (!selectedInvoice) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const paid = database.payments.filter((payment) => payment.invoiceId === selectedInvoice.id).reduce((sum, payment) => sum + payment.amount, 0) + amount
    const status: LocalInvoice['status'] = paid >= selectedInvoice.total ? 'PAID' : 'PARTIALLY_PAID'
    updateDatabase((current) => ({ ...current, payments: [{ id: createId('payment'), invoiceId: selectedInvoice.id, date: '2026-10-07', amount, reference: 'Local payment' }, ...current.payments], invoices: current.invoices.map((invoice) => invoice.id === selectedInvoice.id ? { ...invoice, status } : invoice), audits: [{ id: createId('audit'), date: '2026-10-07 09:00', action: 'PAYMENT_RECORDED', entity: selectedInvoice.invoiceNumber, detail: formatIdr(amount) }, ...current.audits] }))
    setPaymentAmount('')
    setSelectedInvoice(null)
  }

  async function downloadInvoice(order: SalesOrder) {
    const { downloadInvoicePdf } = await import('../lib/invoicePdf')
    await downloadInvoicePdf(order, database.skus)
  }

  return <div className="space-y-7"><PageHeader title="B2B Orders" description="Kelola order B2B, invoice snapshot, pembayaran, dan receivables dari satu alur." action={<button type="button" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Buat pesanan B2B</button>} /><section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><FileText className="h-5 w-5 text-blushDeep" /><p className="mt-5 text-sm text-stone-500">B2B orders</p><p className="mt-2 font-display text-3xl font-semibold">{orders.length}</p></div><div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><CreditCard className="h-5 w-5 text-blushDeep" /><p className="mt-5 text-sm text-stone-500">Outstanding</p><p className="mt-2 font-display text-3xl font-semibold">{formatIdr(outstanding)}</p></div><div className="rounded-2xl border border-sage bg-sage/55 p-5 shadow-panel"><Check className="h-5 w-5 text-emerald-900" /><p className="mt-5 text-sm text-emerald-950">Invoice aktif</p><p className="mt-2 font-display text-3xl font-semibold text-emerald-950">{database.invoices.length}</p></div></section><section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-6 py-4"><h2 className="font-display text-lg font-semibold">Invoice B2B</h2><p className="mt-1 text-sm text-stone-500">Customer dan item disimpan sebagai snapshot historis.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">Invoice</th><th className="px-6 py-3 font-semibold">Customer</th><th className="px-6 py-3 font-semibold">Total</th><th className="px-6 py-3 font-semibold">Outstanding</th><th className="px-6 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Aksi</th></tr></thead><tbody className="divide-y divide-stone-100">{database.invoices.map((invoice) => { const paid = database.payments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0); const order = orders.find((item) => item.id === invoice.orderId); return <tr key={invoice.id}><td className="px-6 py-4 font-semibold">{invoice.invoiceNumber}</td><td className="px-6 py-4">{invoice.customer}</td><td className="px-6 py-4">{formatIdr(invoice.total)}</td><td className="px-6 py-4">{formatIdr(Math.max(0, invoice.total - paid))}</td><td className="px-6 py-4"><StatusBadge label={invoice.status} tone={statusTone(invoice.status)} /></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2">{order && <button type="button" onClick={() => void downloadInvoice(order)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-linen"><Download className="h-3.5 w-3.5" /> PDF</button>}{invoice.status !== 'PAID' && <button type="button" onClick={() => setSelectedInvoice(invoice)} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">Catat pembayaran</button>}</div></td></tr> })}</tbody></table></div></section><section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-6 py-4"><h2 className="font-display text-lg font-semibold">Orders siap invoice</h2></div><div className="divide-y divide-stone-100">{orders.map((order) => <div key={order.id} className="flex flex-col justify-between gap-3 px-6 py-4 md:flex-row md:items-center"><div><p className="font-semibold">{order.externalOrderId}</p><p className="mt-1 text-xs text-stone-500">{order.customer} | {order.date}</p></div><button type="button" onClick={() => createInvoice(order)} disabled={database.invoices.some((invoice) => invoice.orderId === order.id)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">{database.invoices.some((invoice) => invoice.orderId === order.id) ? 'Invoice dibuat' : 'Buat invoice'}</button></div>)}</div></section>{selectedInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="w-full max-w-md rounded-2xl bg-shell p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="font-display text-xl font-semibold">Catat pembayaran</h2><p className="mt-1 text-sm text-stone-500">{selectedInvoice.invoiceNumber}</p></div><button type="button" onClick={() => setSelectedInvoice(null)} className="text-sm text-stone-500">Tutup</button></div><label className="mt-6 block text-sm font-medium">Jumlah<input min="1" type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="mt-2 block w-full rounded-lg border-stone-200 bg-shell" /></label><button type="button" onClick={recordPayment} className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white">Simpan pembayaran</button></div></div>}</div>
}
