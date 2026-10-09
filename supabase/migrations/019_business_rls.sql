do $$
declare table_name text;
begin
  foreach table_name in array array[
    'brands', 'suppliers', 'products', 'skus', 'channel_skus', 'supplier_skus', 'supplier_cost_versions',
    'inventory_locations', 'inventory_movements', 'supplier_deposit_movements', 'restocks', 'restock_items',
    'sales_orders', 'sales_order_items', 'sales_order_adjustments', 'fulfillment_allocations',
    'import_batches', 'import_rows', 'settlement_import_batches', 'settlement_import_rows',
    'reconciliation_records', 'customers', 'customer_branches', 'b2b_invoices', 'payments', 'settlement_entries', 'webhook_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists workspace_read on public.%I', table_name);
    execute format('create policy workspace_read on public.%I for select using (public.is_active_workspace_member(workspace_id))', table_name);
  end loop;

  foreach table_name in array array['financial_accounts', 'expenses', 'liabilities', 'liability_transactions', 'financial_balance_snapshots'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists finance_read on public.%I', table_name);
    execute format('create policy finance_read on public.%I for select using (public.has_workspace_permission(workspace_id, ''finance'', ''view''))', table_name);
  end loop;
end;
$$;
