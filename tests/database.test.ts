import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createLocalDatabase, WORKSPACE as w, OWNER, MEMBER } from '../src/lib/supabase/local';
import type { PGlite } from '@electric-sql/pglite';
let db: PGlite;
const sku = '60000000-0000-0000-0000-000000000002',
  supplier = '30000000-0000-0000-0000-000000000001',
  location = '40000000-0000-0000-0000-000000000001';
async function call(name: string, args: unknown[]) {
  const r = await db.query<{ result: unknown }>(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`,
    args.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)),
  );
  return r.rows[0].result;
}
async function balance() {
  return Number(
    (
      await db.query<{ balance: string }>(
        'select balance from public.v_supplier_deposit_balance where supplier_id=$1',
        [supplier],
      )
    ).rows[0].balance,
  );
}
async function stock() {
  return Number(
    (
      await db.query<{ current_stock: number }>(
        'select current_stock from public.v_inventory_balance where sku_id=$1 and location_id=$2',
        [sku, location],
      )
    ).rows[0].current_stock,
  );
}
function order(qty: number, local: number, external?: string) {
  return {
    channel: 'SHOPEE',
    order_date: '2026-09-15',
    external_order_number: external,
    discount: 0,
    items: [
      {
        sku_id: sku,
        qty,
        normal_unit_price: 120000,
        selling_unit_price: 100000,
        external_item_id: 'item-1',
        allocations: [
          ...(local
            ? [{ fulfillment_type: 'LOCAL_STOCK', inventory_location_id: location, qty: local }]
            : []),
          ...(qty - local
            ? [{ fulfillment_type: 'SUPPLIER', supplier_id: supplier, qty: qty - local }]
            : []),
        ],
      },
    ],
  };
}
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe('PostgreSQL acceptance: shared production migrations', () => {
  it('records all business tables with RLS enabled and private buckets', async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(tables.rows.length).toBeGreaterThan(30);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
    await db.exec('reset role');
    const buckets = await db.query<{ public: boolean }>('select public from storage.buckets');
    expect(buckets.rows).toHaveLength(3);
    expect(buckets.rows.every((b) => !b.public)).toBe(true);
    await db.exec('set role authenticated');
  });
  it('supplier dropship deducts exactly 880,000 and no local stock', async () => {
    const b = await balance(),
      s = await stock();
    const id = await call('save_sales_order', [w, order(10, 0)]);
    await call('post_sales_order', [w, id]);
    expect(await balance()).toBe(b - 880000);
    expect(await stock()).toBe(s);
  });
  it('restock deducts deposit at posting and adds stock only once at receipt', async () => {
    const b = await balance(),
      s = await stock();
    const id = await call('save_procurement_order', [
      w,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        items: [
          { sku_id: sku, qty: 12, destination_type: 'WAREHOUSE', inventory_location_id: location },
        ],
      },
    ]);
    await call('post_procurement_order', [w, id]);
    expect(await balance()).toBe(b - 1056000);
    expect(await stock()).toBe(s);
    await call('receive_procurement_order', [w, id]);
    expect(await stock()).toBe(s + 12);
    await expect(call('receive_procurement_order', [w, id])).rejects.toThrow('INVALID_STATUS');
  });
  it('mixed fulfillment posts 3 local + 17 supplier and reverses once', async () => {
    const b = await balance(),
      s = await stock();
    const id = await call('save_sales_order', [w, order(20, 3)]);
    await call('post_sales_order', [w, id]);
    expect(await stock()).toBe(s - 3);
    expect(await balance()).toBe(b - 17 * 88000);
    await call('reverse_sales_order', [w, id]);
    expect(await stock()).toBe(s);
    expect(await balance()).toBe(b);
    await expect(call('reverse_sales_order', [w, id])).rejects.toThrow('INVALID_STATUS');
  });
  it('unallocated order fails atomically', async () => {
    const b = await balance(),
      s = await stock();
    const o = order(20, 3);
    o.items[0].allocations[1].qty = 16;
    const id = await call('save_sales_order', [w, o]);
    await expect(call('post_sales_order', [w, id])).rejects.toThrow('ALLOCATION_MISMATCH');
    expect(await balance()).toBe(b);
    expect(await stock()).toBe(s);
  });
  it('overdrawn stock cannot partially deduct supplier deposit', async () => {
    const b = await balance();
    const id = await call('save_sales_order', [w, order(9999, 9998)]);
    await expect(call('post_sales_order', [w, id])).rejects.toThrow('INSUFFICIENT_STOCK');
    expect(await balance()).toBe(b);
  });
  it('cost versions retain historical snapshot', async () => {
    const id = await call('save_sales_order', [w, order(1, 0)]);
    await call('post_sales_order', [w, id]);
    await call('change_supplier_cost', [
      w,
      { supplier_id: supplier, sku_id: sku, cost: '92000', effective_from: '2026-09-16' },
    ]);
    const future = order(1, 0);
    future.order_date = '2026-09-16';
    const next = await call('save_sales_order', [w, future]);
    await call('post_sales_order', [w, next]);
    const rows = await db.query<{ unit_cost_snapshot: string }>(
      'select unit_cost_snapshot from public.sales_order_items where sales_order_id=any($1::uuid[]) order by unit_cost_snapshot',
      [[id, next]],
    );
    expect(rows.rows.map((r) => Number(r.unit_cost_snapshot))).toEqual([88000, 92000]);
  });
  it('duplicate marketplace identity is rejected', async () => {
    await call('save_sales_order', [w, order(1, 0, 'UNIQUE-1')]);
    await expect(call('save_sales_order', [w, order(1, 0, 'UNIQUE-1')])).rejects.toThrow(
      /duplicate key/,
    );
  });
  it('finance-disabled member sees zero finance rows and cannot write', async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [MEMBER]);
    expect((await db.query('select * from public.financial_accounts')).rows).toHaveLength(0);
    expect((await db.query('select * from public.v_business_position')).rows).toHaveLength(0);
    await expect(
      call('record_finance', [
        w,
        'expenses',
        { expense_date: '2026-09-15', category: 'Other', amount: 1, description: 'test' },
      ]),
    ).rejects.toThrow('ACCESS_DENIED');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
  });
  it('browser cannot directly edit ledger or grant itself permissions', async () => {
    await expect(db.query('update public.inventory_movements set qty_delta=999')).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query('update public.member_permissions set can_view=true')).rejects.toThrow(
      /permission denied/,
    );
  });
  it('reconciles manual dropship without deducting twice', async () => {
    const manual = await call('save_procurement_order', [
      w,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        external_order_number: 'RECON-001',
        items: [{ sku_id: sku, qty: 10, destination_type: 'SHOPEE_ORDER' }],
      },
    ]);
    await call('post_procurement_order', [w, manual]);
    const balanceBefore = await balance();
    const id = await call('save_sales_order', [w, order(10, 0, 'RECON-001')]);
    await expect(call('post_sales_order', [w, id])).rejects.toThrow('RECONCILIATION_REQUIRED');
    const pi = (
      await db.query<{ id: string }>(
        'select id from public.procurement_items where procurement_order_id=$1',
        [manual],
      )
    ).rows[0].id;
    const si = (
      await db.query<{ id: string }>(
        'select id from public.sales_order_items where sales_order_id=$1',
        [id],
      )
    ).rows[0].id;
    await call('confirm_reconciliation', [w, { sales_order_item_id: si, procurement_item_id: pi }]);
    await call('post_sales_order', [w, id]);
    expect(await balance()).toBe(balanceBefore);
    await call('reverse_sales_order', [w, id]);
    expect(await balance()).toBe(balanceBefore);
  });
  it('invoice branch and product snapshots survive later master edits', async () => {
    const customer = '70000000-0000-0000-0000-000000000001';
    const branches = await db.query<{ id: string; branch_name: string }>(
      'select * from public.customer_addresses where customer_id=$1',
      [customer],
    );
    expect(branches.rows).toHaveLength(3);
    const draft = { ...order(1, 1), channel: 'B2B', customer_id: customer };
    const sale = await call('save_sales_order', [w, draft]);
    await call('post_sales_order', [w, sale]);
    const invoice = await call('issue_invoice', [
      w,
      { sales_order_id: sale, address_id: branches.rows[0].id, due_date: '2026-10-01' },
    ]);
    await call('save_master', [
      w,
      'customer_addresses',
      { customer_id: customer, address: 'Updated address', branch_name: 'Changed' },
      branches.rows[0].id,
    ]);
    const row = (
      await db.query<{ address_snapshot: { address: string }; status: string }>(
        'select * from public.invoices where id=$1',
        [invoice],
      )
    ).rows[0];
    expect(row.address_snapshot.address).toBe('Alamat contoh untuk pengujian');
    await expect(
      db.query('update public.invoices set total=1 where id=$1', [invoice]),
    ).rejects.toThrow(/permission denied/);
    await call('record_payment', [
      w,
      {
        invoice_id: invoice,
        payment_date: '2026-09-15',
        amount: 40000,
        payment_method: 'Transfer Bank',
      },
    ]);
    const outstanding = (
      await db.query<{ outstanding: string }>(
        'select outstanding from public.v_customer_receivables where invoice_id=$1',
        [invoice],
      )
    ).rows[0];
    expect(Number(outstanding.outstanding)).toBe(60000);
    await expect(
      call('record_payment', [
        w,
        {
          invoice_id: invoice,
          payment_date: '2026-09-15',
          amount: 60001,
          payment_method: 'Transfer Bank',
        },
      ]),
    ).rejects.toThrow('PAYMENT_EXCEEDS_BALANCE');
  });
  it('weighted average uses receipt value and snapshots outgoing cost', async () => {
    const k = '60000000-0000-0000-0000-000000000009';
    await call('post_stock_adjustment', [
      w,
      {
        sku_id: k,
        location_id: location,
        transaction_date: '2026-09-15',
        qty_delta: 24,
        movement_type: 'ADJUSTMENT_IN',
        unit_cost: 12000,
        notes: 'test receipt',
      },
    ]);
    const cost = (
      await db.query<{ average_cost: string }>(
        'select average_cost from public.v_inventory_balance where sku_id=$1',
        [k],
      )
    ).rows[0];
    expect(Number(cost.average_cost)).toBe(10000);
    await call('post_stock_adjustment', [
      w,
      {
        sku_id: k,
        location_id: location,
        transaction_date: '2026-09-15',
        qty_delta: -4,
        movement_type: 'DAMAGE',
        unit_cost: 1,
        notes: 'test damage',
      },
    ]);
    const after = (
      await db.query<{ current_stock: number; average_cost: string }>(
        'select * from public.v_inventory_balance where sku_id=$1',
        [k],
      )
    ).rows[0];
    expect(after.current_stock).toBe(44);
    expect(Number(after.average_cost)).toBe(10000);
  });
  it('imports the same file a second time without new orders', async () => {
    const importOrder = order(1, 0, 'BATCH-DUPLICATE');
    const payload = {
      filename: 'test.csv',
      column_mapping: {},
      rows: [
        {
          external_order_id: 'BATCH-DUPLICATE',
          external_item_id: 'item-1',
          sku_id: sku,
          status: 'NEW',
        },
      ],
    };
    const b1 = await call('save_import_preview', [w, payload]);
    expect(await call('commit_import', [w, { batch_id: b1, orders: [importOrder] }])).toEqual({
      created: 1,
      duplicates: 0,
    });
    const b2 = await call('save_import_preview', [w, payload]);
    expect(await call('commit_import', [w, { batch_id: b2, orders: [importOrder] }])).toEqual({
      created: 0,
      duplicates: 1,
    });
  });
  it('cross-workspace foreign references fail even through owner RPC', async () => {
    await db.exec('reset role');
    const other = '10000000-0000-0000-0000-000000000002';
    await db.query('insert into public.workspaces(id,name) values($1,$2)', [
      other,
      'Other workspace',
    ]);
    await db.exec('set role authenticated');
    await expect(
      call('save_master', [
        w,
        'skus',
        { product_id: '50000000-0000-0000-0000-000000000099', sku_code: 'BAD' },
      ]),
    ).rejects.toThrow(/foreign key/);
    expect(
      (await db.query('select * from public.workspaces where id=$1', [other])).rows,
    ).toHaveLength(0);
  });
  it('an authenticated uninvited account has no workspace access', async () => {
    await db.exec('reset role');
    await db.query(
      "insert into auth.users values('90000000-0000-0000-0000-000000000003','stranger@example.test',now())",
    );
    await db.exec('set role authenticated');
    await db.query(
      "select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',false)",
    );
    await call('claim_memberships', []);
    expect((await db.query('select * from public.workspaces')).rows).toHaveLength(0);
    await expect(
      call('post_supplier_deposit_topup', [
        w,
        { supplier_id: supplier, entry_type: 'TOPUP', amount: 1, transaction_date: '2026-09-15' },
      ]),
    ).rejects.toThrow('ACCESS_DENIED');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
  });
  it('a corrected sale can reuse a reversed sale’s manual procurement allocation', async () => {
    const procurement = (
      await db.query<{ id: string }>(
        'select i.id from public.procurement_items i join public.procurement_orders o on o.id=i.procurement_order_id where o.external_order_number=$1',
        ['RECON-001'],
      )
    ).rows[0].id;
    const replacement = await call('save_sales_order', [w, order(10, 0, 'RECON-001-CORRECTED')]);
    const item = (
      await db.query<{ id: string }>(
        'select id from public.sales_order_items where sales_order_id=$1',
        [replacement],
      )
    ).rows[0].id;
    const before = await balance();
    await call('confirm_reconciliation', [
      w,
      { sales_order_item_id: item, procurement_item_id: procurement },
    ]);
    await call('post_sales_order', [w, replacement]);
    expect(await balance()).toBe(before);
  });
  it('paid invoices can be voided after reversing their payment', async () => {
    const payment = (
      await db.query<{ id: string; invoice_id: string }>(
        'select id,invoice_id from public.payments where status=$1',
        ['POSTED'],
      )
    ).rows[0];
    await call('reverse_finance', [w, 'payments', payment.id]);
    await expect(call('reverse_finance', [w, 'payments', payment.id])).rejects.toThrow(
      'INVALID_STATUS',
    );
    await call('void_invoice', [w, payment.invoice_id]);
    expect(
      (
        await db.query<{ status: string }>('select status from public.invoices where id=$1', [
          payment.invoice_id,
        ])
      ).rows[0].status,
    ).toBe('VOID');
  });
  it('ambiguous manual dropship requires a reviewed rejection before a new deduction', async () => {
    const manual = await call('save_procurement_order', [
      w,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        items: [{ sku_id: sku, qty: 7, destination_type: 'CUSTOMER' }],
      },
    ]);
    await call('post_procurement_order', [w, manual]);
    const sale = await call('save_sales_order', [w, order(7, 0, 'AMBIGUOUS-TEST')]);
    await expect(call('post_sales_order', [w, sale])).rejects.toThrow('RECONCILIATION_REQUIRED');
    const item = (
      await db.query<{ id: string }>(
        'select id from public.sales_order_items where sales_order_id=$1',
        [sale],
      )
    ).rows[0].id;
    const purchaseItem = (
      await db.query<{ id: string }>(
        'select id from public.procurement_items where procurement_order_id=$1',
        [manual],
      )
    ).rows[0].id;
    await call('reject_reconciliation', [
      w,
      { sales_order_item_id: item, procurement_item_id: purchaseItem },
    ]);
    const before = await balance();
    await call('post_sales_order', [w, sale]);
    expect(await balance()).toBe(before - 7 * 88000);
  });
  it('preserves FX decimals across the API view and audited snapshot correction', async () => {
    const account = await call('save_master', [
      w,
      'financial_accounts',
      { name: 'FX precision test', account_type: 'FX_ASSET', currency: 'USD' },
    ]);
    const amount = '12345678901234.12345678',
      rate = '15345.12345678';
    const snapshot = await call('record_finance', [
      w,
      'financial_balance_snapshots',
      {
        financial_account_id: account,
        snapshot_date: '2026-09-16',
        amount_original_currency: amount,
        currency: 'USD',
        exchange_rate: rate,
      },
    ]);
    const row = (
      await db.query<{ amount_original_currency: string; exchange_rate: string }>(
        'select * from public.v_financial_snapshots where id=$1',
        [snapshot],
      )
    ).rows[0];
    expect(row.amount_original_currency).toBe(amount);
    expect(row.exchange_rate).toBe(rate);
    await call('correct_financial_snapshot', [
      w,
      snapshot,
      { amount_original_currency: '1.12345678', exchange_rate: rate, notes: 'Correction test' },
    ]);
    expect(
      (
        await db.query<{ amount_original_currency: string }>(
          'select amount_original_currency from public.v_financial_snapshots where id=$1',
          [snapshot],
        )
      ).rows[0].amount_original_currency,
    ).toBe('1.12345678');
    expect(
      (
        await db.query("select id from public.audit_logs where entity_id=$1 and action='UPDATE'", [
          snapshot,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it('cancelled drafts and shipped procurement enforce their transitions', async () => {
    const draft = await call('save_procurement_order', [
      w,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        items: [{ sku_id: sku, qty: 1, destination_type: 'CUSTOMER' }],
      },
    ]);
    await call('cancel_draft', [w, 'procurement_orders', draft]);
    await expect(call('cancel_draft', [w, 'procurement_orders', draft])).rejects.toThrow(
      'INVALID_STATUS',
    );
    const po = await call('save_procurement_order', [
      w,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        items: [{ sku_id: sku, qty: 1, destination_type: 'CUSTOMER' }],
      },
    ]);
    await call('update_procurement_draft', [
      w,
      po,
      {
        supplier_id: supplier,
        order_date: '2026-09-15',
        items: [{ sku_id: sku, qty: 2, destination_type: 'CUSTOMER' }],
      },
    ]);
    await call('post_procurement_order', [w, po]);
    await call('mark_procurement_shipped', [w, po, { tracking_number: 'TEST-TRACK' }]);
    expect(
      (
        await db.query<{ status: string }>(
          'select status from public.procurement_orders where id=$1',
          [po],
        )
      ).rows[0].status,
    ).toBe('SHIPPED');
    await expect(
      call('update_procurement_draft', [
        w,
        po,
        { supplier_id: supplier, order_date: '2026-09-15', items: [] },
      ]),
    ).rejects.toThrow('IMMUTABLE_POSTED');
  });
});
