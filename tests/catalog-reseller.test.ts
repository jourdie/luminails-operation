import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createLocalDatabase, WORKSPACE as w } from '../src/lib/supabase/local';
import type { PGlite } from '@electric-sql/pglite';
let db: PGlite;
const supplier = '30000000-0000-0000-0000-000000000001';
async function call(name: string, args: unknown[]) {
  const result = await db.query<{ result: unknown }>(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`,
    args.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)),
  );
  return result.rows[0].result;
}
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db.close();
});
describe('catalog and reseller workflow', () => {
  it('stores class, SKU type, retail price and supplier HPP from a template row', async () => {
    const result = await call('import_catalog_skus', [
      w,
      {
        rows: [
          {
            'Product Class': 'Gel Polish',
            'Product Name': 'Ruby',
            'SKU Type': 'Base Coat',
            'SKU Code': 'TPL-RUBY',
            'SKU Induk': '',
            Variant: 'Clear',
            'Retail Price': '140000',
            Supplier: supplier,
            HPP: '80000',
            'Effective From': '2026-09-18',
            Active: 'TRUE',
          },
        ],
      },
    ]);
    expect(result).toBe(1);
    const row = (
      await db.query<{ product_class: string; sku_type: string; retail_price: string }>(
        'select p.product_class,s.sku_type,s.retail_price from public.skus s join public.products p on p.id=s.product_id where s.sku_code=$1',
        ['TPL-RUBY'],
      )
    ).rows[0];
    expect(row).toEqual({
      product_class: 'Gel Polish',
      sku_type: 'Base Coat',
      retail_price: '140000.00',
    });
  });
  it('saves tiered promotion rules and rejects overlapping active rules', async () => {
    const first = await call('save_promotion_rule', [w, { name: 'Gel Polish Promo', product_class: 'Gel Polish', min_spend: '3000000', free_qty: '1', tiers: [{ min_qty: 12, unit_price: 120000 }, { min_qty: 24, unit_price: 117000 }, { min_qty: 36, unit_price: 114000 }] }]);
    expect(first).toBeTruthy();
    const rows = await db.query<{ min_qty: number; unit_price: string }>('select min_qty,unit_price from public.promotion_tiers where promotion_rule_id=$1 order by min_qty', [first]);
    expect(rows.rows).toEqual([{ min_qty: 12, unit_price: '120000.00' }, { min_qty: 24, unit_price: '117000.00' }, { min_qty: 36, unit_price: '114000.00' }]);
    await expect(call('save_promotion_rule', [w, { name: 'Collision', product_class: 'Gel Polish', tiers: [{ min_qty: 12, unit_price: 110000 }] }])).rejects.toThrow('PROMOTION_OVERLAP');
  });
  it('imports the simplified Merk/Product/Product Type SKU template', async () => {
    const result = await call('import_catalog_skus', [w, { rows: [{ Merk: 'PARTY', Product: 'Essentials', 'Product Type': 'Gel Polish', Variant: 'Clear', 'SKU Code': 'TPL-SIMPLE', 'SKU Induk': '', Supplier: supplier, 'Retail Price': '140000', HPP: '88000' }] }]);
    expect(result).toBe(1);
    const row = (await db.query<{ product_class: string; name: string; product_set: string }>('select p.product_class,p.name,p.product_set from public.skus s join public.products p on p.id=s.product_id where s.sku_code=$1', ['TPL-SIMPLE'])).rows[0];
    expect(row).toEqual({ product_class: 'Gel Polish', name: 'Essentials', product_set: 'Essentials' });
  });
  it('creates a B2B customer and posts template stock adjustments to the default warehouse', async () => {
    const customer = await call('save_b2b_customer', [w, { customer_type: 'B2B', name: 'B2B Test', has_multiple_branches: false, address: 'Jalan Test', city: 'Jakarta', active: true }]);
    expect((await db.query('select 1 from public.customers where id=$1 and customer_type=\'B2B\'', [customer])).rows).toHaveLength(1);
    expect((await db.query('select 1 from public.customer_addresses where customer_id=$1', [customer])).rows).toHaveLength(1);
    const count = await call('post_stock_adjustments', [w, { rows: [{ sku_code: 'LUM-001', movement_type: 'ADJUSTMENT_IN', qty_delta: 5, unit_cost: 88000, transaction_date: '2026-09-18', notes: 'Template test' }] }]);
    expect(count).toBe(1);
    const movement = (await db.query<{ location_id: string; qty_delta: number }>('select location_id,qty_delta from public.inventory_movements where notes=$1 order by id desc limit 1', ['Template test'])).rows[0];
    expect(movement.qty_delta).toBe(5);
    expect((await db.query('select 1 from public.inventory_locations where id=$1', [movement.location_id])).rows).toHaveLength(1);
  });  it('deletes an unused SKU together with its supplier and HPP links', async () => {
    await call('import_catalog_skus', [w, { rows: [{ Merk: 'PARTY', Product: 'Delete Me', 'Product Type': 'Gel Polish', Variant: 'Clear', 'SKU Code': 'TPL-DELETE', 'SKU Induk': '', Supplier: supplier, 'Retail Price': '140000', HPP: '88000' }] }]);
    const sku = (await db.query<{ id: string }>('select id from public.skus where sku_code=$1', ['TPL-DELETE'])).rows[0].id;
    expect((await db.query('select 1 from public.supplier_skus where sku_id=$1', [sku])).rows).toHaveLength(1);
    await call('delete_record', [w, 'skus', sku, 'products']);
    expect((await db.query('select 1 from public.skus where id=$1', [sku])).rows).toHaveLength(0);
    expect((await db.query('select 1 from public.supplier_skus where sku_id=$1', [sku])).rows).toHaveLength(0);
  });  it('deletes an unreferenced master row and protects linked rows', async () => {
    const id = await call('save_master', [w, 'brands', { name: 'Hapus Test' }]);
    await call('delete_record', [w, 'brands', id, 'products']);
    expect((await db.query('select 1 from public.brands where id=$1', [id])).rows).toHaveLength(0);
    await expect(call('delete_record', [w, 'brands', '20000000-0000-0000-0000-000000000001', 'products'])).rejects.toThrow('RECORD_IN_USE');
  });  it('creates a default address for a single-location reseller and none for multi-branch', async () => {
    const single = await call('save_reseller_customer', [
      w,
      {
        name: 'Single Reseller',
        has_multiple_branches: false,
        recipient: 'PIC',
        phone: '0812',
        address: 'Jalan Satu',
        city: 'Jakarta',
        province: 'DKI',
        postal_code: '12345',
        payment_terms: '14',
        credit_limit: '0',
        active: true,
      },
    ]);
    const address = (
      await db.query<{ branch_name: string; address: string }>(
        'select branch_name,address from public.customer_addresses where customer_id=$1',
        [single],
      )
    ).rows[0];
    expect(address).toEqual({ branch_name: 'Utama', address: 'Jalan Satu' });
    const multi = await call('save_reseller_customer', [
      w,
      {
        name: 'Multi Reseller',
        has_multiple_branches: true,
        payment_terms: '0',
        credit_limit: '0',
        active: true,
      },
    ]);
    expect(
      (await db.query('select 1 from public.customer_addresses where customer_id=$1', [multi]))
        .rows,
    ).toHaveLength(0);
  });
});



