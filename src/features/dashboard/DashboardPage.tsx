import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Wallet,
  Boxes,
  Landmark,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { subDays, format } from 'date-fns';
import { useRows } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { rupiah, today, date } from '../../lib/formatting';
import { PageHeader, Stat, Badge, Loading, ErrorState } from '../../components/ui/common';
import { SalesChart } from '../../components/charts/SalesChart';
import { DataTable } from '../../components/tables/DataTable';
import { money, status } from '../../pages/resources';
import { sumMoney, subtractMoney } from '../../lib/money';
export function DashboardPage() {
  const { member, permissions } = useAuth();
  const finance = can(member, permissions, 'finance'),
    position = useRows('v_business_position', {}, finance),
    balances = useRows('v_account_balances', {}, finance),
    stock = useRows('v_low_stock'),
    deposits = useRows('v_deposit_forecast'),
    orders = useRows('sales_orders'),
    items = useRows('sales_order_items'),
    receivables = useRows('v_customer_receivables'),
    reconciliation = useRows('v_reconciliation_candidates');
  const rows = orders.data ?? [],
    posted = rows.filter((r) => r.status === 'POSTED'),
    dayOrders = posted.filter((r) => r.order_date === today()),
    p = position.data ?? [];
  const amount = (source: string) =>
    sumMoney(p.filter((r) => r.source === source).map((r) => r.amount));
  const assets = sumMoney(p.filter((r) => r.position_type === 'ASSET').map((r) => r.amount)),
    liabilities = sumMoney(p.filter((r) => r.position_type === 'LIABILITY').map((r) => r.amount)),
    cash = sumMoney(
      (balances.data ?? [])
        .filter((r) => ['BANK', 'CASH', 'MARKETPLACE_LIQUID'].includes(String(r.account_type)))
        .map((r) => r.amount_idr),
    );
  const chart = Array.from({ length: 14 }, (_, i) => {
    const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
    return {
      date: d.slice(8) + '/' + d.slice(5, 7),
      revenue: posted
        .filter((r) => r.order_date === d)
        .reduce((s, r) => s + Number(r.grand_total), 0),
    };
  });
  const alerts = [
    {
      title: 'SKU perlu restock',
      value: stock.data?.filter((r) => r.stock_status !== 'Aman').length ?? 0,
      to: '/inventory',
      detail: 'Tinjau stok minimum dan kebutuhan lokal',
    },
    {
      title: 'Deposit menipis',
      value:
        deposits.data?.filter((r) => r.runway_7d !== null && Number(r.runway_7d) <= 7).length ?? 0,
      to: '/deposits',
      detail: 'Estimasi pemakaian tersisa ≤7 hari',
    },
    {
      title: 'Pesanan Shopee draft',
      value: rows.filter((r) => r.channel === 'SHOPEE' && r.status === 'DRAFT').length,
      to: '/shopee/orders',
      detail: 'Periksa alokasi sebelum posting',
    },
    {
      title: 'Kandidat rekonsiliasi',
      value: reconciliation.data?.length ?? 0,
      to: '/reconciliation',
      detail: 'Konfirmasi hubungan dropship',
    },
    {
      title: 'Invoice jatuh tempo',
      value: receivables.data?.filter((r) => r.payment_status === 'OVERDUE').length ?? 0,
      to: '/invoices',
      detail: 'Tindak lanjuti tagihan pelanggan',
    },
  ];
  if (
    [
      stock,
      deposits,
      orders,
      items,
      receivables,
      reconciliation,
      ...(finance ? [position, balances] : []),
    ].some((q) => q.isLoading)
  )
    return <Loading />;
  const error = [
    stock,
    deposits,
    orders,
    items,
    receivables,
    reconciliation,
    position,
    balances,
  ].find((q) => q.error)?.error;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader
        eyebrow="RINGKASAN BISNIS"
        title="Dashboard"
        description={`Selamat datang kembali. Berikut aktivitas Luminails hari ini.`}
        actions={<div className="date-pill">{date(today())}</div>}
      />
      {finance && (
        <>
          <div className="position-hero">
            <div>
              <span className="eyebrow">POSISI BERSIH BISNIS</span>
              <div className="hero-value">{rupiah(subtractMoney(assets, liabilities))}</div>
              <p>Total aset dikurangi kewajiban · posisi terkini</p>
            </div>
            <Link to="/finance" className="hero-link">
              Lihat rincian <ArrowUpRight size={18} />
            </Link>
            <div className="hero-decoration">L</div>
          </div>
          <div className="stats-grid five">
            {[
              { label: 'Kas likuid', value: cash, to: '/finance', icon: Wallet },
              {
                label: 'Nilai persediaan',
                value: amount('INVENTORY'),
                to: '/inventory',
                icon: Boxes,
              },
              {
                label: 'Deposit supplier',
                value: amount('DEPOSIT'),
                to: '/deposits',
                icon: Landmark,
              },
              {
                label: 'Piutang',
                value: amount('RECEIVABLE'),
                to: '/finance/receivables',
                icon: Receipt,
              },
              { label: 'Kewajiban', value: liabilities, to: '/finance', icon: Landmark },
            ].map((s) => (
              <Link key={s.label} to={s.to}>
                <Stat label={s.label} value={rupiah(s.value)} icon={<s.icon size={17} />} />
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-bar">
            <div>
              <h2>Aktivitas penjualan</h2>
              <p className="muted text-xs">
                14 hari terakhir · transaksi diposting yang dapat Anda akses
              </p>
            </div>
            <Badge>14 hari</Badge>
          </div>
          <div className="mini-stats">
            <div>
              <span>Penjualan hari ini</span>
              <strong>{rupiah(dayOrders.reduce((s, r) => s + Number(r.grand_total), 0))}</strong>
            </div>
            <div>
              <span>Pesanan hari ini</span>
              <strong>{dayOrders.length}</strong>
            </div>
            <div>
              <span>Unit terjual hari ini</span>
              <strong>
                {items.data
                  ?.filter((i) => dayOrders.some((o) => o.id === i.sales_order_id))
                  .reduce((s, i) => s + Number(i.qty), 0) ?? 0}
              </strong>
            </div>
          </div>
          <SalesChart data={chart} />
        </section>
        <section className="panel">
          <div className="section-bar">
            <h2>Perlu perhatian</h2>
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div className="alert-list">
            {alerts.map((a) => (
              <Link key={a.title} to={a.to}>
                <span className={`alert-number ${a.value ? 'alert-active' : ''}`}>{a.value}</span>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="section-bar mt-7">
        <h2>Pesanan terbaru</h2>
        <Link to="/whatsapp-orders" className="text-link">
          Lihat pesanan <ArrowRight size={15} />
        </Link>
      </div>
      <DataTable
        searchable={false}
        rows={[...rows]
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, 5)}
        columns={[
          {
            key: 'order_number',
            label: 'Nomor pesanan',
            render: (v) => (
              <span className="inline-flex items-center gap-2">
                <ShoppingBag size={15} />
                {String(v)}
              </span>
            ),
          },
          { key: 'order_date', label: 'Tanggal' },
          { key: 'channel', label: 'Kanal' },
          money('grand_total', 'Total'),
          status(),
        ]}
      />
    </>
  );
}
