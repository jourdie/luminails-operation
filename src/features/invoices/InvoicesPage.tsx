import { useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { listRows } from '../../lib/supabase/gateway';
import { friendlyError } from '../../lib/errors';
import type { Row } from '../../types/domain';
import { PageHeader } from '../../components/ui/common';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { money, status } from '../../pages/resources';
export function InvoicesPage() {
  const invoices = useRows('invoices'),
    receivables = useRows('v_customer_receivables'),
    command = useCommand(),
    { member, permissions } = useAuth();
  const [voidId, setVoidId] = useState<string>();
  async function exportInvoice(invoice: Row, print = false) {
    try {
      const items = await listRows('invoice_items', member!.workspace_id, {
          invoice_id: String(invoice.id),
        }),
        customer = invoice.customer_snapshot as Row,
        address = invoice.address_snapshot as Row | null,
        settings = invoice.settings_snapshot as Row,
        payment = receivables.data?.find((r) => r.invoice_id === invoice.id);
      const data = {
        number: String(invoice.invoice_number),
        date: String(invoice.invoice_date),
        dueDate: String(invoice.due_date),
        customer: String(customer.name),
        address: address ? `${address.branch_name} · ${address.address}` : undefined,
        paid: String(payment?.paid ?? 0),
        discount: String(Math.abs(Number(invoice.adjustment_total))),
        notes: [String(settings.notes ?? ''), String(invoice.notes ?? '')]
          .filter(Boolean)
          .join('\n'),
        paymentInfo: String(settings.payment_info ?? ''),
        items: items.length
          ? items.map((i) => ({
              sku: '',
              product_type: String((i.sku_snapshot as Row).product_class ?? ''),
              sku_type: String((i.sku_snapshot as Row).sku_type ?? ''),
              name: String((i.sku_snapshot as Row).name),
              qty: Number(i.qty),
              normal_unit_price: Number(i.normal_unit_price),
              selling_unit_price: Number(i.unit_price),
              description: String(i.description ?? ''),
            }))
          : [
              {
                sku: 'OPENING',
                name: 'Saldo awal piutang',
                qty: 1,
                normal_unit_price: Number(invoice.total),
                selling_unit_price: Number(invoice.total),
              },
            ],
      };
      await (await import('../../lib/exports/pdf')).exportOrderPdf(data, print);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Invoice"
        description="Invoice diterbitkan dari pesanan yang sudah diposting. Nama dan alamat tersimpan sebagai snapshot."
      />
      <DataTable
        rows={(invoices.data ?? []).map((i) => ({
          ...i,
          payment_status:
            receivables.data?.find((r) => r.invoice_id === i.id)?.payment_status ?? i.status,
        }))}
        columns={[
          { key: 'invoice_number', label: 'Invoice' },
          { key: 'customer_snapshot', label: 'Pelanggan', render: (v) => String((v as Row).name) },
          { key: 'invoice_date', label: 'Tanggal' },
          { key: 'due_date', label: 'Jatuh tempo' },
          money('total', 'Tagihan'),
          status('payment_status'),
        ]}
        actions={(r) => {
          const module =
            (r.customer_snapshot as Row).customer_type === 'RESELLER' ? 'reseller' : 'b2b';
          return (
            <div className="actions">
              {can(member, permissions, module, 'export') && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => void exportInvoice(r)}>
                    <FileDown size={15} />
                    PDF
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void exportInvoice(r, true)}>
                    <Printer size={15} />
                  </Button>
                </>
              )}
              {r.status === 'ISSUED' && can(member, permissions, module, 'post') && (
                <Button size="sm" variant="ghost" onClick={() => setVoidId(String(r.id))}>
                  Batalkan
                </Button>
              )}
            </div>
          );
        }}
      />
      <Dialog
        open={!!voidId}
        onOpenChange={() => setVoidId(undefined)}
        title="Batalkan invoice"
        description="Invoice akan berstatus VOID. Pembayaran aktif harus dibalik terlebih dahulu."
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({ name: 'void_invoice', args: { record_id: voidId } });
              setVoidId(undefined);
            } catch {
              /* mutation reports error */
            }
          }}
        >
          Konfirmasi pembatalan
        </Button>
      </Dialog>
    </>
  );
}
