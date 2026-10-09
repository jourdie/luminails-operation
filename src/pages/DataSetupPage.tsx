import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Database, PackagePlus, Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useLocalDatabase } from '../hooks/useLocalDatabase'
import { inventoryBalance, supplierDepositBalance } from '../lib/ledger'
import { createEmptyLocalDatabase, createId, financialAccountBalance, localSeedDatabase, type FinancialAccount, type Sku } from '../lib/localDb'
import { formatIdr } from '../lib/money'

const fieldClass = 'w-full rounded-xl border border-stone-200 bg-linen px-3 py-2.5 text-sm text-ink outline-none transition focus:border-blushDeep focus:ring-2 focus:ring-blush/40'
const today = '2026-10-09'

export function DataSetupPage() {
  const { database, updateDatabase } = useLocalDatabase()
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [supplierCode, setSupplierCode] = useState('')
  const [supplierDeposit, setSupplierDeposit] = useState('0')
  const [skuForm, setSkuForm] = useState({ productName: '', variationName: '', sellerSku: '', hpp: '0', openingStock: '0', supplierId: '', minimumStock: '0', safetyStockDays: '7', shopeePrice: '0', shopeeVariationId: '' })
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [accountForm, setAccountForm] = useState({ name: '', type: 'CASH_BANK' as FinancialAccount['type'], openingBalance: '0' })

  const notify = (tone: 'success' | 'warning', text: string) => setNotice({ tone, text })

  function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = supplierName.trim()
    const code = supplierCode.trim().toUpperCase()
    const amount = Number(supplierDeposit)
    if (!name || !code || !Number.isFinite(amount) || amount < 0) return notify('warning', 'Lengkapi nama, kode, dan deposit opening dengan nilai yang valid.')
    const supplierId = createId('supplier')
    updateDatabase((current) => ({
      ...current,
      suppliers: [...current.suppliers, { id: supplierId, name, code, active: true }],
      depositMovements: amount > 0 ? [...current.depositMovements, { id: createId('deposit'), supplierId, date: today, amountDelta: amount, movementType: 'OPENING_BALANCE', source: 'Manual opening balance', createdAt: new Date().toISOString() }] : current.depositMovements,
      audits: [{ id: createId('audit'), date: `${today} 09:00`, action: 'SUPPLIER_OPENING_BALANCE', entity: code, detail: `${name} dibuat dengan opening deposit ${formatIdr(amount)}` }, ...current.audits]
    }))
    setSupplierName(''); setSupplierCode(''); setSupplierDeposit('0')
    notify('success', `${name} berhasil disiapkan untuk input manual.`)
  }

  function addSku(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const productName = skuForm.productName.trim()
    const hpp = Number(skuForm.hpp)
    const openingStock = Number(skuForm.openingStock)
    const minimumStock = Number(skuForm.minimumStock)
    const safetyStockDays = Number(skuForm.safetyStockDays)
    if (!productName || !Number.isFinite(hpp) || hpp < 0 || !Number.isFinite(openingStock) || openingStock < 0 || minimumStock < 0 || safetyStockDays < 0) return notify('warning', 'Isi nama produk, HPP, stok awal, minimum stock, dan safety stock dengan nilai valid.')
    const skuId = createId('sku')
    const sku: Sku = { id: skuId, productName, variationName: skuForm.variationName.trim() || 'Default', sellerSku: skuForm.sellerSku.trim(), parentSku: skuForm.sellerSku.trim(), shopeeVariationId: skuForm.shopeeVariationId.trim(), shopeePrice: Number(skuForm.shopeePrice) || 0, hpp, openingStock, supplierId: skuForm.supplierId, minimumStock, safetyStockDays }
    updateDatabase((current) => ({
      ...current,
      skus: [...current.skus, sku],
      costVersions: [...current.costVersions, { id: createId('cost'), skuId, cost: hpp, effectiveFrom: today, effectiveUntil: null, createdAt: new Date().toISOString() }],
      inventoryMovements: openingStock > 0 ? [...current.inventoryMovements, { id: createId('movement'), skuId, date: today, qtyDelta: openingStock, movementType: 'OPENING_BALANCE', source: 'Manual opening stock', unitCost: hpp, createdAt: new Date().toISOString() }] : current.inventoryMovements,
      audits: [{ id: createId('audit'), date: `${today} 09:00`, action: 'SKU_OPENING_BALANCE', entity: sku.sellerSku || sku.productName, detail: `${productName}: ${openingStock} unit dengan HPP ${formatIdr(hpp)}` }, ...current.audits]
    }))
    setSkuForm({ productName: '', variationName: '', sellerSku: '', hpp: '0', openingStock: '0', supplierId: '', minimumStock: '0', safetyStockDays: '7', shopeePrice: '0', shopeeVariationId: '' })
    notify('success', `${productName} dan opening stock berhasil diposting ke ledger.`)
  }

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const balance = Number(accountForm.openingBalance)
    if (!Number.isFinite(balance) || balance < 0) return notify('warning', 'Saldo opening harus berupa angka nol atau lebih.')
    if (selectedAccountId) {
      const account = database.financialAccounts.find((item) => item.id === selectedAccountId)
      if (!account) return
      updateDatabase((current) => ({ ...current, financialBalanceSnapshots: [...current.financialBalanceSnapshots, { id: createId('balance'), accountId: account.id, date: today, balance, source: 'MANUAL' as const, note: 'Update saldo manual dari Data Setup', createdAt: new Date().toISOString() }], audits: [{ id: createId('audit'), date: `${today} 09:00`, action: 'ACCOUNT_BALANCE_UPDATED', entity: account.name, detail: `Saldo aktual diubah menjadi ${formatIdr(balance)}` }, ...current.audits] }))
      notify('success', `Saldo ${account.name} disimpan.`)
    } else {
      const name = accountForm.name.trim()
      if (!name) return notify('warning', 'Nama akun wajib diisi untuk membuat akun baru.')
      const account: FinancialAccount = { id: createId('account'), name, type: accountForm.type, openingBalance: balance, active: true }
      updateDatabase((current) => ({ ...current, financialAccounts: [...current.financialAccounts, account], audits: [{ id: createId('audit'), date: `${today} 09:00`, action: 'ACCOUNT_CREATED', entity: name, detail: `Akun dibuat dengan saldo opening ${formatIdr(balance)}` }, ...current.audits] }))
      notify('success', `Akun ${name} disiapkan.`)
    }
    setSelectedAccountId(''); setAccountForm({ name: '', type: 'CASH_BANK', openingBalance: '0' })
  }

  function clearWorkspace() {
    if (!window.confirm('Bersihkan seluruh data lokal dan mulai dari workspace kosong? Data sample dan transaksi lokal akan dihapus.')) return
    updateDatabase(() => createEmptyLocalDatabase())
    notify('success', 'Workspace sekarang kosong. Silakan input master dan opening balance manual.')
  }

  function restoreDemo() {
    if (!window.confirm('Pulihkan sample data demo? Input testing lokal saat ini akan diganti.')) return
    updateDatabase(() => localSeedDatabase)
    notify('success', 'Sample data demo dipulihkan.')
  }

  const totalStock = database.skus.reduce((sum, sku) => sum + inventoryBalance(database.inventoryMovements, sku.id), 0)
  const totalDeposit = database.suppliers.reduce((sum, supplier) => sum + supplierDepositBalance(database.depositMovements, supplier.id), 0)
  return <div className="space-y-7"><PageHeader title="Data Setup" description="Bersihkan sample data dan masukkan master serta opening balance secara manual sebelum testing workflow." action={<div className="flex gap-2"><button type="button" onClick={restoreDemo} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-shell px-4 py-3 text-sm font-semibold text-ink"><RotateCcw className="h-4 w-4" /> Pulihkan demo</button><button type="button" onClick={clearWorkspace} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><Trash2 className="h-4 w-4" /> Workspace kosong</button></div>} />
    {notice && <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><CheckCircle2 className="h-4 w-4 shrink-0" />{notice.text}<button type="button" className="ml-auto text-xs font-semibold" onClick={() => setNotice(null)}>Tutup</button></div>}
    <section className="grid gap-4 md:grid-cols-4"><Summary icon={Database} label="SKU aktif" value={String(database.skus.length)} /><Summary icon={PackagePlus} label="Actual stock" value={`${totalStock} unit`} /><Summary icon={WalletCards} label="Supplier deposit" value={formatIdr(totalDeposit)} /><Summary icon={Save} label="Ledger entries" value={String(database.inventoryMovements.length + database.depositMovements.length)} /></section>
    <div className="grid gap-6 xl:grid-cols-2"><Panel title="1. Supplier dan opening deposit" description="Input supplier dan saldo deposit awal. Saldo menjadi ledger OPENING_BALANCE."><form className="grid gap-4 md:grid-cols-2" onSubmit={addSupplier}><Field label="Nama supplier"><input required value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className={fieldClass} placeholder="Contoh: PARTY" /></Field><Field label="Kode supplier"><input required value={supplierCode} onChange={(event) => setSupplierCode(event.target.value)} className={fieldClass} placeholder="PARTY" /></Field><Field label="Opening deposit (IDR)"><input required type="number" min="0" value={supplierDeposit} onChange={(event) => setSupplierDeposit(event.target.value)} className={fieldClass} /></Field><div className="flex items-end"><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Simpan supplier</button></div></form><div className="mt-5 space-y-2">{database.suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between rounded-xl bg-linen px-3 py-2.5 text-sm"><span className="font-semibold">{supplier.name} <span className="font-normal text-stone-500">({supplier.code})</span></span><span className="text-stone-600">{formatIdr(supplierDepositBalance(database.depositMovements, supplier.id))}</span></div>)}</div></Panel>
      <Panel title="2. Financial account dan saldo" description="Buat akun baru dengan saldo pembukaan, atau pilih akun existing untuk mencatat saldo aktual terbaru tanpa menghapus riwayat."><form className="space-y-4" onSubmit={saveAccount}><Field label="Akun existing (opsional)"><select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className={fieldClass}><option value="">Buat akun baru</option>{database.financialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {formatIdr(financialAccountBalance(database, account))}</option>)}</select></Field>{!selectedAccountId && <div className="grid gap-4 md:grid-cols-2"><Field label="Nama akun"><input required value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="BCA Operasional" /></Field><Field label="Tipe akun"><select value={accountForm.type} onChange={(event) => setAccountForm((current) => ({ ...current, type: event.target.value as FinancialAccount['type'] }))} className={fieldClass}><option value="CASH_BANK">Cash / bank</option><option value="MARKETPLACE">Marketplace liquid</option><option value="PENDING">Pending settlement</option><option value="PREPAID_ASSET">Prepaid asset</option><option value="CREDIT_CARD">Credit card</option><option value="LOAN">Loan</option></select></Field></div>}<Field label={selectedAccountId ? 'Saldo aktual terbaru (IDR)' : 'Saldo pembukaan (IDR)'}><input required type="number" min="0" value={accountForm.openingBalance} onChange={(event) => setAccountForm((current) => ({ ...current, openingBalance: event.target.value }))} className={fieldClass} /></Field><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><Save className="h-4 w-4" /> {selectedAccountId ? 'Catat saldo terbaru' : 'Simpan akun'}</button></form><div className="mt-5 space-y-2">{database.financialAccounts.map((account) => <div key={account.id} className="flex items-center justify-between rounded-xl bg-linen px-3 py-2.5 text-sm"><span>{account.name}</span><span className="font-semibold">{formatIdr(financialAccountBalance(database, account))}</span></div>)}</div></Panel></div>
    <Panel title="3. SKU, HPP, dan opening stock" description="Input satu SKU per kali untuk testing terkontrol. Opening stock langsung masuk inventory ledger sebagai OPENING_BALANCE."><form className="grid gap-4 md:grid-cols-3" onSubmit={addSku}><Field label="Nama produk"><input required value={skuForm.productName} onChange={(event) => setSkuForm((current) => ({ ...current, productName: event.target.value }))} className={fieldClass} placeholder="Luminails Cuticle Oil" /></Field><Field label="Variasi"><input value={skuForm.variationName} onChange={(event) => setSkuForm((current) => ({ ...current, variationName: event.target.value }))} className={fieldClass} placeholder="10 ml" /></Field><Field label="Seller SKU"><input value={skuForm.sellerSku} onChange={(event) => setSkuForm((current) => ({ ...current, sellerSku: event.target.value }))} className={fieldClass} placeholder="LUM-OIL-10" /></Field><Field label="HPP (IDR)"><input required type="number" min="0" value={skuForm.hpp} onChange={(event) => setSkuForm((current) => ({ ...current, hpp: event.target.value }))} className={fieldClass} /></Field><Field label="Opening actual stock"><input required type="number" min="0" value={skuForm.openingStock} onChange={(event) => setSkuForm((current) => ({ ...current, openingStock: event.target.value }))} className={fieldClass} /></Field><Field label="Default supplier"><select value={skuForm.supplierId} onChange={(event) => setSkuForm((current) => ({ ...current, supplierId: event.target.value }))} className={fieldClass}><option value="">Belum ditentukan</option>{database.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Minimum stock"><input type="number" min="0" value={skuForm.minimumStock} onChange={(event) => setSkuForm((current) => ({ ...current, minimumStock: event.target.value }))} className={fieldClass} /></Field><Field label="Safety stock days"><input type="number" min="0" value={skuForm.safetyStockDays} onChange={(event) => setSkuForm((current) => ({ ...current, safetyStockDays: event.target.value }))} className={fieldClass} /></Field><Field label="Shopee price (IDR)"><input type="number" min="0" value={skuForm.shopeePrice} onChange={(event) => setSkuForm((current) => ({ ...current, shopeePrice: event.target.value }))} className={fieldClass} /></Field><Field label="Shopee variation ID"><input value={skuForm.shopeeVariationId} onChange={(event) => setSkuForm((current) => ({ ...current, shopeeVariationId: event.target.value }))} className={fieldClass} placeholder="Opsional" /></Field><div className="flex items-end md:col-span-2"><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"><PackagePlus className="h-4 w-4" /> Simpan SKU dan opening stock</button></div></form><div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-stone-200 text-xs text-stone-500"><tr><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Produk</th><th className="px-3 py-3">HPP</th><th className="px-3 py-3">Actual stock</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-stone-100">{database.skus.map((sku) => { const stock = inventoryBalance(database.inventoryMovements, sku.id); return <tr key={sku.id}><td className="px-3 py-3 font-semibold">{sku.sellerSku || '-'}</td><td className="px-3 py-3">{sku.productName} <span className="text-xs text-stone-500">{sku.variationName}</span></td><td className="px-3 py-3">{formatIdr(sku.hpp)}</td><td className="px-3 py-3 font-semibold">{stock}</td><td className="px-3 py-3"><StatusBadge label={stock <= sku.minimumStock ? 'Di bawah minimum' : 'Siap'} tone={stock <= sku.minimumStock ? 'warning' : 'positive'} /></td></tr> })}</tbody></table></div></Panel>
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Aturan testing</p><p className="mt-1 leading-6">Opening stock dan opening deposit hanya dibuat dari halaman ini atau workflow resmi. Jangan mengedit saldo langsung di browser storage; ledger tetap menjadi sumber kebenaran.</p></div></div>
  </div>
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-stone-200 bg-shell p-6 shadow-panel"><div className="mb-5"><h2 className="font-display text-xl font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-stone-500">{description}</p></div>{children}</section> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-stone-700"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">{label}</span>{children}</label> }
function Summary({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) { return <div className="rounded-2xl border border-stone-200 bg-shell p-5 shadow-panel"><div className="flex items-center justify-between"><p className="text-sm text-stone-500">{label}</p><Icon className="h-4 w-4 text-blushDeep" /></div><p className="mt-3 font-display text-2xl font-semibold">{value}</p></div> }
