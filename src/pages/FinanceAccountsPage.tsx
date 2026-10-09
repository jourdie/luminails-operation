import { ArrowRight, Building2, CreditCard, Landmark, Package, RefreshCw, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CutoffDatePicker } from '../components/ui/CutoffDatePicker'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useCutoffDate } from '../hooks/useCutoffDate'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { formatDateId, isOnOrBefore } from '../lib/date'
import { financialAccountBalance, type FinancialAccount } from '../lib/localDb'
import { inventoryValue } from '../lib/ledger'
import { formatCompactIdr, formatIdr } from '../lib/money'

type FinanceAccountsView = 'cash-bank' | 'assets' | 'liabilities'

const typeLabels: Record<FinancialAccount['type'], string> = {
  CASH_BANK: 'Cash / bank', MARKETPLACE: 'Marketplace liquid', PENDING: 'Pending settlement', PREPAID_ASSET: 'Prepaid asset', CREDIT_CARD: 'Credit card', LOAN: 'Loan'
}

export function FinanceAccountsPage({ view }: { view: FinanceAccountsView }) {
  const { database } = useLocalDatabase()
  const { cutoffDate, setCutoffDate } = useCutoffDate()
  const balances = database.financialAccounts.map((account) => ({ account, balance: financialAccountBalance(database, account, cutoffDate) }))
  const assetRows = balances.filter(({ account }) => !['CREDIT_CARD', 'LOAN'].includes(account.type))
  const liabilityRows = balances.filter(({ account }) => ['CREDIT_CARD', 'LOAN'].includes(account.type))
  const cashRows = balances.filter(({ account }) => account.type === 'CASH_BANK')
  const marketplaceRows = balances.filter(({ account }) => ['MARKETPLACE', 'PENDING'].includes(account.type))
  const cashTotal = cashRows.reduce((sum, row) => sum + row.balance, 0)
  const marketplaceTotal = marketplaceRows.reduce((sum, row) => sum + row.balance, 0)
  const inventoryTotal = inventoryValue(database.inventoryMovements.filter((movement) => isOnOrBefore(movement.date, cutoffDate)), database.skus)
  const supplierDeposit = database.depositMovements.filter((movement) => isOnOrBefore(movement.date, cutoffDate)).reduce((sum, movement) => sum + movement.amountDelta, 0)
  const cardExpenses = database.expenses.filter((expense) => expense.paymentSource === 'CREDIT_CARD' && isOnOrBefore(expense.date, cutoffDate)).reduce((sum, expense) => sum + expense.amount, 0)
  const liabilitiesTotal = liabilityRows.reduce((sum, row) => sum + row.balance, 0) + cardExpenses

  const content = view === 'cash-bank'
    ? { title: 'Cash & Bank', description: 'Saldo rekening bank, cash, marketplace liquid, dan pending settlement berdasarkan cutoff yang dipilih.', eyebrow: 'Finance / Liquidity' }
    : view === 'assets'
      ? { title: 'Assets', description: 'Daftar aset yang membentuk posisi bisnis: akun, inventory, supplier deposit, dan receivables.', eyebrow: 'Finance / Balance sheet' }
      : { title: 'Liabilities', description: 'Kewajiban bisnis dari credit card, loan, dan biaya kartu yang belum direkonsiliasi.', eyebrow: 'Finance / Balance sheet' }

  return <div className="space-y-7">
    <PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} action={<CutoffDatePicker cutoffDate={cutoffDate} onChange={setCutoffDate} />} />
    {view === 'cash-bank' && <>
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Cash & bank" value={cashTotal} icon={Landmark} tone="blush" />
        <SummaryCard label="Marketplace liquid" value={marketplaceTotal} icon={WalletCards} />
        <SummaryCard label="Total liquidity" value={cashTotal + marketplaceTotal} icon={RefreshCw} tone="sage" />
      </section>
      <AccountTable rows={[...cashRows, ...marketplaceRows]} empty="Belum ada akun kas, bank, atau marketplace." />
    </>}
    {view === 'assets' && <>
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Account assets" value={assetRows.reduce((sum, row) => sum + row.balance, 0)} icon={Building2} />
        <SummaryCard label="Inventory" value={inventoryTotal} icon={Package} />
        <SummaryCard label="Supplier deposit" value={supplierDeposit} icon={WalletCards} />
        <SummaryCard label="Total assets" value={assetRows.reduce((sum, row) => sum + row.balance, 0) + inventoryTotal + supplierDeposit} icon={Landmark} tone="sage" />
      </section>
      <AccountTable rows={assetRows} empty="Belum ada aset atau akun aktif." />
      <div className="grid gap-4 md:grid-cols-2"><QuickLink to="/operations/inventory" icon={Package} title="Review inventory" description={`Nilai inventory per ${formatDateId(cutoffDate)}: ${formatIdr(inventoryTotal)}`} /><QuickLink to="/settings/accounts" icon={RefreshCw} title="Update saldo manual" description="Catat snapshot terbaru untuk bank, cash, atau marketplace." /></div>
    </>}
    {view === 'liabilities' && <>
      <section className="grid gap-4 md:grid-cols-3"><SummaryCard label="Account liabilities" value={liabilityRows.reduce((sum, row) => sum + row.balance, 0)} icon={CreditCard} tone="blush" /><SummaryCard label="Credit card expenses" value={cardExpenses} icon={CreditCard} /><SummaryCard label="Total liabilities" value={liabilitiesTotal} icon={CreditCard} tone="sage" /></section>
      <AccountTable rows={liabilityRows} empty="Belum ada akun credit card atau loan." negative />
      <QuickLink to="/finance/expenses" icon={CreditCard} title="Review expenses" description="Lihat biaya kartu kredit yang ikut membentuk liability periode cutoff." />
    </>}
  </div>
}

function SummaryCard({ label, value, icon: Icon, tone = 'plain' }: { label: string; value: number; icon: typeof Landmark; tone?: 'plain' | 'blush' | 'sage' }) {
  const toneClass = tone === 'blush' ? 'border-blush bg-blush/25' : tone === 'sage' ? 'border-sage bg-sage/55' : 'border-stone-200 bg-shell'
  return <div className={`rounded-2xl border p-5 shadow-panel ${toneClass}`}><Icon className="h-5 w-5 text-blushDeep" aria-hidden="true" /><p className="mt-5 text-sm text-stone-500">{label}</p><p className="mt-2 font-display text-2xl font-semibold tabular-nums">{formatCompactIdr(value)}</p></div>
}

function AccountTable({ rows, empty, negative = false }: { rows: Array<{ account: FinancialAccount; balance: number }>; empty: string; negative?: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-stone-200 bg-shell shadow-panel"><div className="border-b border-stone-100 px-5 py-4 md:px-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Account detail</h2><p className="mt-1 text-sm text-stone-500">Saldo aktual per cutoff; update tersimpan sebagai snapshot.</p></div><Link to="/settings/accounts" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-linen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blushDeep">Kelola akun <ArrowRight className="h-3.5 w-3.5" /></Link></div></div>{rows.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-6 py-3 font-semibold">Akun</th><th className="px-6 py-3 font-semibold">Tipe</th><th className="px-6 py-3 text-right font-semibold">Saldo cutoff</th><th className="px-6 py-3 text-right font-semibold">Status</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(({ account, balance }) => <tr key={account.id} className="hover:bg-linen/70"><td className="px-6 py-4 font-semibold">{account.name}</td><td className="px-6 py-4 text-stone-600">{typeLabels[account.type]}</td><td className={`px-6 py-4 text-right font-semibold tabular-nums ${negative ? 'text-rose-700' : 'text-ink'}`}>{negative ? '-' : ''}{formatIdr(balance)}</td><td className="px-6 py-4 text-right"><StatusBadge label={account.active ? 'Aktif' : 'Nonaktif'} tone={account.active ? 'positive' : 'neutral'} /></td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-stone-500">{empty}<div className="mt-3"><Link to="/settings/accounts" className="font-semibold text-blushDeep hover:underline">Tambah akun</Link></div></div>}</section>
}

function QuickLink({ to, icon: Icon, title, description }: { to: string; icon: typeof Package; title: string; description: string }) {
  return <Link to={to} className="flex min-w-0 items-center gap-4 rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel transition-colors hover:bg-linen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blushDeep"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linen"><Icon className="h-5 w-5 text-blushDeep" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-stone-500">{description}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" /></Link>
}
