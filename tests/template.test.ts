import { expect, it } from 'vitest';
import {
  previewShopeeTemplate,
  shopeeNumber,
  supplierTemplateOrders,
  templateCatalog,
  requireShopeeTemplate,
} from '../src/features/shopee/template';
const row = {
  'No. Pesanan': 'ORDER-1',
  'Nama Produk': 'Gel',
  'Nama Variasi': 'Merah',
  'SKU Induk': '',
  'Nomor Referensi SKU': '',
  Jumlah: '2',
  'Harga Setelah Diskon': '80.000',
  'Harga Awal': '100.000',
  'Waktu Pesanan Dibuat': '2026-09-12 07:38',
  'Status Pesanan': 'Selesai',
  'No. Resi': 'RESI-1',
  'Returned quantity': '0',
};
const skus = [{ id: 's', sku_code: 'REF', product_id: 'p', variant_name: 'Merah', active: true }],
  products = [{ id: 'p', name: 'Gel' }];
it('handles actual template columns, empty SKU, grouped Indonesian prices and timestamps', () => {
  requireShopeeTemplate(Object.keys(row));
  const parsed = previewShopeeTemplate([row], skus, products, {}, new Set());
  expect(parsed[0]).toMatchObject({
    status: 'SIAP',
    sku_id: 's',
    qty: 2,
    price: 80000,
    date: '2026-09-12',
  });
  const [order] = supplierTemplateOrders(parsed);
  expect(order.items[0].normal_unit_price).toBe(100000);
  expect(order.tracking_number).toBe('RESI-1');
  expect(shopeeNumber('1.234.567,50')).toBe(1234567.5);
  expect(shopeeNumber('')).toBeNaN();
  expect(templateCatalog([row, row])).toHaveLength(1);
});
it('skips cancellations and duplicates, blocks returns and repeated lines', () => {
  expect(
    previewShopeeTemplate([{ ...row, 'Status Pesanan': 'Batal' }], [], [], {}, new Set())[0].status,
  ).toBe('DILEWATI');
  expect(previewShopeeTemplate([row], skus, products, {}, new Set(['ORDER-1']))[0].status).toBe(
    'DUPLIKAT',
  );
  expect(() =>
    supplierTemplateOrders(previewShopeeTemplate([row, row], skus, products, {}, new Set())),
  ).toThrow();
  expect(() =>
    supplierTemplateOrders(
      previewShopeeTemplate([{ ...row, 'Returned quantity': '1' }], skus, products, {}, new Set()),
    ),
  ).toThrow();
  expect(
    previewShopeeTemplate([row], [...skus, { ...skus[0], id: 's2' }], products, {}, new Set())[0]
      .status,
  ).toBe('PETAKAN SKU');
});
