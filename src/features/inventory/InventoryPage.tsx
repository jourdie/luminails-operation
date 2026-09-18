import { useState } from 'react';
import { Boxes, AlertTriangle, PackageCheck, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useRows, useCommand } from '../../hooks/useData';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { rupiah } from '../../lib/formatting';
import { PageHeader, Stat, Badge, Loading, ErrorState } from '../../components/ui/common';
import { DataTable } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { download } from '../../lib/exports/excel';
import type { Row } from '../../types/domain';
import { createStockAdjustmentTemplate, readStockAdjustmentTemplate, type StockAdjustmentInput } from './stockAdjustmentTemplate';
export function InventoryPage() {
  const data = useRows('v_low_stock'), movements = useRows('inventory_movements'), skus = useRows('skus'), products = useRows('products'), brands = useRows('brands'), command = useCommand();
  const { member, permissions } = useAuth();
  const [brand, setBrand] = useState(''), [product, setProduct] = useState(''), [productType, setProductType] = useState('');
  const [open, setOpen] = useState(false), [preview, setPreview] = useState<StockAdjustmentInput[]>([]);
  const allowed = can(member, permissions, 'inventory', 'post');
  const rows: Row[] = (data.data ?? []).map((r) => {
    const sku = skus.data?.find((s) => s.id === r.sku_id), p = products.data?.find((x) => x.id === sku?.product_id);
    return { ...r, product_name: p?.name ?? r.name, product_type: p?.product_class || p?.category || r.category, brand: brands.data?.find((b) => b.id === p?.brand_id)?.name ?? r.brand };
  });
  const visible = rows.filter((r) => (!brand || r.brand === brand) && (!product || r.product_name === product) && (!productType || r.product_type === productType));
  async function exportTemplate() {
    const buffer = await createStockAdjustmentTemplate(rows);
    download(new Blob([buffer as BlobPart]), 'template-penyesuaian-stok.xlsx');
  }
  async function upload(file?: File) {
    if (!file) return;
    try { setPreview(await readStockAdjustmentTemplate(file)); setOpen(true); }
    catch (error) { toast.error(error instanceof Error ? error.message.replace(/^Error:\s*/, '') : String(error)); }
  }
  return <>
    <PageHeader title="Stok & Persediaan" description="Pantau stok berdasarkan Merk, Product, dan Product Type. Penyesuaian dilakukan melalui template SKU." actions={allowed && <div className="actions"><Button variant="outline" onClick={() => void exportTemplate()}><Download size={16} />Download template stok</Button><label className="button button-primary"><Upload size={16} />Import penyesuaian<input className="sr-only" type="file" accept=".xlsx,.csv" onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div>} />
    <div className="stats-grid"><Stat label="SKU aktif" value={rows.length} icon={<Boxes size={18} />} /><Stat label="Nilai persediaan" value={rupiah(rows.reduce((s, r) => s + Number(r.inventory_value), 0))} icon={<PackageCheck size={18} />} /><Stat label="Perlu perhatian" value={rows.filter((r) => r.stock_status !== 'Aman').length} icon={<AlertTriangle size={18} />} /></div>
    <div className="filters"><select aria-label="Filter merk" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">Semua merk</option>{[...new Set(rows.map((r) => String(r.brand ?? '')).filter(Boolean))].sort().map((v) => <option key={v}>{v}</option>)}</select><select aria-label="Filter produk" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">Semua produk</option>{[...new Set(rows.map((r) => String(r.product_name ?? '')).filter(Boolean))].sort().map((v) => <option key={v}>{v}</option>)}</select><select aria-label="Filter product type" value={productType} onChange={(e) => setProductType(e.target.value)}><option value="">Semua product type</option>{[...new Set(rows.map((r) => String(r.product_type ?? '')).filter(Boolean))].sort().map((v) => <option key={v}>{v}</option>)}</select></div>
    {data.isLoading ? <Loading /> : data.error ? <ErrorState error={data.error} /> : <DataTable rows={visible} columns={[{ key: 'brand', label: 'Merk' }, { key: 'product_name', label: 'Product' }, { key: 'product_type', label: 'Product Type' }, { key: 'sku_code', label: 'SKU' }, { key: 'current_stock', label: 'Stok' }, { key: 'stock_status', label: 'Status', render: (v) => <Badge>{String(v)}</Badge> }, { key: 'average_cost', label: 'Modal rata-rata', render: (v) => rupiah(String(v ?? 0)) }, { key: 'inventory_value', label: 'Nilai stok', render: (v) => rupiah(String(v ?? 0)) }, { key: 'reorder_point', label: 'Titik restock' }]} />}
    <p className="muted text-xs mt-3">Download template, isi Quantity dan Adjustment Type, lalu upload kembali. Lokasi stok dikelola otomatis oleh sistem sebagai Gudang Utama.</p>
    <h2 className="section-heading">Pergerakan stok</h2>
    <DataTable rows={(movements.data ?? []).map((m) => ({ ...m, product_type: rows.find((r) => r.sku_id === m.sku_id)?.product_type, product_name: rows.find((r) => r.sku_id === m.sku_id)?.product_name }))} columns={[{ key: 'transaction_date', label: 'Tanggal' }, { key: 'brand', label: 'Merk', render: (_v, r) => String(rows.find((x) => x.sku_id === r.sku_id)?.brand ?? '') }, { key: 'product_name', label: 'Product' }, { key: 'product_type', label: 'Product Type' }, { key: 'sku_id', label: 'SKU', render: (v) => String(rows.find((r) => r.sku_id === v)?.sku_code ?? v) }, { key: 'movement_type', label: 'Jenis' }, { key: 'qty_delta', label: 'Perubahan' }, { key: 'notes', label: 'Catatan' }]} />
    <Dialog open={open} onOpenChange={setOpen} title="Preview penyesuaian stok" description="Periksa baris sebelum diposting. Sistem memakai SKU Code dan lokasi Gudang Utama secara otomatis." wide><DataTable rows={preview as unknown as Row[]} columns={[{ key: 'sku_code', label: 'SKU Code' }, { key: 'movement_type', label: 'Jenis' }, { key: 'qty_delta', label: 'Jumlah' }, { key: 'unit_cost', label: 'Modal' }, { key: 'transaction_date', label: 'Tanggal' }, { key: 'notes', label: 'Catatan' }]} /><div className="form-footer"><Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button><Button disabled={!preview.length || command.isPending} onClick={async () => { await command.mutateAsync({ name: 'post_stock_adjustments', args: { payload: { rows: preview } } }); setPreview([]); setOpen(false); }}>Posting {preview.length} baris</Button></div></Dialog>
  </>;
}