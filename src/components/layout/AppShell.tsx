import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, Building2, ChevronDown, CircleHelp, CreditCard, Database, LayoutDashboard, Menu, Package, Receipt, Settings2, ShoppingBag, Store, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../auth/AuthProvider'
import { useCutoffDate } from '../../hooks/useCutoffDate'
import { CutoffDatePicker } from '../ui/CutoffDatePicker'
import { hasPermission, type ModuleKey } from '../../lib/permissions'

type NavItem = { label: string; to: string; module: ModuleKey; icon: typeof LayoutDashboard }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  { label: 'Ruang kerja', items: [{ label: 'Dashboard', to: '/', module: 'dashboard', icon: LayoutDashboard }] },
  {
    label: 'Pesanan',
    items: [
      { label: 'Shopee Orders', to: '/orders/shopee', module: 'shopee_orders', icon: ShoppingBag },
      { label: 'Manual dan Reseller', to: '/orders/manual', module: 'manual_orders', icon: Store },
      { label: 'B2B Orders', to: '/orders/b2b', module: 'b2b', icon: Receipt }
    ]
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Inventory dan SKU', to: '/operations/inventory', module: 'inventory', icon: Package },
      { label: 'Restock', to: '/operations/restock', module: 'restock', icon: Package },
      { label: 'Supplier Deposit', to: '/operations/supplier-deposit', module: 'supplier_deposit', icon: Wallet },
      { label: 'Daily Reconciliation', to: '/operations/reconciliation', module: 'reports', icon: CircleHelp }
    ]
  },
  {
    label: 'Finance',
    items: [
      { label: 'P&L / Income Statement', to: '/finance/profit-loss', module: 'finance', icon: BarChart3 },
      { label: 'Cash & Bank', to: '/finance/cash-bank', module: 'finance', icon: Wallet },
      { label: 'Assets', to: '/finance/assets', module: 'finance', icon: Building2 },
      { label: 'Liabilities', to: '/finance/liabilities', module: 'finance', icon: CreditCard },
      { label: 'Business Position', to: '/finance/business-position', module: 'finance', icon: LayoutDashboard },
      { label: 'Expenses', to: '/finance/expenses', module: 'finance', icon: Receipt }
    ]
  },
  {
    label: 'Analitik',
    items: [{ label: 'Reports', to: '/reports', module: 'reports', icon: BarChart3 }]
  },
  {
    label: 'Pengaturan',
    items: [
      { label: 'Data Setup', to: '/settings/data-setup', module: 'settings', icon: Database },
      { label: 'Users dan Permissions', to: '/settings/users', module: 'settings', icon: Settings2 },
      { label: 'Suppliers', to: '/settings/suppliers', module: 'settings', icon: Store },
      { label: 'Financial Accounts', to: '/settings/accounts', module: 'settings', icon: Wallet },
      { label: 'Invoice Settings', to: '/settings/invoices', module: 'settings', icon: Receipt },
      { label: 'Audit Log', to: '/settings/audit-log', module: 'settings', icon: CircleHelp }
    ]
  }
]

export function AppShell() {
  const { profile, membership, signOut, isDemoMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const { cutoffDate, setCutoffDate } = useCutoffDate()

  const availableGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(membership, item.module, 'view'))
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-screen bg-linen text-ink">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-stone-200 bg-shell px-5 py-6 transition-transform lg:translate-x-0 ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between">
          <button type="button" className="text-left" onClick={() => navigate('/')}>
            <span className="font-display text-xl font-semibold tracking-tight">Luminails</span>
            <span className="mt-0.5 block text-xs font-medium uppercase tracking-[0.18em] text-blushDeep">Ops workspace</span>
          </button>
          <button type="button" className="rounded-lg p-2 text-stone-500 hover:bg-linen lg:hidden" onClick={() => setIsMobileNavOpen(false)} aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-9 space-y-7 overflow-y-auto pb-20">
          {availableGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{group.label}</p>
              <nav className="space-y-1" aria-label={group.label}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.to} to={`${item.to}${location.search}`} end={item.to === '/'} onClick={() => setIsMobileNavOpen(false)} className={({ isActive }) => `flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blushDeep ${isActive ? 'bg-blush/35 text-ink' : 'text-stone-600 hover:bg-linen hover:text-ink'}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {isMobileNavOpen && <button type="button" className="fixed inset-0 z-30 bg-ink/20 lg:hidden" onClick={() => setIsMobileNavOpen(false)} aria-label="Tutup menu" />}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-stone-200/80 bg-linen/90 px-5 backdrop-blur md:px-9">
          <button type="button" className="rounded-lg p-2 text-stone-600 hover:bg-shell lg:hidden" onClick={() => setIsMobileNavOpen(true)} aria-label="Buka menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-3 text-sm text-stone-500 lg:flex"><span>{membership?.workspaceName ?? 'Luminails'}</span>{isDemoMode && <span className="rounded-full border border-amber bg-amber/70 px-2 py-1 text-[11px] font-semibold text-amber-950">Mode lokal</span>}</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:block"><CutoffDatePicker cutoffDate={cutoffDate} onChange={setCutoffDate} /></div>
            <button type="button" className="rounded-lg p-2.5 text-stone-500 hover:bg-shell" aria-label="Notifikasi"><Bell className="h-5 w-5" /></button>
            <div className="mx-2 h-7 w-px bg-stone-200" />
            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blush text-sm font-semibold text-ink">{(profile?.fullName ?? 'L').slice(0, 1).toUpperCase()}</div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-ink">{profile?.fullName ?? 'Pengguna'}</p>
                <p className="text-xs text-stone-500">{membership?.role === 'OWNER' ? 'Owner' : 'Member'}</p>
              </div>
              <button type="button" className="rounded-lg p-1 text-stone-400 hover:bg-shell" onClick={() => void signOut()} aria-label="Keluar"><ChevronDown className="h-4 w-4" /></button>
            </div>
          </div>
        </header>
        <div className="mx-auto min-w-0 max-w-[1440px] overflow-x-hidden p-5 md:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
