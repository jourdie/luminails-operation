import { localMode, supabase } from './client';
import type { Row } from '../../types/domain';
const identifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('INVALID_FIELD');
  return `"${value}"`;
};
export async function getWorkspace(id: string): Promise<Row> {
  if (supabase) {
    const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Row;
  }
  if (!localMode) throw new Error('ACCESS_DENIED');
  const db = await (await import('./local')).localDatabase();
  return (await db.query<Row>('select * from public.workspaces where id=$1', [id])).rows[0];
}
export async function listRows<T extends Row = Row>(
  table: string,
  workspace: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  if (supabase) {
    const all: T[] = [];
    const viewKeys: Record<string, string[]> = {
      v_inventory_balance: ['sku_id', 'location_id'],
      v_inventory_value: ['workspace_id'],
      v_supplier_deposit_balance: ['supplier_id'],
      v_supplier_usage_daily: ['supplier_id', 'transaction_date'],
      v_deposit_forecast: ['supplier_id'],
      v_low_stock: ['sku_id'],
      v_customer_receivables: ['invoice_id'],
      v_sales_pnl: ['sales_order_id'],
      v_customer_pnl: ['customer_id', 'channel'],
      v_sku_performance: ['sku_id', 'order_date', 'channel'],
      v_latest_financial_balances: ['financial_account_id'],
      v_business_position: ['source', 'category'],
      v_reconciliation_candidates: ['sales_order_item_id', 'procurement_item_id'],
      v_reconciliation_status: ['allocation_id'],
      v_financial_snapshots: ['id'],
      v_account_balances: ['financial_account_id'],
    };
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from(table).select('*').eq('workspace_id', workspace);
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      for (const key of viewKeys[table] ?? ['id']) query = query.order(key);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      all.push(...(data as T[]));
      if (data.length < 1000) return all;
    }
  }
  if (!localMode) throw new Error('Supabase belum dikonfigurasi.');
  const db = await (await import('./local')).localDatabase();
  const values = [workspace, ...Object.values(filters)];
  const result = await db.query<T>(
    `select * from public.${identifier(table)} where workspace_id=$1 ${Object.keys(filters)
      .map((k, i) => `and ${identifier(k)}=$${i + 2}`)
      .join(' ')}`,
    values,
  );
  // Match PostgREST's ISO date strings; PGlite otherwise returns JavaScript Dates.
  return result.rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value instanceof Date
            ? result.fields.find((field) => field.name === key)?.dataTypeID === 1082
              ? value.toISOString().slice(0, 10)
              : value.toISOString()
            : value,
        ]),
      ) as T,
  );
}
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  if (supabase) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data as T;
  }
  if (!localMode) throw new Error('Supabase belum dikonfigurasi.');
  const db = await (await import('./local')).localDatabase();
  const values = Object.values(args).map((v) =>
    typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
  );
  const result = await db.query<{ result: T }>(
    `select public.${identifier(name)}(${Object.keys(args)
      .map((k, i) => `${identifier(k)} => $${i + 1}`)
      .join(',')}) as result`,
    values,
  );
  return result.rows[0].result;
}
export async function uploadImport(workspace: string, file: File): Promise<string | undefined> {
  if (!supabase) return undefined;
  const path = `${workspace}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('imports').upload(path, file);
  if (error) throw error;
  return path;
}
