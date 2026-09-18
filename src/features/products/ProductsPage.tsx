import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { today, rupiah } from '../../lib/formatting';
import { PageHeader, Loading, ErrorState } from '../../components/ui/common';
import { Button } from '../../components/ui/button';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { DataTable } from '../../components/tables/DataTable';
import { RecordForm } from '../../components/forms/RecordForm';
import { text, select } from '../../pages/resources';
import type { Row } from '../../types/domain';
import { templateCatalog } from '../shopee/template';
import { createSkuTemplate, readSkuTemplate, type CatalogTemplateRow } from './catalogTemplate';
export function ProductsPage() {
  const skus = useRows('skus'),
    products = useRows('products'),
    suppliers = useRows('suppliers'),
    brands = useRows('brands'),
    links = useRows('supplier_skus'),
    costs = useRows('supplier_cost_versions');
  const { member, permissions } = useAuth(),
    command = useCommand();
  const [editing, setEditing] = useState<Row>(),
    [opened, setOpened] = useState(false),
    [catalog, setCatalog] = useState<Row[]>([]),
    [uploadRows, setUploadRows] = useState<CatalogTemplateRow[]>([]),
    [deleting, setDeleting] = useState<Row>();
  const [supplier, setSupplier] = useState('');
  const allowed = (action: 'create' | 'edit') => can(member, permissions, 'products', action);
  const rows: Row[] = (skus.data ?? []).map((s) => {
    const ss = links.data?.filter(
      (l) => l.sku_id === s.id && (!supplier || l.supplier_id === supplier),
    );
    const prices = ss
      ?.map((l) => {
        const cost = costs.data
          ?.filter(
            (c) =>
              c.supplier_sku_id === l.id &&
              String(c.effective_from) <= today() &&
              (!c.effective_until || String(c.effective_until) > today()),
          )
          .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
        return cost
          ? `${suppliers.data?.find((v) => v.id === l.supplier_id)?.name}: ${rupiah(String(cost.cost))}`
          : '';
      })
      .filter(Boolean);
    return {
      ...s,
      product_name: products.data?.find((p) => p.id === s.product_id)?.name,
      product_set: products.data?.find((p) => p.id === s.product_id)?.product_set,
      brand: brands.data?.find((b) => b.id === products.data?.find((p) => p.id === s.product_id)?.brand_id)?.name,
      product_class:
        products.data?.find((p) => p.id === s.product_id)?.product_class ??
        products.data?.find((p) => p.id === s.product_id)?.category,
      hpp: prices?.join(' Ãƒâ€šÃ‚Â· ') || 'Belum diisi',
    };
  });
  function open(row?: Row) {
    setEditing(row);
    setOpened(true);
  }
  return (
    <>
      <PageHeader
        title="Produk & SKU"
        description="Master SKU sederhana: Merk, Product, Product Type, Variant, SKU Code, Supplier, Retail Price, dan HPP."
        actions={
          allowed('create') && (
            <div className="actions">
              <Button
                variant="outline"
                onClick={async () => {
                  const buffer = await createSkuTemplate();
                  const { download } = await import('../../lib/exports/excel');
                  download(new Blob([buffer as BlobPart]), 'template-master-sku.xlsx');
                }}
              >
                Download template SKU
              </Button>
              <Button onClick={() => open()}>Tambah produk / SKU</Button>
            </div>
          )
        }
      />
      <div className="panel mb-5">
        <div className="form-grid">
          <label>
            HPP supplier
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">Semua supplier</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name)}
                </option>
              ))}
            </select>
          </label>
          {allowed('create') && (
            <label>
              Ambil produk dari template Shopee
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { readImportFile } = await import('../shopee/import');
                    const parsed = await readImportFile(file);
                    if (
                      !['Nama Produk', 'Nama Variasi', 'SKU Induk', 'Nomor Referensi SKU'].every(
                        (h) => parsed.headers.includes(h),
                      )
                    )
                      throw new Error('Pilih template pesanan Shopee yang sesuai.');
                    setCatalog(templateCatalog(parsed.rows));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err));
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}
        </div>
        {allowed('create') && (
          <label className="upload-zone upload-zone-compact">
            <strong>Upload data SKU</strong>
            <span>Gunakan template 9 kolom: Merk, Product, Product Type, Variant, SKU Code, SKU Induk, Supplier, Retail Price, HPP.</span>
            <small>Contoh: Party Ã‚Â· Essentials Ã‚Â· Gel Polish Ã‚Â· Clear Ã‚Â· SKU-001 Ã‚Â· 140.000 Ã‚Â· 88.000</small>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setUploadRows(await readSkuTemplate(file));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message.replace(/^Error:\s*/, '') : String(error));
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </label>
        )}        <p className="muted text-sm mt-3">
          HPP dicatat per supplier sebagai master modal. Harga transaksi lama tetap memakai modal
          saat posting. <Link to="/suppliers/costs">Riwayat HPP</Link> Ãƒâ€šÃ‚Â·{' '}
          <Link to="/products/master">Master produk</Link>
        </p>
      </div>
      {uploadRows.length > 0 && (
        <section className="panel mb-5">
          <h2>Preview template master SKU</h2>
          <p className="muted">
            {uploadRows.length} baris siap diproses. Pastikan Merk, Product, Product Type, Variant, SKU Code, Supplier, Retail Price, dan HPP sudah benar.
          </p>
          <DataTable
            rows={uploadRows as unknown as Row[]}
            columns={[
              { key: 'Merk', label: 'Merk' },
              { key: 'Product', label: 'Product' },
              { key: 'Product Type', label: 'Product Type' },
              { key: 'Variant', label: 'Variant' },
              { key: 'SKU Code', label: 'SKU Code' },
              { key: 'SKU Induk', label: 'SKU Induk' },
              { key: 'Supplier', label: 'Supplier' },
              { key: 'Retail Price', label: 'Retail Price' },
              { key: 'HPP', label: 'HPP' },
            ]}
          />
          <div className="form-footer">
            <Button variant="ghost" onClick={() => setUploadRows([])}>
              Batal
            </Button>
            <Button
              disabled={command.isPending}
              onClick={async () => {
                try {
                  await command.mutateAsync({
                    name: 'import_catalog_skus',
                    args: { payload: { rows: uploadRows } },
                  });
                  setUploadRows([]);
                } catch {
                  /* mutation reports error */
                }
              }}
            >
              Import {uploadRows.length} SKU
            </Button>
          </div>
        </section>
      )}
      {catalog.length > 0 && (
        <section className="panel mb-5">
          <h2>Produk dari file Shopee</h2>
          <p className="muted">
            Periksa setiap produk, isi SKU jika kosong, lalu tentukan tipe produk dan HPP. File
            tidak menyediakan HPP.
          </p>
          <DataTable
            rows={catalog}
            columns={[
              { key: 'sku_code', label: 'Nomor Referensi SKU' },
              { key: 'parent_sku', label: 'SKU Induk' },
              { key: 'product_name', label: 'Nama Produk' },
              { key: 'variant_name', label: 'Nama Variasi' },
            ]}
            actions={(r) => (
              <Button
                size="sm"
                onClick={() => {
                  const existing = rows.find((s) => s.sku_code === r.sku_code && !!r.sku_code);
                  open({ ...r, product_name: r.product_name, product_class: r.product_type, id: existing?.id });
                }}
              >
                Isi / perbarui produk
              </Button>
            )}
          />
          <Button variant="ghost" onClick={() => setCatalog([])}>
            Tutup preview
          </Button>
        </section>
      )}
      {skus.isLoading ? (
        <Loading />
      ) : skus.error ? (
        <ErrorState error={skus.error} />
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'sku_code', label: 'Nomor Referensi SKU' },
            { key: 'parent_sku', label: 'SKU Induk' },
            { key: 'product_name', label: 'Product' },
            { key: 'product_class', label: 'Product Type' },
            { key: 'variant_name', label: 'Variant' },
            { key: 'retail_price', label: 'Retail normal', render: (v) => rupiah(String(v ?? 0)) },
            { key: 'hpp', label: 'Modal / HPP' },
          ]}
          actions={(r) =>
            allowed('edit') && (
              <>
                <Button size="sm" variant="outline" onClick={() => open(r)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>
                  <Trash2 size={14} />
                  Hapus
                </Button>
              </>
            )
          }
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={() => setDeleting(undefined)}
        title="Hapus SKU?"
        description="Relasi supplier dan HPP yang belum dipakai akan ikut dibersihkan."
      >
        <div className="notice notice-warning">
          Jika SKU sudah dipakai transaksi atau stok, sistem akan menolak penghapusan agar riwayat bisnis tetap aman.
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
                  args: { entity: 'skus', record_id: deleting?.id, permission_module: 'products' },
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
        open={opened}
        onOpenChange={setOpened}
        title={editing?.id ? 'Edit produk / SKU' : 'Tambah produk / SKU'}
        description="Isi sembilan kolom sederhana. SKU Induk boleh kosong; Supplier, retail price, dan HPP dapat diisi dari template."
        wide
      >
        {opened && (
          <RecordForm
            initial={editing}
            fields={[
              text('sku_code', 'SKU Code'),
              text('parent_sku', 'SKU Induk', false),
              select('brand_id', 'Merk', 'brands', 'name', false),
              text('product_name', 'Product'),
              text('product_class', 'Product Type'),
              text('variant_name', 'Variant', false),
              {
                key: 'retail_price',
                label: 'Harga normal retail',
                type: 'decimal',
                required: true,
              },
              select('supplier_id', 'Supplier HPP', 'suppliers', 'name', false),
              { key: 'cost', label: 'Modal / HPP (opsional)', type: 'decimal' },
            ]}
            pending={command.isPending}
            onSubmit={async (payload) => {
              await command.mutateAsync({
                name: 'save_catalog_sku',
                args: { payload, ...(editing?.id ? { record_id: editing.id } : {}) },
              });
              setOpened(false);
            }}
          />
        )}
      </Dialog>
    </>
  );
}




