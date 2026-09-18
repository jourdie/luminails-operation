-- Read policies on every public table. All writes go through validated RPCs.
do $$ declare t text; m text; condition text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 case
 when t='workspaces' then condition='exists(select 1 from public.workspace_members m where m.workspace_id=workspaces.id and m.user_id=auth.uid() and m.active)';
 when t='profiles' then condition='id=auth.uid()';
 when t='workspace_members' then condition='user_id=auth.uid() or public.has_permission(workspace_id,''settings'',''view'')';
 when t='member_permissions' then condition='exists(select 1 from public.workspace_members m where m.id=member_permissions.member_id and m.user_id=auth.uid() and m.active) or public.has_permission(workspace_id,''settings'',''view'')';
 when t in ('brands','products','skus') then condition='public.has_permission(workspace_id,''products'') or public.has_permission(workspace_id,''inventory'') or public.has_permission(workspace_id,''b2b'') or public.has_permission(workspace_id,''reseller'') or public.has_permission(workspace_id,''shopee'') or public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''suppliers'')';
 when t='inventory_locations' then condition='public.has_permission(workspace_id,''inventory'') or public.has_permission(workspace_id,''b2b'') or public.has_permission(workspace_id,''reseller'') or public.has_permission(workspace_id,''shopee'') or public.has_permission(workspace_id,''settings'') or public.has_permission(workspace_id,''deposits'')';
 when t='suppliers' then condition='public.has_permission(workspace_id,''suppliers'') or public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''finance'') or public.has_permission(workspace_id,''b2b'') or public.has_permission(workspace_id,''shopee'') or public.has_permission(workspace_id,''reseller'') or public.has_permission(workspace_id,''reconciliation'')';
 when t in ('supplier_skus','supplier_cost_versions') then condition='public.has_permission(workspace_id,''suppliers'') or public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''inventory'')';
 when t='supplier_deposit_entries' then condition='public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''finance'')';
 when t in ('procurement_orders','procurement_items') then condition='public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''inventory'') or public.has_permission(workspace_id,''reconciliation'')';
 when t='inventory_movements' then condition='public.has_permission(workspace_id,''inventory'') or public.has_permission(workspace_id,''finance'')';
 when t='customers' then condition='public.has_permission(workspace_id,case customer_type when ''RESELLER'' then ''reseller'' else ''b2b'' end) or public.has_permission(workspace_id,''finance'')';
 when t='customer_addresses' then condition='exists(select 1 from public.customers c where c.id=customer_addresses.customer_id)';
 when t='sales_orders' then condition='public.has_permission(workspace_id,case channel when ''SHOPEE'' then ''shopee'' when ''RESELLER'' then ''reseller'' else ''b2b'' end) or public.has_permission(workspace_id,''finance'') or public.has_permission(workspace_id,''reconciliation'')';
 when t in ('sales_order_items','sales_order_adjustments') then condition=format('exists(select 1 from public.sales_orders o where o.id=%I.sales_order_id)',t);
 when t='fulfillment_allocations' then condition='exists(select 1 from public.sales_order_items i where i.id=fulfillment_allocations.sales_order_item_id)';
 when t in ('invoices','payments') then condition='public.has_permission(workspace_id,''finance'') or exists(select 1 from public.customers c where c.id='||quote_ident(t)||'.customer_id)';
 when t='invoice_items' then condition='exists(select 1 from public.invoices i where i.id=invoice_items.invoice_id)';
 else
 m=case when t in ('import_batches','import_rows') then 'shopee' when t='reconciliation_links' then 'reconciliation' when t in ('financial_accounts','financial_balance_snapshots','expenses') then 'finance' else 'settings' end;
 condition=format('public.has_permission(workspace_id,%L)',m);
 end case;
 execute format('create policy member_read on public.%I for select to authenticated using (%s)',t,condition);
 if t not in ('audit_logs','workspaces','profiles') then execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t); end if;
 end loop;
end $$;
revoke all on schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
grant select on all tables in schema public to authenticated;
-- security_invoker views preserve the caller's table policies.
alter default privileges in schema public revoke execute on functions from public;
create index inventory_lookup on public.inventory_movements(workspace_id,sku_id,location_id,posted_at);
create index inventory_date on public.inventory_movements(workspace_id,transaction_date);
create index deposit_lookup on public.supplier_deposit_entries(workspace_id,supplier_id,transaction_date);
create index sales_date on public.sales_orders(workspace_id,order_date);
create index sales_customer on public.sales_orders(customer_id,order_date);
create index external_orders on public.sales_orders(workspace_id,external_order_number);
create index sales_items_order on public.sales_order_items(sales_order_id);
create index allocation_item on public.fulfillment_allocations(sales_order_item_id);
create index cost_date on public.supplier_cost_versions(supplier_sku_id,effective_from desc);
create index procurement_items_order on public.procurement_items(procurement_order_id);
create index invoice_customer on public.invoices(workspace_id,customer_id,due_date);
create index payment_invoice on public.payments(invoice_id) where status='POSTED';
create index audit_date on public.audit_logs(workspace_id,created_at desc);
