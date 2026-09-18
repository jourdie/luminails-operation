import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { PageHeader, Loading, ErrorState } from '../../components/ui/common';
import { DataTable } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { RecordForm } from '../../components/forms/RecordForm';
import { money, text, status } from '../../pages/resources';
import { SupplierOrderEditor, supplierOrderTypes } from './SupplierOrderEditor';
import type { Row } from '../../types/domain';
export function ProcurementPage() {
  const data = useRows('procurement_orders'),
    suppliers = useRows('suppliers'),
    items = useRows('procurement_items'),
    skus = useRows('skus'),
    command = useCommand(),
    { member, permissions } = useAuth();
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Row>(),
    [detail, setDetail] = useState<Row>(),
    [shipment, setShipment] = useState<Row>(),
    [action, setAction] = useState<{ name: string; id: string; label: string }>();
  const allowed = (a: 'create' | 'edit' | 'post') => can(member, permissions, 'deposits', a);
  return (
    <>
      <PageHeader
        title="Restock & Dropship"
        description="Posting memotong deposit. Stok restock masuk setelah penerimaan dikonfirmasi."
        actions={
          allowed('create') && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus size={16} />
              Pesanan supplier
            </Button>
          )
        }
      />
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} />
      ) : (
        <DataTable
          rows={data.data ?? []}
          columns={[
            { key: 'order_number', label: 'Nomor pesanan' },
            { key: 'order_date', label: 'Tanggal' },
            {
              key: 'order_type',
              label: 'Tipe pesanan',
              render: (v) => supplierOrderTypes[String(v)] ?? String(v),
            },
            {
              key: 'supplier_id',
              label: 'Supplier',
              render: (v) => String(suppliers.data?.find((s) => s.id === v)?.name ?? v),
            },
            { key: 'external_order_number', label: 'Nomor eksternal' },
            { key: 'tracking_number', label: 'Resi' },
            status(),
          ]}
          actions={(r) => (
            <div className="actions flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                Rincian
              </Button>
              {r.status === 'DRAFT' && allowed('edit') && (
                <>
                  {!r.source_sales_order_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAction({
                        id: String(r.id),
                        name: 'cancel_draft',
                        label: 'Batalkan draft supplier',
                      })
                    }
                  >
                    Batalkan
                  </Button>
                </>
              )}
              {r.status === 'DRAFT' && allowed('post') && (
                <Button
                  size="sm"
                  onClick={() =>
                    setAction({
                      id: String(r.id),
                      name: 'post_procurement_order',
                      label: 'Posting dan potong deposit',
                    })
                  }
                >
                  Posting
                </Button>
              )}
              {r.status === 'POSTED' && allowed('post') && (
                <Button size="sm" variant="outline" onClick={() => setShipment(r)}>
                  Kirim
                </Button>
              )}
              {['POSTED', 'SHIPPED'].includes(String(r.status)) &&
                can(member, permissions, 'inventory', 'post') && (
                  <Button
                    size="sm"
                    onClick={() =>
                      setAction({
                        id: String(r.id),
                        name: 'receive_procurement_order',
                        label: 'Konfirmasi barang diterima',
                      })
                    }
                  >
                    Terima barang
                  </Button>
                )}
              {['POSTED', 'SHIPPED', 'RECEIVED'].includes(String(r.status)) && allowed('post') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setAction({
                      id: String(r.id),
                      name: 'reverse_procurement_order',
                      label: 'Balik pembelian supplier',
                    })
                  }
                >
                  Balik
                </Button>
              )}
            </div>
          )}
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit draft supplier' : 'Pesanan supplier baru'}
        description="Buat draft dengan satu atau beberapa SKU. Modal berasal dari versi supplier."
        wide
      >
        {open && (
          <SupplierOrderEditor
            key={editing?.id ?? 'new'}
            order={editing}
            onSaved={() => setOpen(false)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={() => setDetail(undefined)}
        title={String(detail?.order_number ?? 'Rincian')}
        wide
      >
        {!!detail?.shipping_snapshot && (
          <div className="panel mb-4">
            <h2>Alamat pengiriman</h2>
            {Object.entries(detail.shipping_snapshot as Record<string, unknown>)
              .filter(
                ([key, value]) =>
                  [
                    'recipient',
                    'phone',
                    'address',
                    'city',
                    'province',
                    'shipping_option',
                    'buyer_notes',
                    'branch_name',
                  ].includes(key) && Boolean(value),
              )
              .map(([key, value]) => (
                <p key={key}>{String(value)}</p>
              ))}
          </div>
        )}
        <DataTable
          rows={items.data?.filter((i) => i.procurement_order_id === detail?.id) ?? []}
          columns={[
            {
              key: 'sku_id',
              label: 'SKU',
              render: (v) => String(skus.data?.find((s) => s.id === v)?.sku_code ?? v),
            },
            { key: 'qty', label: 'Qty' },
            { key: 'destination_type', label: 'Tujuan' },
            money('unit_cost_snapshot', 'Modal snapshot'),
          ]}
        />
      </Dialog>
      <Dialog
        open={!!shipment}
        onOpenChange={() => setShipment(undefined)}
        title="Konfirmasi pengiriman"
      >
        <RecordForm
          fields={[text('tracking_number', 'Nomor resi')]}
          pending={command.isPending}
          onSubmit={async (payload) => {
            await command.mutateAsync({
              name: 'mark_procurement_shipped',
              args: { record_id: shipment?.id, payload },
            });
            setShipment(undefined);
          }}
        />
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={() => setAction(undefined)}
        title={action?.label ?? ''}
        description="Tindakan ini dicatat di audit log. Posting dan pembalikan mengubah ledger secara atomik."
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            try {
              if (action)
                await command.mutateAsync({
                  name: action.name,
                  args: {
                    record_id: action.id,
                    ...(action.name === 'cancel_draft' ? { entity: 'procurement_orders' } : {}),
                  },
                });
              setAction(undefined);
            } catch {
              /* mutation reports error */
            }
          }}
        >
          Konfirmasi
        </Button>
      </Dialog>
    </>
  );
}
