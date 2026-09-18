import { useMemo, useState } from 'react';
import { Upload, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { uploadImport } from '../../lib/supabase/gateway';
import { friendlyError } from '../../lib/errors';
import {
  readImportFile,
  importErrorMessage,
  suggestMapping,
  validateImport,
  importFields,
  groupImport,
  type Mapping,
} from './import';
import { PageHeader, Stat, Badge } from '../../components/ui/common';
import { Button } from '../../components/ui/button';
import { DataTable } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/dialog';
const labels: Record<string, string> = {
  external_order_id: 'Nomor pesanan',
  external_item_id: 'ID item unik',
  sku: 'SKU',
  qty: 'Jumlah',
  price: 'Harga jual per unit',
  order_date: 'Tanggal pesanan',
};
export function ShopeePage() {
  const skus = useRows('skus'),
    orders = useRows('sales_orders', { channel: 'SHOPEE' }),
    locations = useRows('inventory_locations'),
    suppliers = useRows('suppliers'),
    batches = useRows('import_batches'),
    { member, permissions } = useAuth(),
    command = useCommand();
  const [file, setFile] = useState<File>(),
    [raw, setRaw] = useState<Record<string, string>[]>([]),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Mapping>(suggestMapping([])),
    [skuMapping, setSkuMapping] = useState<Record<string, string>>({}),
    [type, setType] = useState<'LOCAL_STOCK' | 'SUPPLIER'>('LOCAL_STOCK'),
    [reference, setReference] = useState(''),
    [confirm, setConfirm] = useState(false),
    [reading, setReading] = useState(false);
  const rows = useMemo(
    () =>
      validateImport(
        raw,
        mapping,
        skus.data ?? [],
        new Set(orders.data?.map((o) => String(o.external_order_number))),
        skuMapping,
      ),
    [raw, mapping, skus.data, orders.data, skuMapping],
  );
  const missing = [
    ...new Set(raw.filter((_, i) => rows[i]?.status === 'UNMAPPED').map((r) => r[mapping.sku])),
  ];
  async function upload(f: File) {
    setReading(true);
    try {
      const parsed = await readImportFile(f);
      setFile(f);
      setHeaders(parsed.headers);
      setRaw(parsed.rows);
      setMapping(suggestMapping(parsed.headers));
      setSkuMapping({});
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.startsWith('FILE')
          ? 'Gunakan CSV atau XLSX hingga 10 MB dan 5.000 baris.'
          : importErrorMessage(e),
      );
    } finally {
      setReading(false);
    }
  }
  async function commit() {
    try {
      if (!file) return;
      const importOrders = groupImport(rows, { type, reference });
      const path = await uploadImport(member!.workspace_id, file);
      const batch = await command.mutateAsync({
        name: 'save_import_preview',
        args: {
          payload: { filename: file.name, storage_path: path, column_mapping: mapping, rows },
        },
      });
      const result = (await command.mutateAsync({
        name: 'commit_import',
        args: { payload: { batch_id: batch, orders: importOrders } },
      })) as { created: number; duplicates: number };
      toast.success(`${result.created} draft dibuat; ${result.duplicates} duplikat dilewati.`);
      setRaw([]);
      setFile(undefined);
      setConfirm(false);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Impor Shopee"
        description="Upload → pratinjau → petakan → alokasi → rekonsiliasi → posting."
        actions={
          <Button asChild variant="outline">
            <Link to="/shopee/orders">
              Pesanan Shopee <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="notice mb-5">
        <strong>Alur impor Shopee</strong><br />
        1) Upload file ekspor Shopee · 2) Perbaiki baris merah · 3) Pilih stok lokal atau supplier · 4) Buat draft.
        <br />Format tanggal yang diterima: <strong>DD/MM/YYYY</strong>, <strong>DD-MM-YYYY</strong>, atau <strong>YYYY-MM-DD</strong>.
        Impor hanya membuat draft; stok dan deposit berubah setelah posting.
      </div>
      {can(member, permissions, 'shopee', 'create') && (
        <label className="upload-zone">
          <Upload size={30} />
          <strong>
            {reading ? 'Langkah 1: membaca file...' : (file?.name ?? 'Langkah 1: pilih laporan pesanan Shopee')}
          </strong>
          <span>CSV atau XLSX · maksimal 10 MB / 5.000 baris</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={reading}
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
        </label>
      )}
      {raw.length > 0 && (
        <>
          <h2 className="section-heading">Langkah 2 · Periksa kolom</h2>
          <div className="mapping-grid">
            {importFields.map((f) => (
              <label key={f}>
                {labels[f]}
                <select
                  value={mapping[f]}
                  onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}
                >
                  <option value="">Pilih kolom</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="muted text-xs my-3">
            Tanggal transaksi boleh DD/MM/YYYY atau YYYY-MM-DD. Harga boleh memakai format angka Indonesia seperti 80.000.
            Gunakan ID item marketplace yang stabil.
          </p>
          {missing.length > 0 && (
            <>
              <h2 className="section-heading">Langkah 3 · Petakan SKU yang belum ditemukan</h2>
              <div className="mapping-grid">
                {missing.map((code) => (
                  <label key={code}>
                    {code || 'SKU kosong'}
                    <select
                      value={skuMapping[code] ?? ''}
                      onChange={(e) => setSkuMapping({ ...skuMapping, [code]: e.target.value })}
                    >
                      <option value="">Pilih SKU internal</option>
                      {skus.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {String(s.sku_code)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="stats-grid mt-5">
            {[
              ['NEW', 'Baris baru'],
              ['DUPLICATE', 'Duplikat'],
              ['UNMAPPED', 'SKU belum dipetakan'],
              ['ERROR', 'Kesalahan'],
            ].map(([key, label]) => (
              <Stat key={key} label={label} value={rows.filter((r) => r.status === key).length} />
            ))}
          </div>
          <DataTable
            rows={rows}
            columns={[
              { key: 'external_order_id', label: 'Pesanan' },
              { key: 'external_item_id', label: 'Item' },
              {
                key: 'sku_id',
                label: 'SKU',
                render: (v) =>
                  String(skus.data?.find((s) => s.id === v)?.sku_code ?? 'Belum dipetakan'),
              },
              { key: 'qty', label: 'Qty' },
              { key: 'price', label: 'Harga jual' },
              { key: 'status', label: 'Status', render: (v) => <Badge>{String(v)}</Badge> },
              { key: 'errors', label: 'Kesalahan', render: (v) => (v as string[]).join(' ') },
            ]}
          />
          <h2 className="section-heading">Langkah 4 · Tentukan sumber barang</h2>
          <div className="filters">
            <select
              aria-label="Sumber fulfillment"
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                setReference('');
              }}
            >
              <option value="LOCAL_STOCK">Semua dari stok lokal</option>
              <option value="SUPPLIER">Semua dari supplier</option>
            </select>
            <select
              aria-label="Lokasi atau supplier"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            >
              <option value="">Pilih {type === 'LOCAL_STOCK' ? 'lokasi' : 'supplier'}</option>
              {(type === 'LOCAL_STOCK' ? locations : suppliers).data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.name)}
                </option>
              ))}
            </select>
            <Button
              disabled={
                !reference ||
                !rows.some((r) => r.status === 'NEW') ||
                rows.some((r) => r.status === 'ERROR' || r.status === 'UNMAPPED') ||
                command.isPending
              }
              onClick={() => setConfirm(true)}
            >
              Tinjau & buat draft
            </Button>
          </div>
          <p className="muted text-sm">
            Alokasi campuran per item dapat diubah di draft pesanan sebelum posting. Biaya
            marketplace tetap kosong sampai laporan pendapatan tersedia.
          </p>
        </>
      )}
      <h2 className="section-heading">Riwayat impor</h2>
      <DataTable
        rows={batches.data ?? []}
        columns={[
          { key: 'filename', label: 'File' },
          { key: 'created_at', label: 'Waktu' },
          { key: 'status', label: 'Status' },
        ]}
      />
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Konfirmasi impor"
        description={`${rows.filter((r) => r.status === 'NEW').length} baris baru akan dibuat sebagai draft. Duplikat dilewati. Setelah ini, periksa alokasi dan rekonsiliasi.`}
      >
        <Button disabled={command.isPending} onClick={() => void commit()}>
          Buat draft pesanan
        </Button>
      </Dialog>
    </>
  );
}
