import type { OrderInput, Row } from '../../types/domain';
import { normalizeImportDate } from './import';

export const templateHeaders = [
  'No. Pesanan',
  'Nama Produk',
  'Nama Variasi',
  'SKU Induk',
  'Nomor Referensi SKU',
  'Jumlah',
  'Harga Setelah Diskon',
  'Waktu Pesanan Dibuat',
  'Status Pesanan',
];
export function requireShopeeTemplate(headers: string[]) {
  const missing = templateHeaders.filter((h) => !headers.includes(h));
  if (missing.length) throw new Error(`Kolom template belum lengkap: ${missing.join(', ')}`);
}
export function shopeeNumber(value: string) {
  const s = value.trim();
  if (!s || !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s)) return NaN;
  return Number(s.replace(/\./g, '').replace(',', '.'));
}
export function catalogKey(row: Record<string, string>) {
  return JSON.stringify([
    row['Nomor Referensi SKU'] || '',
    row['SKU Induk'] || '',
    row['Nama Produk'] || '',
    row['Nama Variasi'] || '',
  ]);
}
export function templateCatalog(rows: Record<string, string>[]) {
  return [
    ...new Map(
      rows.map((r) => [
        catalogKey(r),
        {
          id: catalogKey(r),
          sku_code: r['Nomor Referensi SKU'] || '',
          parent_sku: r['SKU Induk'] || '',
          product_name: r['Nama Produk'] || '',
          variant_name: r['Nama Variasi'] || '',
          product_type: '',
        },
      ]),
    ).values(),
  ];
}
export function previewShopeeTemplate(
  raw: Record<string, string>[],
  skus: Row[],
  products: Row[],
  overrides: Record<string, string>,
  existing: Set<string>,
) {
  const seen = new Set<string>();
  const previews = raw.map((r, index) => {
    const key = catalogKey(r),
      order = r['No. Pesanan'] || '';
    const ref = r['Nomor Referensi SKU'];
    const candidates = skus.filter(
      (s) =>
        s.active &&
        (ref
          ? s.sku_code === ref
          : s.variant_name === r['Nama Variasi'] &&
            products.some((p) => p.id === s.product_id && p.name === r['Nama Produk'])),
    );
    const skuId = overrides[key] || (candidates.length === 1 ? String(candidates[0].id) : '');
    const qty = shopeeNumber(r['Jumlah'] || ''),
      price = shopeeNumber(r['Harga Setelah Diskon'] || '');
    const normal = r['Harga Awal'] ? shopeeNumber(r['Harga Awal']) : price;
    const date = normalizeImportDate(r['Waktu Pesanan Dibuat']);
    const cancelled = /batal|cancel/i.test(r['Status Pesanan'] || '');
    const returned = r['Returned quantity'] ? shopeeNumber(r['Returned quantity']) : 0;
    const errors: string[] = [];
    if (!order || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
      errors.push(!order ? 'Nomor pesanan wajib diisi' : 'Tanggal transaksi tidak dikenali. Gunakan DD/MM/YYYY atau YYYY-MM-DD.');
    if (
      !Number.isSafeInteger(qty) ||
      qty <= 0 ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      !Number.isSafeInteger(normal) ||
      normal < price
    )
      errors.push('Jumlah / harga tidak valid');
    if (returned !== 0 || /pengembalian|return|refund/i.test(r['Status Pesanan'] || ''))
      errors.push('Pesanan retur perlu diperiksa terpisah');
    const identity = JSON.stringify([order, key]);
    if (seen.has(identity)) errors.push('Item berulang dalam pesanan; periksa file sebelum impor');
    seen.add(identity);
    const status = cancelled
      ? 'DILEWATI'
      : existing.has(order)
        ? 'DUPLIKAT'
        : errors.length
          ? 'ERROR'
          : !skuId
            ? 'PETAKAN SKU'
            : 'SIAP';
    return {
      id: String(index),
      key,
      order,
      sku_id: skuId,
      qty,
      price,
      normal,
      date,
      product: r['Nama Produk'],
      variant: r['Nama Variasi'],
      reference: ref,
      tracking: r['No. Resi'] || '',
      shipping: {
        recipient: r['Nama Penerima'] || '',
        phone: r['No. Telepon'] || '',
        address: r['Alamat Pengiriman'] || '',
        city: r['Kota/Kabupaten'] || '',
        province: r['Provinsi'] || '',
        shipping_option: r['Opsi Pengiriman'] || '',
        buyer_notes: r['Catatan dari Pembeli'] || '',
      },
      status,
      errors,
    };
  });
  // A cancelled or duplicate line excludes the whole order; partial order imports are unsafe.
  for (const r of previews) {
    if (previews.some((x) => x.order === r.order && x.status === 'DILEWATI')) r.status = 'DILEWATI';
    if (existing.has(r.order)) r.status = 'DUPLIKAT';
  }
  return previews;
}
export function supplierTemplateOrders(rows: ReturnType<typeof previewShopeeTemplate>) {
  if (rows.some((r) => ['ERROR', 'PETAKAN SKU'].includes(r.status)))
    throw new Error('Lengkapi semua pemetaan dan perbaiki baris bermasalah.');
  const orders = new Map<
    string,
    OrderInput & { tracking_number: string; shipping_snapshot: Record<string, string> }
  >();
  for (const r of rows.filter((r) => r.status === 'SIAP')) {
    let order = orders.get(r.order);
    if (!order) {
      order = {
        channel: 'SHOPEE',
        order_date: r.date,
        external_order_number: r.order,
        tracking_number: r.tracking,
        shipping_snapshot: r.shipping,
        discount: 0,
        items: [],
      };
      orders.set(r.order, order);
    }
    if (
      order.order_date !== r.date ||
      order.tracking_number !== r.tracking ||
      JSON.stringify(order.shipping_snapshot) !== JSON.stringify(r.shipping)
    )
      throw new Error('Tanggal, resi, atau alamat berbeda dalam satu pesanan.');
    order.items.push({
      sku_id: r.sku_id,
      qty: r.qty,
      normal_unit_price: r.normal,
      selling_unit_price: r.price,
      external_item_id: r.key,
      description: `${r.product} / ${r.variant}`,
      allocations: [],
    });
  }
  return [...orders.values()];
}
