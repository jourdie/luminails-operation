import { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { rupiah, number } from '../../lib/formatting';
import { PageHeader, Stat, ErrorState, Loading, Badge } from '../../components/ui/common';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { RecordForm } from '../../components/forms/RecordForm';
import { day, money, options, select, text } from '../../pages/resources';
export function DepositsPage() {
  const forecast = useRows('v_deposit_forecast'),
    entries = useRows('supplier_deposit_entries'),
    command = useCommand(),
    { member, permissions } = useAuth();
  const [open, setOpen] = useState(false),
    [reverse, setReverse] = useState<string>();
  const canPost = can(member, permissions, 'deposits', 'post');
  return (
    <>
      <PageHeader
        title="Deposit Supplier"
        description="Saldo dari ledger. Setiap pembelian, top up, dan pembalikan dapat ditelusuri."
        actions={
          canPost && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Catat deposit
            </Button>
          )
        }
      />
      {forecast.isLoading ? (
        <Loading />
      ) : forecast.error ? (
        <ErrorState error={forecast.error} />
      ) : (
        <div className="stats-grid">
          {forecast.data?.map((r) => (
            <Stat
              key={String(r.supplier_id)}
              label={String(r.name)}
              value={rupiah(String(r.balance))}
              icon={<Wallet size={19} />}
              detail={
                r.runway_7d
                  ? `Estimasi cukup ${number(String(r.runway_7d))} hari`
                  : 'Belum ada pemakaian 7 hari'
              }
            />
          ))}
        </div>
      )}
      <h2 className="section-heading">Estimasi kebutuhan deposit</h2>
      <DataTable
        rows={forecast.data ?? []}
        columns={[
          { key: 'name', label: 'Supplier' },
          money('balance', 'Saldo'),
          money('spend_7d', 'Pemakaian 7D'),
          money('spend_30d', 'Pemakaian 30D'),
          money('daily_7d', 'Rata-rata / hari 7D'),
          { key: 'runway_30d', label: 'Runway 30D (hari)' },
          { key: 'suggested_deposit_date', label: 'Saran tanggal top up' },
        ]}
      />
      <p className="muted text-xs mt-3">
        Estimasi = saldo ÷ rata-rata pemakaian. Saran top up memperhitungkan lead time supplier;
        bukan tanggal pasti.
      </p>
      <h2 className="section-heading">Riwayat transaksi</h2>
      {entries.error ? (
        <ErrorState error={entries.error} />
      ) : (
        <DataTable
          rows={entries.data ?? []}
          columns={[
            { key: 'transaction_date', label: 'Tanggal' },
            {
              key: 'supplier_id',
              label: 'Supplier',
              render: (v) => String(forecast.data?.find((r) => r.supplier_id === v)?.name ?? '—'),
            },
            { key: 'entry_type', label: 'Jenis' },
            money('amount', 'Jumlah'),
            { key: 'status', label: 'Status', render: (v) => <Badge>{String(v)}</Badge> },
            { key: 'notes', label: 'Catatan' },
          ]}
          actions={
            canPost
              ? (r) =>
                  r.status === 'POSTED' && !r.reference_id && r.entry_type !== 'REVERSAL' ? (
                    <Button variant="ghost" size="sm" onClick={() => setReverse(String(r.id))}>
                      Balik
                    </Button>
                  ) : null
              : undefined
          }
        />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Catat deposit supplier">
        <RecordForm
          fields={[
            select('supplier_id', 'Supplier', 'suppliers'),
            day('transaction_date', 'Tanggal'),
            options('entry_type', 'Jenis', [
              'TOPUP',
              'OPENING',
              'REFUND',
              'ADJUSTMENT_IN',
              'ADJUSTMENT_OUT',
            ]),
            { key: 'amount', label: 'Nominal positif (IDR)', type: 'decimal', required: true },
            text('notes', 'Catatan', false),
          ]}
          confirmation="Transaksi ini langsung diposting ke ledger deposit. Konfirmasi jenis dan jumlah sebelum melanjutkan."
          pending={command.isPending}
          onSubmit={async (payload) => {
            await command.mutateAsync({ name: 'post_supplier_deposit_topup', args: { payload } });
            setOpen(false);
          }}
        />
      </Dialog>
      <Dialog
        open={!!reverse}
        onOpenChange={() => setReverse(undefined)}
        title="Balik transaksi deposit"
        description="Entri lawan akan dibuat. Riwayat asli tetap tersimpan."
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            await command.mutateAsync({
              name: 'reverse_supplier_deposit_entry',
              args: { record_id: reverse },
            });
            setReverse(undefined);
          }}
        >
          Konfirmasi pembalikan
        </Button>
      </Dialog>
    </>
  );
}
