import { useState } from 'react';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { PageHeader, ErrorState } from '../../components/ui/common';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { status } from '../../pages/resources';
import type { Row } from '../../types/domain';
export function ReconciliationPage() {
  const candidates = useRows('v_reconciliation_candidates'),
    summary = useRows('v_reconciliation_status'),
    skus = useRows('skus'),
    suppliers = useRows('suppliers'),
    links = useRows('reconciliation_links'),
    command = useCommand(),
    { member, permissions } = useAuth();
  const [selected, setSelected] = useState<Row>();
  const [rejecting, setRejecting] = useState(false);
  return (
    <>
      <PageHeader
        title="Rekonsiliasi Dropship"
        description="Hubungkan pembelian manual yang sudah diposting dengan item penjualan, agar deposit tidak terpotong dua kali."
      />
      <div className="notice mb-5">
        Kandidat berdasarkan nomor eksternal atau SKU dan tanggal ±3 hari. Semua hubungan perlu
        dikonfirmasi. Qty alokasi supplier harus sama dengan qty pembelian.
      </div>
      {candidates.error ? (
        <ErrorState error={candidates.error} />
      ) : (
        <DataTable
          rows={candidates.data ?? []}
          columns={[
            { key: 'order_number', label: 'Pesanan' },
            { key: 'external_order_number', label: 'Nomor eksternal' },
            {
              key: 'sku_id',
              label: 'SKU',
              render: (v) => String(skus.data?.find((s) => s.id === v)?.sku_code ?? v),
            },
            {
              key: 'supplier_id',
              label: 'Supplier',
              render: (v) => String(suppliers.data?.find((s) => s.id === v)?.name ?? v),
            },
            { key: 'sold_qty', label: 'Qty terjual' },
            { key: 'procurement_qty', label: 'Qty pembelian' },
            { key: 'order_date', label: 'Tanggal supplier' },
            { key: 'tracking_number', label: 'Resi' },
            status('match_status'),
          ]}
          actions={
            can(member, permissions, 'reconciliation', 'post')
              ? (r) => (
                  <div className="actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejecting(false);
                        setSelected(r);
                      }}
                    >
                      Tinjau pasangan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejecting(true);
                        setSelected(r);
                      }}
                    >
                      Transaksi berbeda
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      )}
      <h2 className="section-heading">Status item dropship</h2>
      <DataTable
        rows={summary.data ?? []}
        columns={[
          { key: 'order_number', label: 'Pesanan' },
          {
            key: 'sku_id',
            label: 'SKU',
            render: (v) => String(skus.data?.find((s) => s.id === v)?.sku_code ?? v),
          },
          { key: 'qty', label: 'Qty' },
          status(),
        ]}
      />
      <h2 className="section-heading">Hubungan rekonsiliasi</h2>
      <DataTable
        rows={links.data ?? []}
        columns={[
          { key: 'sales_order_item_id', label: 'Item pesanan' },
          { key: 'procurement_item_id', label: 'Item supplier' },
          status(),
          { key: 'confirmed_at', label: 'Dikonfirmasi' },
        ]}
      />
      <Dialog
        open={!!selected}
        onOpenChange={() => setSelected(undefined)}
        title={rejecting ? 'Konfirmasi transaksi berbeda' : 'Konfirmasi pasangan dropship'}
        description={
          rejecting
            ? 'Kandidat ini ditandai sebagai transaksi berbeda. Posting akan membuat pembelian dan potongan deposit baru. Keputusan ini dicatat di audit log.'
            : 'Pastikan SKU, supplier, qty, tanggal, dan resi merujuk pembelian yang sama. Posting penjualan akan memakai modal pembelian ini tanpa potongan deposit baru.'
        }
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({
                name: rejecting ? 'reject_reconciliation' : 'confirm_reconciliation',
                args: {
                  payload: {
                    sales_order_item_id: selected?.sales_order_item_id,
                    procurement_item_id: selected?.procurement_item_id,
                  },
                },
              });
              setSelected(undefined);
            } catch {
              /* mutation reports error */
            }
          }}
        >
          {rejecting ? 'Ya, transaksi berbeda' : 'Ya, hubungkan transaksi'}
        </Button>
      </Dialog>
    </>
  );
}
