import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  Wallet,
  Boxes,
  ShoppingBag,
  GitCompareArrows,
  MessageCircle,
  Users,
  Building2,
  Receipt,
  Landmark,
  ChartNoAxesCombined,
  Settings,
  PanelLeftClose,
  Menu,
  Search,
  LogOut,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthProvider';
import { can } from '../../lib/permissions';
import { localMode, supabase } from '../../lib/supabase/client';
import type { Module } from '../../types/domain';
const nav = [
  {
    group: 'RINGKASAN',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' }],
  },
  {
    group: 'OPERASIONAL',
    items: [
      { to: '/products', label: 'Produk & SKU', icon: Package, module: 'products' },
      { to: '/suppliers', label: 'Supplier', icon: Truck, module: 'suppliers' },
      { to: '/deposits', label: 'Deposit Supplier', icon: Wallet, module: 'deposits' },
      { to: '/procurement', label: 'Restock & Dropship', icon: Truck, module: 'deposits' },
      { to: '/inventory', label: 'Stok', icon: Boxes, module: 'inventory' },
      { to: '/shopee', label: 'Pesanan Shopee', icon: ShoppingBag, module: 'shopee' },
      {
        to: '/reconciliation',
        label: 'Rekonsiliasi',
        icon: GitCompareArrows,
        module: 'reconciliation',
      },
    ],
  },
  {
    group: 'PENJUALAN',
    items: [
      { to: '/whatsapp-orders', label: 'B2B', icon: MessageCircle, module: 'b2b' },
      { to: '/b2b', label: 'B2B Customer List', icon: Building2, module: 'b2b' },
      { to: '/promotions', label: 'Promotion Rule', icon: Receipt, module: 'b2b' },
      { to: '/reseller/orders', label: 'Reseller Transaction', icon: MessageCircle, module: 'reseller' },
      { to: '/reseller', label: 'Reseller List', icon: Users, module: 'reseller' },
    ],
  },
  {
    group: 'BISNIS',
    items: [
      { to: '/finance', label: 'Keuangan', icon: Landmark, module: 'finance' },
      { to: '/reports', label: 'Laporan', icon: ChartNoAxesCombined, module: 'reports' },
      { to: '/settings', label: 'Pengaturan', icon: Settings, module: 'settings' },
    ],
  },
];
const tabs: Record<string, { label: string; to: string; module: Module }[]> = {
  products: [
    { label: 'SKU', to: '/products', module: 'products' },
    { label: 'Produk', to: '/products/master', module: 'products' },
    { label: 'Merek', to: '/products/brands', module: 'products' },
  ],
  suppliers: [
    { label: 'Supplier', to: '/suppliers', module: 'suppliers' },
    { label: 'Versi modal', to: '/suppliers/costs', module: 'suppliers' },
  ],
  b2b: [
    { label: 'Pelanggan', to: '/b2b', module: 'b2b' },
    { label: 'Cabang', to: '/b2b/branches', module: 'b2b' },
    { label: 'Pesanan', to: '/b2b/orders', module: 'b2b' },
  ],
  reseller: [
    { label: 'Reseller', to: '/reseller', module: 'reseller' },
    { label: 'Cabang', to: '/reseller/branches', module: 'reseller' },
    { label: 'Pesanan', to: '/reseller/orders', module: 'reseller' },
    { label: 'Analitik', to: '/reseller/analytics', module: 'finance' },
  ],
  finance: [
    { label: 'Posisi bisnis', to: '/finance', module: 'finance' },
    { label: 'Laba rugi', to: '/finance/pnl', module: 'finance' },
    { label: 'Piutang', to: '/finance/receivables', module: 'finance' },
    { label: 'Pembayaran', to: '/finance/payments', module: 'finance' },
    { label: 'Biaya', to: '/finance/expenses', module: 'finance' },
    { label: 'Akun', to: '/finance/accounts', module: 'finance' },
    { label: 'Snapshot', to: '/finance/snapshots', module: 'finance' },
  ],
};
export function AppLayout() {
  const auth = useAuth(),
    location = useLocation(),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState('');
  const section = location.pathname.split('/')[1],
    matches = nav
      .flatMap((g) => g.items)
      .filter(
        (i) =>
          can(auth.member, auth.permissions, i.module as Module) &&
          i.label.toLowerCase().includes(search.toLowerCase()),
      );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            L
          </span>
          <span>
            Luminails<small>OPERATION</small>
          </span>
          <PanelLeftClose size={17} className="sidebar-close" onClick={() => setMobile(false)} />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">L</span>
          <div>
            <strong>Luminails</strong>
            <small>Internal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        {auth.members.length > 1 && (
          <select
            aria-label="Pilih workspace"
            value={auth.member?.workspace_id}
            onChange={(e) => auth.switchWorkspace(e.target.value)}
          >
            {auth.members.map((m) => (
              <option key={m.id} value={m.workspace_id}>
                {m.workspace_id}
              </option>
            ))}
          </select>
        )}
        <nav className="sidebar-nav">
          {nav.map((g) => (
            <div key={g.group}>
              <div className="nav-group-title">{g.group}</div>
              {g.items
                .filter(
                  (i) =>
                    can(auth.member, auth.permissions, i.module as Module) ||
                    (i.to === '/invoices' && can(auth.member, auth.permissions, 'reseller')),
                )
                .map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    onClick={() => setMobile(false)}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i.icon size={18} />
                    <span>{i.label}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{auth.member?.email[0]?.toUpperCase()}</div>
          <div>
            <strong>{auth.member?.role === 'OWNER' ? 'Pemilik' : 'Anggota'}</strong>
            <small>{auth.member?.email}</small>
          </div>
          <button title="Keluar" onClick={() => void supabase?.auth.signOut()} disabled={!supabase}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobile && <div className="mobile-scrim" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Buka navigasi"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>
              {nav.flatMap((g) => g.items).find((i) => i.to === '/' + section)?.label ??
                'Dashboard'}
            </strong>
          </span>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={15} />
              <input
                aria-label="Cari modul"
                placeholder="Cari modul..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <div className="search-results">
                  {matches.length ? (
                    matches.map((m) => (
                      <Link key={m.to} to={m.to} onClick={() => setSearch('')}>
                        {m.label}
                        <ArrowUpRight size={14} />
                      </Link>
                    ))
                  ) : (
                    <span>Tidak ditemukan</span>
                  )}
                </div>
              )}
            </div>
            <span className="connection">
              <span />
              {localMode ? 'Lokal' : 'Terhubung'}
            </span>
            <div className="avatar small">{auth.member?.email[0]?.toUpperCase()}</div>
          </div>
        </header>
        {localMode && (
          <div className="dev-banner">
            MODE PENGEMBANGAN · Data tersimpan di browser ini. Tidak terhubung ke bisnis produksi.
            <Link to="/settings"> Buka Pengaturan untuk cleansing data.</Link>
          </div>
        )}
        <main className="page-content">
          {tabs[section] && (
            <nav className="page-tabs">
              {tabs[section]
                .filter((t) => can(auth.member, auth.permissions, t.module))
                .map((t) => (
                  <NavLink key={t.to} to={t.to} end>
                    {t.label}
                  </NavLink>
                ))}
            </nav>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          Luminails Operation <span>Setiap transaksi, tercatat.</span>
        </footer>
      </div>
    </div>
  );
}
