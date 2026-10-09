import { formatCompactIdr } from './money'

export type Supplier = {
  id: string
  name: string
  code: string
  active: boolean
}

export type FinancialAccount = {
  id: string
  name: string
  type: 'CASH_BANK' | 'MARKETPLACE' | 'PENDING' | 'PREPAID_ASSET' | 'CREDIT_CARD' | 'LOAN'
  openingBalance: number
  active: boolean
}

export type FinancialBalanceSnapshot = {
  id: string
  accountId: string
  date: string
  balance: number
  source: 'MANUAL' | 'BANK_IMPORT' | 'MARKETPLACE_SETTLEMENT' | 'OTHER'
  note: string
  createdAt: string
}

export type WorkspaceMember = {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'MANAGER' | 'STAFF'
  active: boolean
  permissions: Record<string, 'view' | 'edit' | 'admin' | 'none'>
}

export type InvoiceSettings = {
  companyName: string
  address: string
  phone: string
  invoicePrefix: string
  nextNumber: number
  paymentNotes: string
}

export type Sku = {
  id: string
  sellerSku: string
  parentSku: string
  productName: string
  variationName: string
  shopeeVariationId: string
  shopeePrice: number
  hpp: number
  openingStock: number
  supplierId: string
  minimumStock: number
  safetyStockDays: number
}

export type CostVersion = {
  id: string
  skuId: string
  cost: number
  effectiveFrom: string
  effectiveUntil: string | null
  createdAt: string
}

export type InventoryMovement = {
  id: string
  skuId: string
  date: string
  qtyDelta: number
  movementType: 'OPENING_BALANCE' | 'RESTOCK_RECEIVED' | 'SALE' | 'DAMAGE' | 'ADJUSTMENT'
  source: string
  unitCost: number
  createdAt: string
}

export type DepositMovement = {
  id: string
  supplierId: string
  date: string
  amountDelta: number
  movementType: 'OPENING_BALANCE' | 'TOP_UP' | 'DROPSHIP_USAGE' | 'RESTOCK_POSTED' | 'ADJUSTMENT'
  source: string
  createdAt: string
}

export type RestockLine = {
  skuId: string
  qty: number
  unitCost: number
  receivedQty: number
}

export type Restock = {
  id: string
  reference: string
  supplierId: string
  date: string
  status: 'DRAFT' | 'POSTED' | 'IN_TRANSIT' | 'PARTIAL' | 'RECEIVED'
  lines: RestockLine[]
  postedAt: string | null
  receivedAt: string | null
}

export type SalesOrderItem = {
  skuId: string
  qty: number
  unitPrice: number
  discountPrice: number
}

export type FulfillmentAllocation = {
  skuId: string
  source: 'INVENTORY' | 'PARTY' | 'BLUESKY'
  qty: number
  posted: boolean
}

export type SalesOrder = {
  id: string
  externalOrderId: string
  channel: 'SHOPEE' | 'MANUAL' | 'RESELLER' | 'B2B'
  customer: string
  date: string
  status: 'PENDING_PAYMENT' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'RETURNED'
  items: SalesOrderItem[]
  allocations: FulfillmentAllocation[]
}

export type Expense = {
  id: string
  date: string
  description: string
  category: 'ADS' | 'PACKAGING' | 'SOFTWARE' | 'OTHER_OPEX'
  purpose: 'BUSINESS' | 'PERSONAL'
  paymentSource: 'CASH_BANK' | 'CREDIT_CARD' | 'OTHER'
  amount: number
}

export type SettlementRow = {
  id: string
  externalOrderId: string
  grossProductSales: number
  sellerDiscount: number
  refund: number
  platformFee: number
  processingFee: number
  freeShippingFee: number
  serviceFee: number
  promotionFee: number
  shopeeTax: number
  otherShopeeFee: number
  netReleasedIncome: number
  allocationMethod: 'EXACT' | 'ALLOCATED' | 'UNMATCHED'
  importedAt: string
  reconciliationStatus?: 'PENDING' | 'RECONCILED'
  reconciledAt?: string
  reconciliationNote?: string
}

export type LocalInvoice = {
  id: string
  invoiceNumber: string
  orderId: string
  customer: string
  total: number
  dueDate: string
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID'
  customerSnapshot: { name: string; address: string }
}

export type LocalPayment = {
  id: string
  invoiceId: string
  date: string
  amount: number
  reference: string
}

export type AuditEntry = {
  id: string
  date: string
  action: string
  entity: string
  detail: string
}

export type LocalDatabase = {
  version: 3
  suppliers: Supplier[]
  financialAccounts: FinancialAccount[]
  financialBalanceSnapshots: FinancialBalanceSnapshot[]
  workspaceMembers: WorkspaceMember[]
  invoiceSettings: InvoiceSettings
  skus: Sku[]
  costVersions: CostVersion[]
  inventoryMovements: InventoryMovement[]
  depositMovements: DepositMovement[]
  restocks: Restock[]
  salesOrders: SalesOrder[]
  expenses: Expense[]
  settlements: SettlementRow[]
  invoices: LocalInvoice[]
  payments: LocalPayment[]
  audits: AuditEntry[]
}

export type LocalDashboardData = {
  period: string
  profit: { value: string; comparison: string; change: string }
  position: { value: string; detail: string; change: string }
  operations: Array<{ label: string; value: string; detail: string }>
  alerts: Array<{ label: string; detail: string; route: string; tone: 'warning' | 'critical' | 'neutral' }>
}

const storageKey = 'luminails-ops-local-v3'
const now = '2026-10-07T09:00:00.000Z'

const seedDatabase: LocalDatabase = {
  version: 3,
  suppliers: [
    { id: 'supplier-party', name: 'PARTY', code: 'PARTY', active: true },
    { id: 'supplier-bluesky', name: 'Bluesky', code: 'BLUESKY', active: true }
  ],
  financialAccounts: [
    { id: 'account-cash', name: 'Kas dan Bank Operasional', type: 'CASH_BANK', openingBalance: 18500000, active: true },
    { id: 'account-shopee', name: 'Shopee Liquid', type: 'MARKETPLACE', openingBalance: 12600000, active: true },
    { id: 'account-pending', name: 'Marketplace Pending', type: 'PENDING', openingBalance: 831900, active: true },
    { id: 'account-card', name: 'Kartu Kredit Bisnis', type: 'CREDIT_CARD', openingBalance: 4200000, active: true }
  ],
  financialBalanceSnapshots: [],
  workspaceMembers: [
    { id: 'member-owner', name: 'Owner Luminails', email: 'owner@luminails.local', role: 'OWNER', active: true, permissions: { '*': 'admin' } },
    { id: 'member-ops', name: 'Ops Manager', email: 'ops@luminails.local', role: 'MANAGER', active: true, permissions: { dashboard: 'view', inventory: 'edit', restock: 'edit', supplier_deposit: 'edit', reports: 'view', shopee_orders: 'edit', manual_orders: 'edit', b2b: 'view', finance: 'view', settings: 'view' } }
  ],
  invoiceSettings: {
    companyName: 'Luminails Studio',
    address: 'Jakarta Selatan, Indonesia',
    phone: '+62 812 0000 0000',
    invoicePrefix: 'LUM-INV',
    nextNumber: 2,
    paymentNotes: 'Pembayaran jatuh tempo sesuai tanggal pada invoice.'
  },
  skus: [
    { id: 'sku-lumi-oil', sellerSku: 'LUM-OIL-10', parentSku: 'LUM-OIL', productName: 'Luminails Cuticle Oil', variationName: '10 ml', shopeeVariationId: 'SHP-1001', shopeePrice: 89000, hpp: 42000, openingStock: 42, supplierId: 'supplier-party', minimumStock: 15, safetyStockDays: 7 },
    { id: 'sku-gel-base', sellerSku: 'GEL-BASE-15', parentSku: 'GEL-BASE', productName: 'Luminails Gel Base', variationName: '15 ml', shopeeVariationId: 'SHP-1002', shopeePrice: 129000, hpp: 68000, openingStock: 24, supplierId: 'supplier-bluesky', minimumStock: 10, safetyStockDays: 7 },
    { id: 'sku-nail-file', sellerSku: 'ACC-FILE-01', parentSku: 'ACC-FILE', productName: 'Nail File Premium', variationName: 'Single', shopeeVariationId: 'SHP-1003', shopeePrice: 29000, hpp: 9000, openingStock: 78, supplierId: 'supplier-party', minimumStock: 25, safetyStockDays: 10 }
  ],
  costVersions: [
    { id: 'cost-oil-001', skuId: 'sku-lumi-oil', cost: 42000, effectiveFrom: '2026-10-01', effectiveUntil: null, createdAt: now },
    { id: 'cost-gel-001', skuId: 'sku-gel-base', cost: 68000, effectiveFrom: '2026-10-01', effectiveUntil: null, createdAt: now },
    { id: 'cost-file-001', skuId: 'sku-nail-file', cost: 9000, effectiveFrom: '2026-10-01', effectiveUntil: null, createdAt: now }
  ],
  inventoryMovements: [
    { id: 'movement-open-oil', skuId: 'sku-lumi-oil', date: '2026-10-01', qtyDelta: 42, movementType: 'OPENING_BALANCE', source: 'Opening inventory', unitCost: 42000, createdAt: now },
    { id: 'movement-open-gel', skuId: 'sku-gel-base', date: '2026-10-01', qtyDelta: 24, movementType: 'OPENING_BALANCE', source: 'Opening inventory', unitCost: 68000, createdAt: now },
    { id: 'movement-open-file', skuId: 'sku-nail-file', date: '2026-10-01', qtyDelta: 78, movementType: 'OPENING_BALANCE', source: 'Opening inventory', unitCost: 9000, createdAt: now },
    { id: 'movement-sale-oil', skuId: 'sku-lumi-oil', date: '2026-10-06', qtyDelta: -3, movementType: 'SALE', source: 'SHP-240906-001', unitCost: 42000, createdAt: now },
    { id: 'movement-sale-gel', skuId: 'sku-gel-base', date: '2026-10-06', qtyDelta: -4, movementType: 'SALE', source: 'SHP-240906-001', unitCost: 68000, createdAt: now },
    { id: 'movement-restock-file', skuId: 'sku-nail-file', date: '2026-10-05', qtyDelta: 50, movementType: 'RESTOCK_RECEIVED', source: 'RST-202610-001', unitCost: 9000, createdAt: now }
  ],
  depositMovements: [
    { id: 'deposit-open-party', supplierId: 'supplier-party', date: '2026-10-01', amountDelta: 12000000, movementType: 'OPENING_BALANCE', source: 'Opening deposit', createdAt: now },
    { id: 'deposit-open-bluesky', supplierId: 'supplier-bluesky', date: '2026-10-01', amountDelta: 8500000, movementType: 'OPENING_BALANCE', source: 'Opening deposit', createdAt: now },
    { id: 'deposit-use-party', supplierId: 'supplier-party', date: '2026-10-06', amountDelta: -126000, movementType: 'DROPSHIP_USAGE', source: 'SHP-240906-001', createdAt: now }
  ],
  restocks: [
    { id: 'restock-001', reference: 'RST-202610-001', supplierId: 'supplier-party', date: '2026-10-05', status: 'RECEIVED', lines: [{ skuId: 'sku-nail-file', qty: 50, unitCost: 9000, receivedQty: 50 }], postedAt: '2026-10-05T09:10:00.000Z', receivedAt: '2026-10-05T16:20:00.000Z' },
    { id: 'restock-002', reference: 'RST-202610-002', supplierId: 'supplier-bluesky', date: '2026-10-07', status: 'IN_TRANSIT', lines: [{ skuId: 'sku-gel-base', qty: 30, unitCost: 68000, receivedQty: 0 }], postedAt: '2026-10-07T07:30:00.000Z', receivedAt: null }
  ],
  salesOrders: [
    { id: 'order-shopee-001', externalOrderId: 'SHP-240906-001', channel: 'SHOPEE', customer: 'Nadia S.', date: '2026-10-06', status: 'SHIPPED', items: [{ skuId: 'sku-lumi-oil', qty: 6, unitPrice: 89000, discountPrice: 85000 }, { skuId: 'sku-gel-base', qty: 4, unitPrice: 129000, discountPrice: 119000 }], allocations: [{ skuId: 'sku-lumi-oil', source: 'INVENTORY', qty: 3, posted: true }, { skuId: 'sku-lumi-oil', source: 'PARTY', qty: 3, posted: true }, { skuId: 'sku-gel-base', source: 'INVENTORY', qty: 4, posted: true }] },
    { id: 'order-shopee-002', externalOrderId: 'SHP-240906-002', channel: 'SHOPEE', customer: 'Maya R.', date: '2026-10-07', status: 'SHIPPED', items: [{ skuId: 'sku-lumi-oil', qty: 2, unitPrice: 89000, discountPrice: 89000 }], allocations: [] },
    { id: 'order-manual-001', externalOrderId: 'MAN-202610-001', channel: 'RESELLER', customer: 'Studio Kuku Senja', date: '2026-10-07', status: 'COMPLETED', items: [{ skuId: 'sku-nail-file', qty: 12, unitPrice: 29000, discountPrice: 25000 }], allocations: [{ skuId: 'sku-nail-file', source: 'INVENTORY', qty: 12, posted: true }] },
    { id: 'order-b2b-001', externalOrderId: 'B2B-202610-001', channel: 'B2B', customer: 'PT Cantik Bersama', date: '2026-10-03', status: 'COMPLETED', items: [{ skuId: 'sku-gel-base', qty: 10, unitPrice: 129000, discountPrice: 115000 }], allocations: [{ skuId: 'sku-gel-base', source: 'INVENTORY', qty: 10, posted: true }] }
  ],
  expenses: [
    { id: 'expense-ads-oct', date: '2026-10-01', description: 'Ads October', category: 'ADS', purpose: 'BUSINESS', paymentSource: 'CREDIT_CARD', amount: 4200000 },
    { id: 'expense-packaging-oct', date: '2026-10-01', description: 'Packaging October', category: 'PACKAGING', purpose: 'BUSINESS', paymentSource: 'CASH_BANK', amount: 1350000 }
  ],
  settlements: [
    { id: 'settlement-001', externalOrderId: 'SHP-240906-001', grossProductSales: 1010000, sellerDiscount: 80000, refund: 0, platformFee: 50500, processingFee: 10100, freeShippingFee: 5000, serviceFee: 12000, promotionFee: 8000, shopeeTax: 2500, otherShopeeFee: 0, netReleasedIncome: 831900, allocationMethod: 'EXACT', importedAt: now, reconciliationStatus: 'PENDING' },
    { id: 'settlement-002', externalOrderId: 'SHP-240906-002', grossProductSales: 178000, sellerDiscount: 0, refund: 0, platformFee: 8900, processingFee: 1780, freeShippingFee: 0, serviceFee: 2100, promotionFee: 0, shopeeTax: 450, otherShopeeFee: 0, netReleasedIncome: 164770, allocationMethod: 'EXACT', importedAt: now, reconciliationStatus: 'PENDING' }
  ],
  invoices: [
    { id: 'invoice-001', invoiceNumber: 'LUM-INV-2026-0001', orderId: 'order-b2b-001', customer: 'PT Cantik Bersama', total: 1150000, dueDate: '2026-10-17', status: 'PARTIALLY_PAID', customerSnapshot: { name: 'PT Cantik Bersama', address: 'Jakarta Selatan' } }
  ],
  payments: [
    { id: 'payment-001', invoiceId: 'invoice-001', date: '2026-10-05', amount: 500000, reference: 'BCA-1005-01' }
  ],
  audits: [
    { id: 'audit-001', date: '2026-10-07 08:12', action: 'FULFILLMENT_POSTED', entity: 'SHP-240906-001', detail: 'Fulfillment inventory dan PARTY diposting' },
    { id: 'audit-002', date: '2026-10-05 16:20', action: 'RESTOCK_RECEIVED', entity: 'RST-202610-001', detail: '50 Nail File Premium diterima' }
  ]
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getLocalDatabase(): LocalDatabase {
  if (typeof window === 'undefined') return createEmptyLocalDatabase()
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      const emptyDatabase = createEmptyLocalDatabase()
      window.localStorage.setItem(storageKey, JSON.stringify(emptyDatabase))
      return emptyDatabase
    }
    const parsed = JSON.parse(stored) as LocalDatabase
    return parsed.version === 3 ? {
      ...parsed,
      financialAccounts: parsed.financialAccounts ?? [],
      financialBalanceSnapshots: parsed.financialBalanceSnapshots ?? [],
      workspaceMembers: parsed.workspaceMembers ?? seedDatabase.workspaceMembers,
      invoiceSettings: parsed.invoiceSettings ?? seedDatabase.invoiceSettings,
      costVersions: parsed.costVersions ?? [],
      settlements: (parsed.settlements ?? []).map((row) => ({ ...row, reconciliationStatus: row.reconciliationStatus ?? 'PENDING' })),
      invoices: parsed.invoices ?? [],
      payments: parsed.payments ?? []
    } : createEmptyLocalDatabase()
  } catch {
    return createEmptyLocalDatabase()
  }
}

export function saveLocalDatabase(database: LocalDatabase): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(database))
}

export function resetLocalDatabase(): LocalDatabase {
  saveLocalDatabase(seedDatabase)
  return seedDatabase
}

export function createEmptyLocalDatabase(): LocalDatabase {
  return {
    version: 3,
    suppliers: [],
    financialAccounts: [],
    financialBalanceSnapshots: [],
    workspaceMembers: [{ id: 'member-owner', name: 'Owner Luminails', email: 'owner@luminails.local', role: 'OWNER', active: true, permissions: { '*': 'admin' } }],
    invoiceSettings: { ...seedDatabase.invoiceSettings },
    skus: [],
    costVersions: [],
    inventoryMovements: [],
    depositMovements: [],
    restocks: [],
    salesOrders: [],
    expenses: [],
    settlements: [],
    invoices: [],
    payments: [],
    audits: [{ id: createId('audit'), date: '2026-10-09 09:00', action: 'WORKSPACE_CLEARED', entity: 'local_workspace', detail: 'Workspace disiapkan kosong untuk input manual' }]
  }
}

export function clearLocalWorkspace(): LocalDatabase {
  const emptyDatabase = createEmptyLocalDatabase()
  saveLocalDatabase(emptyDatabase)
  return emptyDatabase
}

export const localSeedDatabase = seedDatabase

export function financialAccountBalance(database: Pick<LocalDatabase, 'financialBalanceSnapshots'>, account: FinancialAccount): number {
  const snapshots = database.financialBalanceSnapshots
    .filter((snapshot) => snapshot.accountId === account.id)
    .sort((left, right) => `${left.date}-${left.createdAt}`.localeCompare(`${right.date}-${right.createdAt}`))
  return snapshots.at(-1)?.balance ?? account.openingBalance
}

export function getLocalDashboardData(): LocalDashboardData {
  const database = getLocalDatabase()
  const salesCount = database.salesOrders.length
  const unallocated = database.salesOrders.filter((order) => order.status === 'SHIPPED' && order.allocations.length === 0).length
  const lowStock = database.skus.filter((sku) => database.inventoryMovements.filter((movement) => movement.skuId === sku.id).reduce((sum, movement) => sum + movement.qtyDelta, 0) <= sku.minimumStock).length
  const grossSales = database.salesOrders.reduce((sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + item.qty * item.discountPrice, 0), 0)
  const cogs = database.salesOrders.reduce((sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + item.qty * (database.skus.find((sku) => sku.id === item.skuId)?.hpp ?? 0), 0), 0)
  const settlementFees = database.settlements.reduce((sum, row) => sum + row.platformFee + row.processingFee + row.freeShippingFee + row.serviceFee + row.promotionFee + row.shopeeTax + row.otherShopeeFee, 0)
  const businessExpenses = database.expenses.filter((expense) => expense.purpose === 'BUSINESS').reduce((sum, expense) => sum + expense.amount, 0)
  const operatingProfit = grossSales - cogs - settlementFees - businessExpenses
  const accountAssets = database.financialAccounts.filter((account) => account.active && !['CREDIT_CARD', 'LOAN'].includes(account.type)).reduce((sum, account) => sum + financialAccountBalance(database, account), 0)
  const accountLiabilities = database.financialAccounts.filter((account) => account.active && ['CREDIT_CARD', 'LOAN'].includes(account.type)).reduce((sum, account) => sum + financialAccountBalance(database, account), 0)
  const supplierDeposit = database.suppliers.reduce((sum, supplier) => sum + database.depositMovements.filter((movement) => movement.supplierId === supplier.id).reduce((balance, movement) => balance + movement.amountDelta, 0), 0)
  const stockValue = database.skus.reduce((sum, sku) => sum + database.inventoryMovements.filter((movement) => movement.skuId === sku.id).reduce((balance, movement) => balance + movement.qtyDelta, 0) * sku.hpp, 0)
  const receivables = database.invoices.reduce((sum, invoice) => sum + invoice.total - database.payments.filter((payment) => payment.invoiceId === invoice.id).reduce((paid, payment) => paid + payment.amount, 0), 0)
  const netPosition = accountAssets + supplierDeposit + stockValue + receivables - accountLiabilities
  const alerts: LocalDashboardData['alerts'] = []
  if (!database.skus.length && !database.suppliers.length && !database.financialAccounts.length) alerts.push({ label: 'Workspace belum di-setup', detail: 'Data Setup', route: '/settings/data-setup', tone: 'warning' })
  if (lowStock > 0) alerts.push({ label: `${lowStock} SKU berada di bawah minimum stock`, detail: 'Inventory dan SKU', route: '/operations/inventory', tone: 'critical' })
  if (unallocated > 0) alerts.push({ label: `${unallocated} order shipped belum memiliki sumber pengiriman`, detail: 'Shopee Orders', route: '/orders/shopee', tone: 'neutral' })
  const inTransit = database.restocks.filter((restock) => restock.status === 'IN_TRANSIT' || restock.status === 'PARTIAL').length
  if (inTransit > 0) alerts.push({ label: `${inTransit} restock masih berjalan`, detail: 'Restock', route: '/operations/restock', tone: 'warning' })
  return {
    period: '1 - 9 Oktober 2026',
    profit: { value: formatCompactIdr(operatingProfit), comparison: database.salesOrders.length ? 'Berdasarkan data lokal' : 'Belum ada transaksi', change: database.salesOrders.length ? 'Aktual lokal' : 'Input manual' },
    position: { value: formatCompactIdr(netPosition), detail: 'Assets dikurangi liabilities', change: database.financialAccounts.length || database.skus.length ? 'Aktual lokal' : 'Input manual' },
    operations: [
      { label: 'Pesanan masuk', value: String(salesCount), detail: 'Shopee dan manual' },
      { label: 'Perlu dialokasikan', value: String(unallocated), detail: 'Fulfillment' },
      { label: 'Rekonsiliasi', value: '0', detail: 'Input manual' }
    ],
    alerts
  }
}
