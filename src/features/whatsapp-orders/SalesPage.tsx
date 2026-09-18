import { useState } from 'react';
import { Plus, FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can, salesModule } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { listRows } from '../../lib/supabase/gateway';
import { rupiah, today } from '../../lib/formatting';
import type { Row } from '../../types/domain';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { PageHeader, Loading, ErrorState, Stat } from '../../components/ui/common';
import { RecordForm } from '../../components/forms/RecordForm';
import { day, money, select, status } from '../../pages/resources';
import { OrderEditor } from './OrderEditor';
import type { ExportOrder } from '../../lib/exports/excel';
export async function getOrderExport(w: string, order: Row): Promise<ExportOrder> {
  const [items, skus, products, customers, addresses] = await Promise.all([
    listRows('sales_order_items', w, { sales_order_id: String(order.id) }),
    listRows('skus', w),
    listRows('products', w),
    listRows('customers', w),
    listRows('customer_addresses', w),
  ]);
  const customer = customers.find((c) => c.id === order.customer_id),
    address = addresses.find((a) => a.id === order.address_id);
  return {
    number: String(order.order_number),
    date: String(order.order_date),
    customer: String(customer?.name ?? 'Pelanggan umum'),
    address: address ? `${address.branch_name} · ${address.address}` : undefined,
    discount: String(-Number(order.adjustment_total)),
    notes: String(order.notes ?? ''),
    items: items.map((i) => {
      const sku = skus.find((s) => s.id === i.sku_id);
      return {
        sku: String(sku?.sku_code ?? ''),
        name: String(products.find((p) => p.id === sku?.product_id)?.name ?? ''),
        product_type: String(products.find((p) => p.id === sku?.product_id)?.product_class ?? ''),
        sku_type: String(sku?.sku_type ?? sku?.variant_name ?? ''),
        qty: Number(i.qty),
        normal_unit_price: Number(i.normal_unit_price),
        selling_unit_price: Number(i.selling_unit_price),
        description: String(i.description ?? ''),
      };
    }),
  };
}
export function SalesPage({ channel = 'WHATSAPP' }: { channel?: string }) {
  const data = useRows('v_manual_order_status', { channel }),
    customers = useRows('customers'),
    command = useCommand(),
    { member, permissions } = useAuth();
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Row>(),
    [action, setAction] = useState<{ name: string; id: string; label: string }>(),
    [invoice, setInvoice] = useState<Row>();
  const allowed = (a: 'create' | 'edit' | 'post' | 'export') =>
    can(member, permissions, salesModule(channel), a);
  async function exportOrder(order: Row, format: 'pdf' | 'excel' | 'print') {
    try {
      const data = await getOrderExport(member!.workspace_id, order);
      if (format === 'excel')
        await (await import('../../lib/exports/excel')).exportOrderExcel(data);
      else await (await import('../../lib/exports/pdf')).exportOrderPdf(data, format === 'print');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }
  const rows = data.data ?? [];
  return (
    <>
      <PageHeader
        title={
          channel === 'WHATSAPP'
            ? 'Pesanan B2B'
            : `Pesanan ${channel === 'RESELLER' ? 'Reseller' : channel}`
        }
        description="Buat pesanan dan terbitkan invoice, lalu pilih invoice di Restock & Dropship untuk pengiriman supplier."
        actions={
          allowed('create') && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus size={17} />
              Buat pesanan
            </Button>
          )
        }
      />
      <div className="stats-grid">
        <Stat label="Pesanan" value={rows.length} />
        <Stat
          label="Penjualan diposting"
          value={rupiah(
            rows
              .filter((r) => r.status === 'POSTED')
              .reduce((s, r) => s + Number(r.grand_total), 0),
          )}
        />
        <Stat
          label="Draft perlu diproses"
          value={rows.filter((r) => r.status === 'DRAFT').length}
        />
      </div>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} />
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'order_number', label: 'Nomor pesanan' },
            { key: 'order_date', label: 'Tanggal' },
            {
              key: 'customer_id',
              label: 'Pelanggan',
              render: (v) =>
                String(customers.data?.find((c) => c.id === v)?.name ?? 'Pelanggan umum'),
            },
            money('grand_total', 'Grand total'),
            status(),
            { key: 'invoice_number', label: 'Invoice' },
            { key: 'reconciliation_status', label: 'Rekonsiliasi supplier' },
            { key: 'supplier_payment_status', label: 'Pembayaran supplier' },
            { key: 'customer_payment_status', label: 'Pembayaran pelanggan' },
          ]}
          actions={(r) => (
            <div className="actions flex-wrap">
              {r.status === 'DRAFT' &&
                !r.invoice_id &&
                r.reconciliation_status !== 'Sudah rekonsiliasi' &&
                allowed('edit') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    Edit / Alokasi
                  </Button>
                )}
              {r.status === 'DRAFT' && allowed('post') && (
                <Button
                  size="sm"
                  onClick={() =>
                    setAction({
                      name: 'post_sales_order',
                      id: String(r.id),
                      label: 'Posting pesanan',
                    })
                  }
                >
                  Posting
                </Button>
              )}
              {r.status === 'DRAFT' && allowed('edit') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setAction({ name: 'cancel_draft', id: String(r.id), label: 'Batalkan draft' })
                  }
                >
                  Batalkan
                </Button>
              )}
              {['DRAFT', 'POSTED'].includes(String(r.status)) &&
                !r.invoice_id &&
                allowed('post') && (
                  <Button size="sm" variant="outline" onClick={() => setInvoice(r)}>
                    Terbitkan invoice
                  </Button>
                )}
              {r.status === 'POSTED' && allowed('post') && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAction({
                        name: 'reverse_sales_order',
                        id: String(r.id),
                        label: 'Balik pesanan',
                      })
                    }
                  >
                    Balik
                  </Button>
                </>
              )}
              {allowed('export') && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Export PDF"
                    onClick={() => void exportOrder(r, 'pdf')}
                  >
                    <FileDown size={15} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Export Excel"
                    onClick={() => void exportOrder(r, 'excel')}
                  >
                    <FileSpreadsheet size={15} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Cetak pesanan"
                    onClick={() => void exportOrder(r, 'print')}
                  >
                    <Printer size={15} />
                  </Button>
                </>
              )}
            </div>
          )}
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.order_number}` : 'Buat pesanan baru'}
        description="Harga normal, harga jual, dan modal supplier dikelola secara terpisah."
        wide
      >
        {open && (
          <OrderEditor
            key={editing?.id ?? 'new'}
            channel={channel}
            order={editing}
            onSaved={() => setOpen(false)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={() => setAction(undefined)}
        title={action?.label ?? ''}
        description="Posting mengubah stok dan deposit sesuai alokasi. Pembalikan membuat entri lawan dan mempertahankan audit."
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            if (action) {
              try {
                await command.mutateAsync({
                  name: action.name,
                  args: {
                    record_id: action.id,
                    ...(action.name === 'cancel_draft' ? { entity: 'sales_orders' } : {}),
                  },
                });
                setAction(undefined);
              } catch {
                /* translated by mutation */
              }
            }
          }}
        >
          Konfirmasi
        </Button>
      </Dialog>
      <Dialog
        open={!!invoice}
        onOpenChange={() => setInvoice(undefined)}
        title="Terbitkan invoice"
        description="Nama pelanggan, alamat cabang, dan item disalin agar riwayat invoice tidak berubah."
      >
        {invoice && (
          <RecordForm
            fields={[
              select('address_id', 'Cabang (opsional)', 'customer_addresses', 'branch_name', false),
              { ...day('due_date', 'Jatuh tempo'), default: today() },
            ]}
            onSubmit={async (payload) => {
              await command.mutateAsync({
                name: 'issue_invoice',
                args: { payload: { ...payload, sales_order_id: invoice.id } },
              });
              setInvoice(undefined);
            }}
            pending={command.isPending}
          />
        )}
      </Dialog>
    </>
  );
}
