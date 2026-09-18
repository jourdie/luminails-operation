import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { today, rupiah } from '../../lib/formatting';
import { Button } from '../../components/ui/button';
import { DataTable } from '../../components/tables/DataTable';
import { ProcurementEditor } from './ProcurementEditor';
import {
  previewShopeeTemplate,
  requireShopeeTemplate,
  supplierTemplateOrders,
} from '../shopee/template';
import type { Row } from '../../types/domain';

export const supplierOrderTypes: Record<string, string> = {
  DROPSHIP_ECOMMERCE: 'Dropship ecommerce',
  DROPSHIP_B2B: 'Dropship B2B',
  RESTOCK: 'Restock',
};
export function SupplierOrderEditor({ order, onSaved }: { order?: Row; onSaved: () => void }) {
  const suppliers = useRows('suppliers');
  const [supplier, setSupplier] = useState(String(order?.supplier_id ?? '')),
    [kind, setKind] = useState(String(order?.order_type ?? 'DROPSHIP_ECOMMERCE')),
    [date, setDate] = useState(String(order?.order_date ?? today()));
  return (
    <div className="record-form">
      <div className="form-grid mb-5">
        <label>
          Supplier
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Pilih supplier</option>
            {suppliers.data
              ?.filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Tipe pesanan
          <select value={kind} disabled={!!order} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(supplierOrderTypes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tanggal pesanan supplier
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {!supplier || !date ? (
        <p className="notice">Pilih supplier dan tanggal pesanan terlebih dahulu.</p>
      ) : kind === 'RESTOCK' ? (
        <ProcurementEditor
          key={`${supplier}-${date}`}
          order={order}
          supplierId={supplier}
          orderDate={date}
          onSaved={onSaved}
        />
      ) : kind === 'DROPSHIP_B2B' ? (
        <InvoiceSource supplier={supplier} date={date} onSaved={onSaved} />
      ) : (
        <ShopeeSource supplier={supplier} date={date} onSaved={onSaved} />
      )}
    </div>
  );
}
function InvoiceSource({
  supplier,
  date,
  onSaved,
}: {
  supplier: string;
  date: string;
  onSaved: () => void;
}) {
  const sales = useRows('v_manual_order_status'),
    invoices = useRows('invoice_items'),
    command = useCommand();
  const [invoice, setInvoice] = useState('');
  const eligible =
    sales.data?.filter(
      (s) =>
        ['WHATSAPP', 'B2B'].includes(String(s.channel)) &&
        s.status === 'DRAFT' &&
        s.invoice_id &&
        s.reconciliation_status === 'Belum rekonsiliasi',
    ) ?? [];
  const selected = eligible.find((s) => s.invoice_id === invoice);
  const lines = invoices.data?.filter((i) => i.invoice_id === invoice) ?? [];
  return (
    <section>
      <p className="notice">
        Buat dan terbitkan invoice di <Link to="/whatsapp-orders">Pesanan B2B</Link>{' '}
        terlebih dahulu. Pilih invoice yang akan dikirim seluruhnya oleh supplier ini. Alokasi stok
        lokal atau supplier lain perlu disesuaikan sebelum menerbitkan invoice.
      </p>
      <label className="mt-4">
        Invoice sumber
        <select value={invoice} onChange={(e) => setInvoice(e.target.value)}>
          <option value="">Pilih invoice yang belum direkonsiliasi</option>
          {eligible.map((s) => (
            <option key={s.id} value={String(s.invoice_id)}>
              {String(s.invoice_number)} · {String(s.order_number)} ·{' '}
              {rupiah(String(s.grand_total))}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <p className="muted mt-4">
            Pembayaran pelanggan: {String(selected.customer_payment_status)}
          </p>
          <DataTable
            rows={lines.map((i) => ({
              ...i,
              sku: (i.sku_snapshot as Row)?.sku_code,
              product: (i.sku_snapshot as Row)?.name,
            }))}
            columns={[
              { key: 'sku', label: 'SKU' },
              { key: 'product', label: 'Produk' },
              { key: 'qty', label: 'Qty' },
              { key: 'unit_price', label: 'Harga invoice', render: (v) => rupiah(String(v)) },
            ]}
          />
        </>
      )}
      <div className="form-footer">
        <p className="muted text-sm">
          Simpan menandai rekonsiliasi. Posting memotong deposit dan mencatat penjualan sekali.
        </p>
        <Button
          disabled={!selected || command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({
                name: 'create_supplier_from_invoice',
                args: { payload: { supplier_id: supplier, order_date: date, invoice_id: invoice } },
              });
              onSaved();
            } catch {
              /* toast from command */
            }
          }}
        >
          Ambil invoice & rekonsiliasi
        </Button>
      </div>
    </section>
  );
}
function ShopeeSource({
  supplier,
  date,
  onSaved,
}: {
  supplier: string;
  date: string;
  onSaved: () => void;
}) {
  const skus = useRows('skus'),
    products = useRows('products'),
    sales = useRows('sales_orders', { channel: 'SHOPEE' }),
    procurements = useRows('procurement_orders'),
    links = useRows('supplier_skus'),
    costs = useRows('supplier_cost_versions'),
    command = useCommand();
  const [raw, setRaw] = useState<Record<string, string>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [fileName, setFileName] = useState(''),
    [loading, setLoading] = useState(false);
  const existing = new Set(
    [
      ...(sales.data ?? []).filter((s) => s.status !== 'CANCELLED'),
      ...(procurements.data ?? []).filter(
        (p) => !['CANCELLED', 'REVERSED'].includes(String(p.status)),
      ),
    ].map((s) => String(s.external_order_number)),
  );
  const preview = previewShopeeTemplate(
    raw,
    skus.data ?? [],
    products.data ?? [],
    mapping,
    existing,
  );
  const ready = preview.filter((r) => r.status === 'SIAP');
  const hpp = (sku: string) => {
    const link = links.data?.find((l) => l.sku_id === sku && l.supplier_id === supplier);
    return costs.data
      ?.filter(
        (c) =>
          c.supplier_sku_id === link?.id &&
          String(c.effective_from) <= date &&
          (!c.effective_until || String(c.effective_until) > date),
      )
      .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0]?.cost;
  };
  const missingCost = ready.some((r) => hpp(r.sku_id) === undefined);
  const unresolved = useMemo(
    () => [
      ...new Map(
        preview.filter((r) => !['DILEWATI', 'DUPLIKAT'].includes(r.status)).map((r) => [r.key, r]),
      ).values(),
    ],
    [raw, mapping, skus.data, products.data, sales.data, procurements.data],
  );
  const blocked = preview.some((r) => ['ERROR', 'PETAKAN SKU'].includes(r.status)) || missingCost;
  return (
    <section>
      <div className="notice mb-4"><strong>Alur dropship ecommerce</strong><br />Upload file → periksa tanggal dan SKU → pastikan HPP supplier tersedia → simpan draft. Format tanggal transaksi: DD/MM/YYYY atau YYYY-MM-DD.</div>
      <label>
        Upload transaksi Shopee (.xlsx / .csv)
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={loading}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setLoading(true);
            setRaw([]);
            setMapping({});
            try {
              const { readImportFile } = await import('../shopee/import');
              const parsed = await readImportFile(f);
              requireShopeeTemplate(parsed.headers);
              setRaw(parsed.rows);
              setFileName(f.name);
            } catch (err) {
              toast.error(err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err));
            } finally {
              setLoading(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      <p className="muted mt-3">
        Baris batal dan pesanan yang sudah diimpor dilewati. SKU kosong perlu dipetakan. HPP
        menggunakan modal supplier pada tanggal pesanan supplier.
      </p>
      {raw.length > 0 && (
        <>
          <h2 className="section-heading">Periksa hasil upload · {fileName}</h2>
          <div className="form-grid">
            {unresolved.map((r) => (
              <label key={r.key}>
                {r.reference || r.product} · {r.variant}
                <select
                  value={r.sku_id}
                  onChange={(e) => setMapping({ ...mapping, [r.key]: e.target.value })}
                >
                  <option value="">Pilih SKU internal</option>
                  {skus.data
                    ?.filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {String(s.sku_code)} · {String(s.variant_name)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-4">
            {ready.length} baris siap · {preview.filter((r) => r.status === 'DILEWATI').length}{' '}
            batal dilewati · {preview.filter((r) => r.status === 'DUPLIKAT').length} duplikat
          </p>
          {missingCost && (
            <p className="field-error">
              HPP supplier belum tersedia untuk beberapa SKU. Isi melalui Produk & SKU atau Modal
              Supplier sebelum menyimpan.
            </p>
          )}
          <DataTable
            rows={preview.map((r) => ({ ...r, hpp: hpp(r.sku_id), issue: r.errors.join('; ') }))}
            columns={[
              { key: 'order', label: 'No. Pesanan' },
              { key: 'product', label: 'Nama Produk' },
              { key: 'variant', label: 'Nama Variasi' },
              { key: 'qty', label: 'Jumlah' },
              { key: 'price', label: 'Harga jual', render: (v) => rupiah(Number(v)) },
              {
                key: 'hpp',
                label: 'HPP',
                render: (v) => (v === undefined ? 'Belum diisi' : rupiah(String(v))),
              },
              { key: 'status', label: 'Status' },
              { key: 'issue', label: 'Perlu diperiksa' },
            ]}
          />
        </>
      )}
      <div className="form-footer">
        <span className="muted text-sm">
          Setiap nomor pesanan menjadi satu draft supplier dan satu penjualan tertaut.
        </span>
        <Button
          disabled={
            loading ||
            command.isPending ||
            !ready.length ||
            blocked ||
            sales.isLoading ||
            procurements.isLoading
          }
          onClick={async () => {
            try {
              const orders = supplierTemplateOrders(preview);
              await command.mutateAsync({
                name: 'import_supplier_shopee',
                args: { payload: { supplier_id: supplier, order_date: date, orders } },
              });
              onSaved();
            } catch (err) {
              if (err instanceof Error && !command.isError) toast.error(err.message);
            }
          }}
        >
          Simpan draft ecommerce
        </Button>
      </div>
    </section>
  );
}
