import { Link } from 'react-router-dom';
import { useRows } from '../../hooks/useData';
import { rupiah } from '../../lib/formatting';
import { PageHeader, Stat, ErrorState, Badge, Loading } from '../../components/ui/common';
import { sumMoney, subtractMoney, moneyRatio } from '../../lib/money';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { money } from '../../pages/resources';
export function FinancePage() {
  const position = useRows('v_business_position'),
    balances = useRows('v_account_balances');
  const rows = position.data ?? [],
    sum = (type: string) =>
      sumMoney(rows.filter((r) => r.position_type === type).map((r) => r.amount)),
    assets = sum('ASSET'),
    liabilities = sum('LIABILITY'),
    cash = sumMoney(
      (balances.data ?? [])
        .filter((a) => ['BANK', 'CASH', 'MARKETPLACE_LIQUID'].includes(String(a.account_type)))
        .map((a) => a.amount_idr),
    );
  const ratios = [
    {
      label: 'Rasio likuiditas',
      formula: 'Kas likuid ÷ kewajiban',
      value: moneyRatio(cash, liabilities),
      good: 2,
      bad: 1,
      inverse: false,
    },
    {
      label: 'Rasio utang',
      formula: 'Kewajiban ÷ total aset',
      value: moneyRatio(liabilities, assets),
      good: 0.3,
      bad: 0.6,
      inverse: true,
    },
    ...['DEPOSIT', 'INVENTORY', 'RECEIVABLE'].map((source, i) => ({
      label: ['Eksposur deposit', 'Eksposur persediaan', 'Eksposur piutang'][i],
      formula: 'Nilai aset terkait ÷ total aset',
      value: moneyRatio(
        sumMoney(rows.filter((r) => r.source === source).map((r) => r.amount)),
        assets,
      ),
      good: 0.3,
      bad: 0.5,
      inverse: true,
    })),
  ];
  if (position.isLoading || balances.isLoading) return <Loading />;
  if (position.error || balances.error)
    return <ErrorState error={position.error ?? balances.error} />;
  return (
    <>
      <PageHeader
        title="Posisi Bisnis"
        description="Aset dikurangi kewajiban pada posisi terkini. Laba rugi tersedia pada halaman terpisah."
        actions={
          <Button asChild variant="outline">
            <Link to="/finance/pnl">Lihat laba rugi</Link>
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Posisi bersih bisnis"
          value={rupiah(subtractMoney(assets, liabilities))}
          detail="Total aset − total kewajiban"
        />
        <Stat label="Total aset" value={rupiah(assets)} />
        <Stat label="Total kewajiban" value={rupiah(liabilities)} />
      </div>
      <div className="notice mb-5">
        Saldo akun memakai snapshot terakhir hingga hari ini. Deposit, stok, dan piutang berasal
        dari ledger. Pembayaran dan biaya tidak otomatis mengubah snapshot bank.
      </div>
      {balances.data?.some((r) => !r.snapshot_date) && (
        <p className="notice mb-5">Ada akun tanpa snapshot; nilai posisi belum lengkap.</p>
      )}
      <DataTable
        rows={rows}
        columns={[
          { key: 'category', label: 'Komponen' },
          { key: 'position_type', label: 'Jenis' },
          money('amount', 'Nilai'),
        ]}
      />
      <h2 className="section-heading">Kesehatan bisnis</h2>
      <div className="health-grid">
        {ratios.map((r) => {
          const label =
            r.value === null
              ? 'Belum tersedia'
              : r.inverse
                ? r.value <= r.good
                  ? 'Hijau'
                  : r.value < r.bad
                    ? 'Kuning'
                    : 'Merah'
                : r.value >= r.good
                  ? 'Hijau'
                  : r.value > r.bad
                    ? 'Kuning'
                    : 'Merah';
          return (
            <div className="panel" key={r.label}>
              <div className="section-bar">
                <strong>{r.label}</strong>
                <Badge>{label}</Badge>
              </div>
              <div className="stat-value">
                {r.value === null
                  ? '—'
                  : `${(r.value * (r.inverse ? 100 : 1)).toFixed(1)}${r.inverse ? '%' : '×'}`}
              </div>
              <p className="muted text-xs">{r.formula}</p>
              <p className="muted text-xs mt-2">
                Ambang internal: hijau {r.inverse ? '≤' : '≥'} {r.good}; merah{' '}
                {r.inverse ? '≥' : '≤'} {r.bad}. Indikator operasional, bukan prediksi.
              </p>
            </div>
          );
        })}
      </div>
      <h2 className="section-heading">Tanggal snapshot akun</h2>
      <DataTable
        rows={balances.data ?? []}
        columns={[
          { key: 'name', label: 'Akun' },
          { key: 'snapshot_date', label: 'Snapshot terakhir' },
          { key: 'currency', label: 'Mata uang' },
          money('amount_idr', 'Nilai IDR'),
        ]}
      />
    </>
  );
}
