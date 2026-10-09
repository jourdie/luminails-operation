import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AppShell } from '../components/layout/AppShell'
import { hasPermission, type ModuleKey } from '../lib/permissions'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'
import { LoginPage } from '../pages/LoginPage'

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const InventoryPage = lazy(() => import('../pages/InventoryPage').then((module) => ({ default: module.InventoryPage })))
const SupplierDepositPage = lazy(() => import('../pages/SupplierDepositPage').then((module) => ({ default: module.SupplierDepositPage })))
const RestockPage = lazy(() => import('../pages/RestockPage').then((module) => ({ default: module.RestockPage })))
const OrdersPage = lazy(() => import('../pages/OrdersPage').then((module) => ({ default: module.OrdersPage })))
const B2BPage = lazy(() => import('../pages/B2BPage').then((module) => ({ default: module.B2BPage })))
const ReconciliationPage = lazy(() => import('../pages/ReconciliationPage').then((module) => ({ default: module.ReconciliationPage })))
const FinancePage = lazy(() => import('../pages/FinancePage').then((module) => ({ default: module.FinancePage })))
const FinanceAccountsPage = lazy(() => import('../pages/FinanceAccountsPage').then((module) => ({ default: module.FinanceAccountsPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const DataSetupPage = lazy(() => import('../pages/DataSetupPage').then((module) => ({ default: module.DataSetupPage })))
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const NeumorphismPreviewPage = lazy(() => import('../pages/NeumorphismPreviewPage').then((module) => ({ default: module.NeumorphismPreviewPage })))

function RouteLoading() {
  return <div className="flex min-h-[360px] items-center justify-center text-sm text-stone-500">Memuat modul...</div>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, user, membership } = useAuth()
  if (isLoading) return <RouteLoading />
  if (!user) return <Navigate to="/login" replace />
  if (!membership) return <Navigate to="/access-denied" replace />
  return <>{children}</>
}

function RequirePermission({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { membership } = useAuth()
  if (!hasPermission(membership, module, 'view')) return <Navigate to="/access-denied" replace />
  return <>{children}</>
}

export function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/preview/neumorphism" element={<RequireAuth><NeumorphismPreviewPage /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<RequirePermission module="dashboard"><DashboardPage /></RequirePermission>} />
          <Route path="orders/shopee" element={<RequirePermission module="shopee_orders"><OrdersPage channel="SHOPEE" /></RequirePermission>} />
          <Route path="orders/manual" element={<RequirePermission module="manual_orders"><OrdersPage channel="MANUAL" /></RequirePermission>} />
          <Route path="orders/b2b" element={<RequirePermission module="b2b"><B2BPage /></RequirePermission>} />
          <Route path="operations/inventory" element={<RequirePermission module="inventory"><InventoryPage /></RequirePermission>} />
          <Route path="operations/restock" element={<RequirePermission module="restock"><RestockPage /></RequirePermission>} />
          <Route path="operations/supplier-deposit" element={<RequirePermission module="supplier_deposit"><SupplierDepositPage /></RequirePermission>} />
          <Route path="operations/reconciliation" element={<RequirePermission module="reports"><ReconciliationPage /></RequirePermission>} />
          <Route path="finance/profit-loss" element={<RequirePermission module="finance"><FinancePage view="profit-loss" /></RequirePermission>} />
          <Route path="finance/cash-bank" element={<RequirePermission module="finance"><FinanceAccountsPage view="cash-bank" /></RequirePermission>} />
          <Route path="finance/assets" element={<RequirePermission module="finance"><FinanceAccountsPage view="assets" /></RequirePermission>} />
          <Route path="finance/liabilities" element={<RequirePermission module="finance"><FinanceAccountsPage view="liabilities" /></RequirePermission>} />
          <Route path="finance/business-position" element={<RequirePermission module="finance"><FinancePage view="position" /></RequirePermission>} />
          <Route path="finance/expenses" element={<RequirePermission module="finance"><FinancePage view="expenses" /></RequirePermission>} />
          <Route path="reports" element={<RequirePermission module="reports"><ReportsPage /></RequirePermission>} />
          <Route path="settings/users" element={<RequirePermission module="settings"><SettingsPage view="users" /></RequirePermission>} />
          <Route path="settings/data-setup" element={<RequirePermission module="settings"><DataSetupPage /></RequirePermission>} />
          <Route path="settings/suppliers" element={<RequirePermission module="settings"><SettingsPage view="suppliers" /></RequirePermission>} />
          <Route path="settings/accounts" element={<RequirePermission module="settings"><SettingsPage view="accounts" /></RequirePermission>} />
          <Route path="settings/invoices" element={<RequirePermission module="settings"><SettingsPage view="invoices" /></RequirePermission>} />
          <Route path="settings/audit-log" element={<RequirePermission module="settings"><SettingsPage view="audit" /></RequirePermission>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
