import { useEffect, useState } from 'react';
import { subDays, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { toast } from 'sonner';
import { useRows } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { rupiah, today } from '../../lib/formatting';
import { PageHeader, Stat, Loading, ErrorState } from '../../components/ui/common';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { SalesChart } from '../../components/charts/SalesChart';
import { money } from '../../pages/resources';
import { sumMoney, subtractMoney, moneyRatio } from '../../lib/money';
const reports: Record<
  string,
  {
    table: string;
    columns: Column[];
    date?: string;
    module: 'finance' | 'inventory' | 'deposits' | 'b2b' | 'reseller';
  }
> = {
  'Performa SKU': {
    table: 'v_sku_performance',
    module: 'finance',
    date: 'order_date',
    columns: [
      { key: 'sku_code', label: 'SKU' },
      { key: 'name', label: 'Produk' },
      { key: 'order_date', label: 'Tanggal' },
      { key: 'channel', label: 'Kanal' },
      { key: 'units', label: 'Unit' },
      money('net_sales', 'Penjualan bersih'),
      money('cogs', 'HPP'),
      money('gross_profit', 'Laba kotor'),
    ],
  },
  'B2B & Reseller': {
    table: 'v_customer_pnl',
    module: 'finance',
    columns: [
      { key: 'customer_id', label: 'Pelanggan' },
      { key: 'channel', label: 'Kanal' },
      money('revenue', 'Pendapatan'),
      money('cogs', 'HPP'),
      money('gross_profit', 'Laba kotor'),
      { key: 'gross_margin', label: 'Margin %' },
    ],
  },
  'Penjualan & Laba Kotor': {
    table: 'v_sales_pnl',
    module: 'finance',
    date: 'order_date',
    columns: [
      { key: 'order_date', label: 'Tanggal' },
      { key: 'order_number', label: 'Pesanan' },
      { key: 'channel', label: 'Kanal' },
      money('revenue', 'Harga normal'),
      money('discounts', 'Diskon'),
      money('net_sales', 'Penjualan bersih'),
      money('cogs', 'HPP'),
      money('gross_profit', 'Laba kotor'),
    ],
  },
  'Pergerakan Stok': {
    table: 'inventory_movements',
    module: 'inventory',
    date: 'transaction_date',
    columns: [
      { key: 'transaction_date', label: 'Tanggal' },
      { key: 'sku_id', label: 'SKU' },
      { key: 'movement_type', label: 'Jenis' },
      { key: 'qty_delta', label: 'Qty' },
      money('unit_cost', 'Modal'),
    ],
  },
  'Nilai Persediaan': {
    table: 'v_low_stock',
    module: 'inventory',
    columns: [
      { key: 'sku_code', label: 'SKU' },
      { key: 'name', label: 'Produk' },
      { key: 'current_stock', label: 'Stok' },
      money('inventory_value', 'Nilai stok'),
    ],
  },
  'Pemakaian Supplier': {
    table: 'v_supplier_usage_daily',
    module: 'deposits',
    date: 'transaction_date',
    columns: [
      { key: 'transaction_date', label: 'Tanggal' },
      { key: 'supplier_id', label: 'Supplier' },
      money('usage', 'Pemakaian'),
    ],
  },
  'Riwayat Deposit': {
    table: 'supplier_deposit_entries',
    module: 'deposits',
    date: 'transaction_date',
    columns: [
      { key: 'transaction_date', label: 'Tanggal' },
      { key: 'entry_type', label: 'Jenis' },
      money('amount', 'Jumlah'),
    ],
  },
  'Estimasi Deposit': {
    table: 'v_deposit_forecast',
    module: 'deposits',
    columns: [
      { key: 'name', label: 'Supplier' },
      money('balance', 'Saldo'),
      money('daily_7d', 'Pemakaian harian'),
      { key: 'runway_7d', label: 'Estimasi hari' },
    ],
  },
  Piutang: {
    table: 'v_customer_receivables',
    module: 'finance',
    date: 'invoice_date',
    columns: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'due_date', label: 'Jatuh tempo' },
      money('outstanding', 'Sisa tagihan'),
    ],
  },
  'Posisi Bisnis': {
    table: 'v_business_position',
    module: 'finance',
    columns: [
      { key: 'category', label: 'Komponen' },
      { key: 'position_type', label: 'Jenis' },
      money('amount', 'Nilai'),
    ],
  },
};
export function ReportsPage({
  pnl = false,
  reseller = false,
}: {
  pnl?: boolean;
  reseller?: boolean;
}) {
  const [report, setReport] = useState('Penjualan & Laba Kotor'),
    [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd')),
    [to, setTo] = useState(today()),
    [metric, setMetric] = useState<'revenue' | 'profit' | 'units'>('revenue');
  const config = reports[report],
    data = useRows(config.table),
    expenses = useRows('expenses', {}, pnl),
    items = useRows('sales_order_items', {}, reseller),
    customerRows = useRows('customers', { customer_type: 'RESELLER' }, reseller),
    receivableRows = useRows('v_customer_receivables', {}, reseller),
    { member, permissions } = useAuth();
  useEffect(() => {
    if (!can(member, permissions, config.module)) {
      const first = Object.keys(reports).find((k) => can(member, permissions, reports[k].module));
      if (first) setReport(first);
    }
  }, [member, permissions, config.module]);
  const rows = (data.data ?? []).filter(
    (r) =>
      (!config.date || (String(r[config.date]) >= from && String(r[config.date]) <= to)) &&
      (!reseller || r.channel === 'RESELLER'),
  );
  const sum = (key: string) => sumMoney(rows.map((r) => r[key]));
  const cost = sumMoney(
    (expenses.data ?? [])
      .filter(
        (r) =>
          String(r.expense_date) >= from && String(r.expense_date) <= to && r.status === 'POSTED',
      )
      .map((r) => r.amount),
  );
  const chart = [...new Set(rows.map((r) => String(r.order_date)))].sort().map((d) => ({
    date: d.slice(5),
    revenue: rows
      .filter((r) => r.order_date === d)
      .reduce((s, r) => s + Number(r.net_sales ?? 0), 0),
    profit: rows
      .filter((r) => r.order_date === d)
      .reduce((s, r) => s + Number(r.gross_profit ?? 0), 0),
    units: rows
      .filter((r) => r.order_date === d)
      .reduce(
        (s, r) =>
          s +
          (items.data ?? [])
            .filter((i) => i.sales_order_id === r.sales_order_id)
            .reduce((n, i) => n + Number(i.qty), 0),
        0,
      ),
  }));
  async function exportRows(csv = false) {
    try {
      const x = await import('../../lib/exports/excel');
      if (csv) x.exportCsv(report, config.columns, rows);
      else await x.exportTable(report, config.columns, rows);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} />;
  return (
    <>
      <PageHeader
        title={pnl ? 'Laba Rugi' : reseller ? 'Analitik Reseller' : 'Laporan'}
        description="Data operasional yang dapat ditelusuri ke transaksi sumber."
        actions={
          can(member, permissions, config.module, 'export') &&
          can(
            member,
            permissions,
            reseller ? 'reseller' : pnl ? 'finance' : 'reports',
            'export',
          ) && (
            <>
              <Button variant="outline" onClick={() => void exportRows(true)}>
                CSV
              </Button>
              <Button onClick={() => void exportRows()}>Export Excel</Button>
            </>
          )
        }
      />
      <div className="filters">
        {!pnl && !reseller && (
          <select
            aria-label="Jenis laporan"
            value={report}
            onChange={(e) => setReport(e.target.value)}
          >
            {Object.keys(reports)
              .filter((k) => can(member, permissions, reports[k].module))
              .map((k) => (
                <option key={k}>{k}</option>
              ))}
          </select>
        )}
        <select
          aria-label="Periode laporan"
          defaultValue="30"
          onChange={(e) => {
            const v = e.target.value,
              n = new Date();
            setFrom(
              format(
                v === 'month'
                  ? startOfMonth(n)
                  : v === 'previous'
                    ? startOfMonth(subMonths(n, 1))
                    : subDays(n, Number(v) - 1),
                'yyyy-MM-dd',
              ),
            );
            setTo(v === 'previous' ? format(endOfMonth(subMonths(n, 1)), 'yyyy-MM-dd') : today());
          }}
        >
          <option value="1">Hari ini</option>
          <option value="7">7 hari</option>
          <option value="30">30 hari</option>
          <option value="month">Bulan ini</option>
          <option value="previous">Bulan lalu</option>
        </select>
        <input
          aria-label="Dari tanggal"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span>—</span>
        <input
          aria-label="Sampai tanggal"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {report === 'Penjualan & Laba Kotor' && (
        <>
          <div className="stats-grid">
            <Stat label="Penjualan bersih" value={rupiah(sum('net_sales'))} />
            <Stat label="HPP" value={rupiah(sum('cogs'))} />
            <Stat
              label="Laba kotor"
              value={rupiah(sum('gross_profit'))}
              detail={`Margin ${((moneyRatio(sum('gross_profit'), sum('net_sales')) ?? 0) * 100).toFixed(1)}%`}
            />
            {pnl && (
              <Stat
                label="Laba operasional tercatat"
                value={rupiah(subtractMoney(sum('gross_profit'), sum('marketplace_fee'), cost))}
                detail={`Biaya operasional: ${rupiah(cost)}`}
              />
            )}
            {reseller && (
              <>
                <Stat label="Unit terjual" value={chart.reduce((n, r) => n + r.units, 0)} />
                <Stat
                  label="Piutang reseller terkini"
                  value={rupiah(
                    sumMoney(
                      (receivableRows.data ?? [])
                        .filter((r) => customerRows.data?.some((c) => c.id === r.customer_id))
                        .map((r) => r.outstanding),
                    ),
                  )}
                />
              </>
            )}
          </div>
          {rows.some((r) => r.fee_data_missing) && (
            <div className="notice mb-5">
              Data biaya marketplace belum lengkap. Laba operasional hanya memperhitungkan biaya
              yang tersedia.
            </div>
          )}
          <div className="panel mb-5">
            <div className="section-bar">
              <h2>Tren periode</h2>
              {reseller && (
                <select
                  aria-label="Metrik analitik"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as typeof metric)}
                >
                  <option value="revenue">Pendapatan</option>
                  <option value="profit">Laba kotor</option>
                  <option value="units">Unit</option>
                </select>
              )}
            </div>
            <SalesChart data={chart} metric={metric} />
          </div>
        </>
      )}
      <DataTable rows={rows} columns={config.columns} />
      {!config.date && (
        <p className="muted text-xs mt-3">
          Laporan ini menunjukkan posisi saat ini; filter tanggal tidak berlaku.
        </p>
      )}
    </>
  );
}
