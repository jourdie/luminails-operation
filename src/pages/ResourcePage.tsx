import { useState } from 'react';
import { Plus, Download, Pencil, Trash2 } from 'lucide-react';
import { useCommand, useRows } from '../hooks/useData';
import { useAuth } from '../features/auth/AuthProvider';
import { can } from '../lib/permissions';
import type { Module, Row } from '../types/domain';
import { DataTable, type Column } from '../components/tables/DataTable';
import { RecordForm, type Field } from '../components/forms/RecordForm';
import { Dialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { ErrorState, Loading, PageHeader } from '../components/ui/common';
import { toast } from 'sonner';
import { friendlyError } from '../lib/errors';
export type ResourceConfig = {
  title: string;
  description: string;
  table: string;
  module: Module;
  columns: Column[];
  fields?: Field[];
  rpc?: string;
  entity?: string;
  confirmation?: string;
  editable?: boolean;
  deletable?: boolean;
  editRpc?: string;
  editFields?: Field[];
  filters?: Record<string, string>;
  action?: 'create' | 'post' | 'edit';
};
export function ResourcePage({ config }: { config: ResourceConfig }) {
  const data = useRows(config.table, config.filters),
    command = useCommand(),
    { member, permissions } = useAuth();
  const products = useRows('products', {}, config.table === 'skus');
  const supplierSkus = useRows('supplier_skus', {}, config.table === 'supplier_cost_versions');
  const suppliers = useRows('suppliers', {}, config.table === 'supplier_cost_versions');
  const skus = useRows('skus', {}, config.table === 'supplier_cost_versions');
  const customers = useRows('customers', {}, config.table === 'customer_addresses');
  const invoices = useRows('invoices', {}, config.table === 'payments');
  const displayRows = (data.data ?? []).map((row) => {
    const link = supplierSkus.data?.find((s) => s.id === row.supplier_sku_id);
    return {
      ...row,
      product_name: products.data?.find((p) => p.id === row.product_id)?.name,
      supplier_name: suppliers.data?.find((s) => s.id === link?.supplier_id)?.name,
      cost_sku_code: skus.data?.find((s) => s.id === link?.sku_id)?.sku_code,
      customer_name: customers.data?.find((c) => c.id === row.customer_id)?.name,
      invoice_number: invoices.data?.find((i) => i.id === row.invoice_id)?.invoice_number,
    };
  });
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Row>(),
    [reversing, setReversing] = useState<Row>(),
    [deleting, setDeleting] = useState<Row>();
  const permitted = (action: 'create' | 'edit' | 'export' | 'post') =>
    can(member, permissions, config.module, action);
  async function submit(payload: Row) {
    await command.mutateAsync({
      name: editing && config.editRpc ? config.editRpc : (config.rpc ?? 'save_master'),
      args: {
        ...(editing && config.editRpc
          ? {}
          : config.entity || !config.rpc
            ? { entity: config.entity ?? config.table }
            : {}),
        payload,
        ...(editing ? { record_id: editing.id } : {}),
      },
    });
    setOpen(false);
  }
  async function exportData() {
    try {
      const { exportTable } = await import('../lib/exports/excel');
      await exportTable(config.title, config.columns, displayRows);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            {permitted('export') && (
              <Button variant="outline" onClick={() => void exportData()}>
                <Download size={16} />
                Excel
              </Button>
            )}
            {config.fields && permitted(config.action ?? 'create') && (
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setOpen(true);
                }}
              >
                <Plus size={17} />
                Tambah data
              </Button>
            )}
          </>
        }
      />
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} />
      ) : (
        <DataTable
          rows={displayRows}
          columns={config.columns}
          actions={(r) => (
            <>
              {config.editable && permitted('edit') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </Button>
              )}
              {['payments', 'expenses'].includes(config.table) &&
                r.status === 'POSTED' &&
                permitted('post') && (
                  <Button size="sm" variant="ghost" onClick={() => setReversing(r)}>
                    Balik
                  </Button>
                )}
              {config.deletable && permitted('edit') && (
                <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>
                  <Trash2 size={14} />
                  Hapus
                </Button>
              )}
            </>
          )}
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`${editing ? 'Edit' : 'Tambah'} ${config.title}`}
      >
        <RecordForm
          key={editing?.id ?? String(open)}
          fields={editing && config.editFields ? config.editFields : (config.fields ?? [])}
          initial={editing}
          onSubmit={submit}
          pending={command.isPending}
          confirmation={
            config.confirmation ??
            (editing
              ? 'Perubahan akan dicatat dalam audit log. Konfirmasi penyimpanan?'
              : undefined)
          }
        />
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={() => setDeleting(undefined)}
        title={`Hapus ${config.title}?`}
        description="Data akan dihapus permanen dan dicatat di audit log. Data yang masih dipakai akan ditolak."
      >
        <div className="notice notice-warning">
          Pastikan baris ini memang salah input. Penghapusan tidak dapat dibatalkan.
        </div>
        <div className="form-footer">
          <Button variant="ghost" onClick={() => setDeleting(undefined)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={command.isPending}
            onClick={async () => {
              try {
                await command.mutateAsync({
                  name: 'delete_record',
                  args: {
                    entity: config.entity ?? config.table,
                    record_id: deleting?.id,
                    permission_module: config.module,
                  },
                });
                setDeleting(undefined);
              } catch {
                /* translated by mutation */
              }
            }}
          >
            Hapus permanen
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!reversing}
        onOpenChange={() => setReversing(undefined)}
        title="Balik transaksi keuangan"
        description="Transaksi ini tidak lagi dihitung dalam saldo aktif. Data asli dan audit tetap tersimpan."
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({
                name: 'reverse_finance',
                args: { entity: config.table, record_id: reversing?.id },
              });
              setReversing(undefined);
            } catch {
              /* translated by mutation */
            }
          }}
        >
          Konfirmasi pembalikan
        </Button>
      </Dialog>
    </>
  );
}
