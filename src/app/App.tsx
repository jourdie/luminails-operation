import { ProductsPage } from '../features/products/ProductsPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase/client';
import type { Module } from '../types/domain';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/button';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ResourcePage } from '../pages/ResourcePage';
import { resources, customerConfig } from '../pages/resources';
import { DepositsPage } from '../features/deposits/DepositsPage';
import { ProcurementPage } from '../features/procurement/ProcurementPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { SalesPage } from '../features/whatsapp-orders/SalesPage';
import { PromotionPage } from '../features/promotions/PromotionPage';
const ShopeePage = lazy(() =>
  import('../features/shopee/ShopeePage').then((m) => ({ default: m.ShopeePage })),
);
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { InvoicesPage } from '../features/invoices/InvoicesPage';
import { FinancePage } from '../features/finance/FinancePage';
import { ReportsPage } from '../features/reports/ReportsPage';
import {
  SettingsPage,
  UsersPage,
  WorkspacePage,
  OpeningPage,
} from '../features/settings/SettingsPage';
import { toast } from 'sonner';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="login-screen">
        <h1>Aplikasi mengalami kendala.</h1>
        <p>Muat ulang halaman. Data yang sudah tersimpan tetap tersedia.</p>
        <Button onClick={() => window.location.reload()}>Muat ulang</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function Protected({
  module,
  children,
}: {
  module: Module | Module[];
  children: ReactNode;
}) {
  const { member, permissions } = useAuth();
  return (Array.isArray(module) ? module : [module]).some((m) => can(member, permissions, m)) ? (
    children
  ) : (
    <div className="panel">
      <h1>Akses ditolak</h1>
      <p>Anda tidak memiliki akses ke modul ini.</p>
    </div>
  );
}
function AuthenticatedApp() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <div className="login-screen">
        <div className="brand-mark">L</div>
        <h1>Luminails Operation</h1>
        <p>Menyiapkan workspace dan database...</p>
        <div className="skeleton h-2 w-48" />
      </div>
    );
  if (auth.error)
    return (
      <div className="login-screen">
        <h1>{auth.error.startsWith('Database lokal') ? 'Database lokal gagal dimuat' : 'Konfigurasi diperlukan'}</h1>
        <p>{auth.error}</p>
        <Button onClick={() => window.location.reload()}>Muat ulang</Button>
      </div>
    );
  if (!auth.loggedIn)
    return (
      <div className="login-screen">
        <div className="brand-mark">
          L
        </div>
        <h1>Luminails Operation</h1>
        <p>Satu tempat untuk mengelola seluruh operasi bisnis.</p>
        <Button
          onClick={async () => {
            const result = await supabase?.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin },
            });
            if (result?.error) toast.error('Login gagal. Periksa konfigurasi Google OAuth.');
          }}
        >
          Masuk dengan Google
        </Button>
        <small>Akses hanya untuk anggota yang diundang.</small>
      </div>
    );
  if (!auth.member)
    return (
      <div className="login-screen">
        <h1>Akses belum tersedia</h1>
        <p>Akun Anda belum memiliki akses ke Luminails Operation.</p>
        <Button onClick={() => void supabase?.auth.signOut()}>Keluar</Button>
      </div>
    );
  const protect = (module: Module | Module[], element: ReactNode) => (
    <Protected module={module}>{element}</Protected>
  );
  const resourceRoutes: Record<string, string> = {
    'products/master': 'product-master',
    'products/brands': 'brands',
    suppliers: 'suppliers',
    'suppliers/costs': 'costs',
    'b2b/branches': 'branches',
    'finance/accounts': 'accounts',
    'finance/snapshots': 'snapshots',
    'finance/expenses': 'expenses',
    'finance/payments': 'payments',
    'finance/receivables': 'receivables',
    'settings/audit': 'audit',
  };
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={protect('dashboard', <DashboardPage />)} />
        {Object.entries(resourceRoutes).map(([path, key]) => (
          <Route
            key={path}
            path={path}
            element={protect(
              resources[key].module,
              <ResourcePage key={key} config={resources[key]} />,
            )}
          />
        ))}
        <Route path="products" element={protect('products', <ProductsPage />)} />
        <Route path="deposits" element={protect('deposits', <DepositsPage />)} />
        <Route path="procurement" element={protect('deposits', <ProcurementPage />)} />
        <Route path="inventory" element={protect('inventory', <InventoryPage />)} />
        <Route path="whatsapp-orders" element={protect('b2b', <SalesPage />)} />
        <Route path="promotions" element={protect('b2b', <PromotionPage />)} />
        <Route
          path="b2b"
          element={protect('b2b', <ResourcePage config={customerConfig('B2B')} />)}
        />
        <Route path="b2b/orders" element={protect('b2b', <SalesPage channel="B2B" />)} />
        <Route
          path="reseller"
          element={protect('reseller', <ResourcePage config={customerConfig('RESELLER')} />)}
        />
        <Route
          path="reseller/orders"
          element={protect('reseller', <SalesPage channel="RESELLER" />)}
        />
        <Route
          path="reseller/branches"
          element={protect(
            'reseller',
            <ResourcePage config={{ ...resources.branches, module: 'reseller' }} />,
          )}
        />
        <Route
          path="reseller/analytics"
          element={protect('reseller', protect('finance', <ReportsPage reseller />))}
        />
        <Route path="shopee" element={protect('shopee', <ShopeePage />)} />
        <Route path="shopee/orders" element={protect('shopee', <SalesPage channel="SHOPEE" />)} />
        <Route path="reconciliation" element={protect('reconciliation', <ReconciliationPage />)} />
        <Route path="invoices" element={protect(['b2b', 'reseller'], <InvoicesPage />)} />
        <Route path="finance" element={protect('finance', <FinancePage />)} />
        <Route path="finance/pnl" element={protect('finance', <ReportsPage pnl />)} />
        <Route path="reports" element={protect('reports', <ReportsPage />)} />
        <Route path="settings" element={protect('settings', <SettingsPage />)} />
        <Route path="settings/users" element={protect('settings', <UsersPage />)} />
        <Route path="settings/workspace" element={protect('settings', <WorkspacePage />)} />
        <Route path="settings/opening" element={protect('settings', <OpeningPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<div className="login-screen">Memuat modul...</div>}>
          <AuthenticatedApp />
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
