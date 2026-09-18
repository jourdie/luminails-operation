import { beforeAll, afterAll, it, expect } from 'vitest';
import { createLocalDatabase, WORKSPACE as w, MEMBER, OWNER } from '../src/lib/supabase/local';
import type { PGlite } from '@electric-sql/pglite';
let db: PGlite;
const sku = '60000000-0000-0000-0000-000000000002',
  supplier = '30000000-0000-0000-0000-000000000001',
  customer = '70000000-0000-0000-0000-000000000001';
const call = async (name: string, args: unknown[]) =>
  (
    await db.query<{ result: unknown }>(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`,
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)),
    )
  ).rows[0].result;
const balance = async () =>
  Number(
    (
      await db.query<{ balance: string }>(
        'select balance from public.v_supplier_deposit_balance where supplier_id=$1',
        [supplier],
      )
    ).rows[0].balance,
  );
const payload = () => ({
  channel: 'WHATSAPP',
  customer_id: customer,
  order_date: '2026-09-16',
  discount: 0,
  items: [
    { sku_id: sku, qty: 2, normal_unit_price: 120000, selling_unit_price: 100000, allocations: [] },
  ],
});
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});
it('creates a free catalog SKU and immutable dated supplier HPP atomically', async () => {
  const p = {
    product_name: 'Produk bebas dari Shopee',
    sku_code: 'FREE_REF',
    parent_sku: 'PARENT',
    variant_name: 'Warna pilihan',
    product_type: 'Gel Polish',
    supplier_id: supplier,
    cost: '80000',
    effective_from: '2026-09-16',
  };
  const id = await call('save_catalog_sku', [w, p]);
  expect(
    (
      await db.query('select parent_sku,product_type,variant_name from public.skus where id=$1', [
        id,
      ])
    ).rows[0],
  ).toEqual({ parent_sku: 'PARENT', product_type: 'Gel Polish', variant_name: 'Warna pilihan' });
  await call('save_catalog_sku', [w, { ...p, cost: '90000', effective_from: '2026-09-17' }, id]);
  const prices = await db.query<{ cost: string }>(
    'select v.cost from public.supplier_cost_versions v join public.supplier_skus s on s.id=v.supplier_sku_id where s.sku_id=$1 order by effective_from',
    [id],
  );
  expect(prices.rows.map((r) => Number(r.cost))).toEqual([80000, 90000]);
  await expect(
    call('save_catalog_sku', [w, { ...p, cost: '1', effective_from: '2026-09-17' }, id]),
  ).rejects.toThrow();
});
it('issues invoice before supplier draft, reconciles once and deducts only once on atomic posting', async () => {
  const before = await balance(),
    sale = await call('save_sales_order', [w, payload()]);
  const invoice = await call('issue_invoice', [
    w,
    { sales_order_id: sale, due_date: '2026-09-30' },
  ]);
  expect(await balance()).toBe(before);
  await expect(call('save_sales_order', [w, payload(), sale])).rejects.toThrow(
    'VOID_INVOICE_FIRST',
  );
  const p = { invoice_id: invoice, supplier_id: supplier, order_date: '2026-09-16' };
  const purchase = await call('create_supplier_from_invoice', [w, p]);
  expect(await balance()).toBe(before);
  let status = (
    await db.query(
      'select reconciliation_status,supplier_payment_status,customer_payment_status from public.v_manual_order_status where id=$1',
      [sale],
    )
  ).rows[0];
  expect(status).toEqual({
    reconciliation_status: 'Sudah rekonsiliasi',
    supplier_payment_status: 'Belum dibayar',
    customer_payment_status: 'Belum dibayar',
  });
  await expect(call('create_supplier_from_invoice', [w, p])).rejects.toThrow(
    'SOURCE_ALREADY_LINKED',
  );
  await expect(call('update_procurement_draft', [w, purchase, {}])).rejects.toThrow(
    'LINKED_ORDER_LOCKED',
  );
  await expect(call('post_sales_order', [w, sale])).rejects.toThrow('RECONCILIATION_CONFLICT');
  await call('post_procurement_order', [w, purchase]);
  expect(await balance()).toBe(before - 176000);
  expect(
    (
      await db.query<{ status: string }>('select status from public.sales_orders where id=$1', [
        sale,
      ])
    ).rows[0].status,
  ).toBe('POSTED');
  status = (
    await db.query(
      'select supplier_payment_status,customer_payment_status from public.v_manual_order_status where id=$1',
      [sale],
    )
  ).rows[0];
  expect(status).toEqual({
    supplier_payment_status: 'Sudah dibayar',
    customer_payment_status: 'Belum dibayar',
  });
  await expect(call('post_procurement_order', [w, purchase])).rejects.toThrow('IMMUTABLE_POSTED');
  expect(await balance()).toBe(before - 176000);
  await call('void_invoice', [w, invoice]);
  await call('reverse_sales_order', [w, sale]);
  expect(await balance()).toBe(before);
  expect(
    (
      await db.query<{ reconciliation_status: string }>(
        'select reconciliation_status from public.v_manual_order_status where id=$1',
        [sale],
      )
    ).rows[0].reconciliation_status,
  ).toBe('Belum rekonsiliasi');
});
it('cancels a linked supplier draft, clears flags, and allows linking the same invoice again', async () => {
  const sale = await call('save_sales_order', [w, payload()]);
  const invoice = await call('issue_invoice', [
    w,
    { sales_order_id: sale, due_date: '2026-09-30' },
  ]);
  const p = { invoice_id: invoice, supplier_id: supplier, order_date: '2026-09-16' };
  const purchase = await call('create_supplier_from_invoice', [w, p]);
  await expect(call('void_invoice', [w, invoice])).rejects.toThrow('CANCEL_SUPPLIER_DRAFT_FIRST');
  await call('cancel_draft', [w, 'procurement_orders', purchase]);
  expect(
    (
      await db.query<{ reconciliation_status: string }>(
        'select reconciliation_status from public.v_manual_order_status where id=$1',
        [sale],
      )
    ).rows[0].reconciliation_status,
  ).toBe('Belum rekonsiliasi');
  const replacement = await call('create_supplier_from_invoice', [w, p]);
  expect(replacement).not.toBe(purchase);
});
it('rolls back ecommerce import on missing HPP and rejects duplicate orders across channels of import', async () => {
  const p = {
    supplier_id: supplier,
    order_date: '2026-09-16',
    orders: [
      {
        ...payload(),
        channel: 'SHOPEE',
        external_order_number: 'TEMPLATE-ORDER',
        tracking_number: 'RESI-123',
      },
    ],
  };
  const before = await balance();
  expect(await call('import_supplier_shopee', [w, p])).toBe(1);
  expect(await balance()).toBe(before);
  await expect(call('import_supplier_shopee', [w, p])).rejects.toThrow('DUPLICATE_ORDER');
  const purchase = (
    await db.query<{ id: string }>(
      'select id from public.procurement_orders where external_order_number=$1',
      ['TEMPLATE-ORDER'],
    )
  ).rows[0].id;
  await call('post_procurement_order', [w, purchase]);
  expect(await balance()).toBe(before - 176000);
  const noCost = await call('save_catalog_sku', [
    w,
    { product_name: 'No cost', sku_code: 'NO_COST' },
  ]);
  await expect(
    call('import_supplier_shopee', [
      w,
      {
        ...p,
        orders: [
          {
            ...payload(),
            external_order_number: 'FAIL-COST',
            items: [{ ...payload().items[0], sku_id: noCost }],
          },
        ],
      },
    ]),
  ).rejects.toThrow('COST_NOT_FOUND');
  expect(
    (
      await db.query('select id from public.sales_orders where external_order_number=$1', [
        'FAIL-COST',
      ])
    ).rows,
  ).toHaveLength(0);
});
it('rejects unprivileged direct calls to new RPCs', async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [MEMBER]);
  await expect(
    call('save_catalog_sku', [w, { product_name: 'Forbidden', sku_code: 'FORBIDDEN' }]),
  ).rejects.toThrow('ACCESS_DENIED');
  await expect(call('create_supplier_from_invoice', [w, {}])).rejects.toThrow('ACCESS_DENIED');
  await expect(call('import_supplier_shopee', [w, {}])).rejects.toThrow('ACCESS_DENIED');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
});
