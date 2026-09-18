import { PGlite } from '@electric-sql/pglite';
import cleanSeed from '../../../supabase/seed.sql?raw';
import testSeed from '../../../supabase/test-seed.sql?raw';
export const WORKSPACE = '10000000-0000-0000-0000-000000000001';
export const OWNER = '90000000-0000-0000-0000-000000000001';
export const MEMBER = '90000000-0000-0000-0000-000000000002';
const migrations = import.meta.glob('../../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const bootstrap = `
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to authenticated;
grant execute on function auth.uid() to authenticated;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
`;
export async function createLocalDatabase(persist = false) {
  const db = new PGlite(persist ? 'idb://luminails-v2' : undefined);
  await db.waitReady;
  const exists = await db.query<{ exists: boolean }>(
    "select exists(select 1 from pg_namespace where nspname='auth')",
  );
  if (!exists.rows[0].exists) await db.exec(bootstrap);
  await db.exec(
    'create schema if not exists local_meta; create table if not exists local_meta.migrations(name text primary key)',
  );
  const applied = new Set(
    (await db.query<{ name: string }>('select name from local_meta.migrations')).rows.map(
      (r) => r.name,
    ),
  );
  for (const [name, sql] of Object.entries(migrations).sort(([a], [b]) => a.localeCompare(b))) {
    if (applied.has(name)) continue;
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query('insert into local_meta.migrations(name) values($1)', [name]);
      });
    } catch (error) {
      throw new Error(`Migration ${name}: ${String(error)}`);
    }
  }
  if (persist && exists.rows[0].exists) {
    // Remove only records created by the original demo/test seed. User-entered records are kept.
    try {
      await db.exec(`
      delete from public.payments where invoice_id in (select id from public.invoices where customer_id in ('70000000-0000-0000-0000-000000000001'::uuid,'70000000-0000-0000-0000-000000000002'::uuid));
      delete from public.invoice_items where invoice_id in (select id from public.invoices where customer_id in ('70000000-0000-0000-0000-000000000001'::uuid,'70000000-0000-0000-0000-000000000002'::uuid));
      delete from public.invoices where customer_id in ('70000000-0000-0000-0000-000000000001'::uuid,'70000000-0000-0000-0000-000000000002'::uuid);
      delete from public.reconciliation_links where sales_order_item_id in (select i.id from public.sales_order_items i join public.sales_orders o on o.id=i.sales_order_id where o.external_order_number like 'BROWSER-%');
      delete from public.fulfillment_allocations where sales_order_item_id in (select i.id from public.sales_order_items i join public.sales_orders o on o.id=i.sales_order_id where o.external_order_number like 'BROWSER-%');
      delete from public.sales_order_adjustments where sales_order_id in (select id from public.sales_orders where external_order_number like 'BROWSER-%');
      delete from public.sales_order_items where sales_order_id in (select id from public.sales_orders where external_order_number like 'BROWSER-%');
      delete from public.sales_orders where external_order_number like 'BROWSER-%';
      delete from public.procurement_items where procurement_order_id in (select id from public.procurement_orders where external_order_number like 'BROWSER-%');
      delete from public.procurement_orders where external_order_number like 'BROWSER-%';
      delete from public.customer_addresses where customer_id in ('70000000-0000-0000-0000-000000000001'::uuid,'70000000-0000-0000-0000-000000000002'::uuid);
      delete from public.customers where id in ('70000000-0000-0000-0000-000000000001'::uuid,'70000000-0000-0000-0000-000000000002'::uuid);
      delete from public.financial_balance_snapshots where financial_account_id in ('80000000-0000-0000-0000-000000000001'::uuid,'80000000-0000-0000-0000-000000000002'::uuid,'80000000-0000-0000-0000-000000000003'::uuid,'80000000-0000-0000-0000-000000000004'::uuid);
      delete from public.financial_accounts where id in ('80000000-0000-0000-0000-000000000001'::uuid,'80000000-0000-0000-0000-000000000002'::uuid,'80000000-0000-0000-0000-000000000003'::uuid,'80000000-0000-0000-0000-000000000004'::uuid);
      delete from public.supplier_deposit_entries where notes='DATA UJI';
      delete from public.inventory_movements where source_type='seed' or notes like 'DATA UJI%';
      delete from public.supplier_cost_versions where supplier_sku_id in (select id from public.supplier_skus where sku_id in ('60000000-0000-0000-0000-000000000001'::uuid,'60000000-0000-0000-0000-000000000002'::uuid,'60000000-0000-0000-0000-000000000003'::uuid,'60000000-0000-0000-0000-000000000004'::uuid,'60000000-0000-0000-0000-000000000005'::uuid,'60000000-0000-0000-0000-000000000006'::uuid,'60000000-0000-0000-0000-000000000007'::uuid,'60000000-0000-0000-0000-000000000008'::uuid,'60000000-0000-0000-0000-000000000009'::uuid));
      delete from public.supplier_skus where sku_id in ('60000000-0000-0000-0000-000000000001'::uuid,'60000000-0000-0000-0000-000000000002'::uuid,'60000000-0000-0000-0000-000000000003'::uuid,'60000000-0000-0000-0000-000000000004'::uuid,'60000000-0000-0000-0000-000000000005'::uuid,'60000000-0000-0000-0000-000000000006'::uuid,'60000000-0000-0000-0000-000000000007'::uuid,'60000000-0000-0000-0000-000000000008'::uuid,'60000000-0000-0000-0000-000000000009'::uuid);
      delete from public.skus where id in ('60000000-0000-0000-0000-000000000001'::uuid,'60000000-0000-0000-0000-000000000002'::uuid,'60000000-0000-0000-0000-000000000003'::uuid,'60000000-0000-0000-0000-000000000004'::uuid,'60000000-0000-0000-0000-000000000005'::uuid,'60000000-0000-0000-0000-000000000006'::uuid,'60000000-0000-0000-0000-000000000007'::uuid,'60000000-0000-0000-0000-000000000008'::uuid,'60000000-0000-0000-0000-000000000009'::uuid);
      delete from public.products where id in ('50000000-0000-0000-0000-000000000001'::uuid,'50000000-0000-0000-0000-000000000002'::uuid,'50000000-0000-0000-0000-000000000003'::uuid,'50000000-0000-0000-0000-000000000004'::uuid,'50000000-0000-0000-0000-000000000005'::uuid,'50000000-0000-0000-0000-000000000006'::uuid,'50000000-0000-0000-0000-000000000007'::uuid,'50000000-0000-0000-0000-000000000008'::uuid,'50000000-0000-0000-0000-000000000009'::uuid);
      delete from public.brands where id in ('20000000-0000-0000-0000-000000000001'::uuid,'20000000-0000-0000-0000-000000000002'::uuid);
      delete from public.suppliers where id in ('30000000-0000-0000-0000-000000000001'::uuid,'30000000-0000-0000-0000-000000000002'::uuid);
      delete from public.inventory_locations where id='40000000-0000-0000-0000-000000000001'::uuid;
      `);
    } catch {
      // Existing user data can legitimately reference an old demo row; keep the app available.
    }
  }
  if (!exists.rows[0].exists) {
    await db.exec(persist ? cleanSeed : testSeed);
    await db.exec(`insert into auth.users values ('${OWNER}','owner@example.test',now()),('${MEMBER}','member@example.test',now());
      insert into public.workspace_members(workspace_id,user_id,email,role) values('${WORKSPACE}','${OWNER}','owner@example.test','OWNER'),('${WORKSPACE}','${MEMBER}','member@example.test','MEMBER');`);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
  await db.exec('set role authenticated');
  return db;
}
let database: Promise<PGlite> | undefined;
export function localDatabase() {
  database ??= createLocalDatabase(true);
  return database;
}


/**
 * Reset the browser-only workspace database. This intentionally removes all
 * local operational data; the next page load recreates the empty workspace
 * and the local owner/member records from the clean seed.
 */
export async function cleanseLocalData() {
  if (typeof indexedDB === 'undefined') throw new Error('LOCAL_CLEANSING_UNAVAILABLE');
  const current = database;
  database = undefined;
  if (current) await (await current).close();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('luminails-v2');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('LOCAL_CLEANSING_FAILED'));
    request.onblocked = () => reject(new Error('LOCAL_CLEANSING_BLOCKED'));
  });
}