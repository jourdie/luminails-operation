-- Allow safe cleanup of unreferenced master relations when deleting a bad input.
drop function if exists public.delete_record(uuid,text,uuid,text);
create function public.delete_record(w uuid,entity text,record_id uuid,permission_module text) returns void language plpgsql security definer set search_path='' as $$
declare changed integer; required_module text;
begin
  if entity not in ('brands','products','skus','suppliers','supplier_cost_versions','inventory_locations','customers','customer_addresses','financial_accounts','financial_balance_snapshots','promotion_rules') then
    raise exception 'INVALID_ENTITY';
  end if;
  required_module := case entity
    when 'brands' then 'products'
    when 'products' then 'products'
    when 'skus' then 'products'
    when 'suppliers' then 'suppliers'
    when 'supplier_cost_versions' then 'suppliers'
    when 'inventory_locations' then 'settings'
    when 'financial_accounts' then 'finance'
    when 'financial_balance_snapshots' then 'finance'
    when 'promotion_rules' then 'b2b'
    else null
  end;
  if entity='customers' then
    select case customer_type when 'RESELLER' then 'reseller' else 'b2b' end into required_module from public.customers where workspace_id=w and id=record_id;
  elsif entity='customer_addresses' then
    select case c.customer_type when 'RESELLER' then 'reseller' else 'b2b' end into required_module from public.customer_addresses a join public.customers c on c.workspace_id=a.workspace_id and c.id=a.customer_id where a.workspace_id=w and a.id=record_id;
  end if;
  if required_module is null then raise exception 'NOT_FOUND'; end if;
  perform private.require_permission(w,required_module,'edit');
  perform private.lock_workspace(w);
  if entity='skus' then
    if exists(select 1 from public.sales_order_items where workspace_id=w and sku_id=record_id) or exists(select 1 from public.procurement_items where workspace_id=w and sku_id=record_id) or exists(select 1 from public.inventory_movements where workspace_id=w and sku_id=record_id) or exists(select 1 from public.import_rows where workspace_id=w and sku_id=record_id and sales_order_id is not null) then
      raise exception 'RECORD_IN_USE';
    end if;
    delete from public.import_rows where workspace_id=w and sku_id=record_id;
    delete from public.promotion_rules where workspace_id=w and sku_id=record_id;
    delete from public.supplier_cost_versions where workspace_id=w and supplier_sku_id in (select id from public.supplier_skus where workspace_id=w and sku_id=record_id);
    delete from public.supplier_skus where workspace_id=w and sku_id=record_id;
  elsif entity='suppliers' then
    if exists(select 1 from public.procurement_orders where workspace_id=w and supplier_id=record_id) or exists(select 1 from public.supplier_deposit_entries where workspace_id=w and supplier_id=record_id) or exists(select 1 from public.fulfillment_allocations where workspace_id=w and supplier_id=record_id) then
      raise exception 'RECORD_IN_USE';
    end if;
    delete from public.supplier_cost_versions where workspace_id=w and supplier_sku_id in (select id from public.supplier_skus where workspace_id=w and supplier_id=record_id);
    delete from public.supplier_skus where workspace_id=w and supplier_id=record_id;
  elsif entity='customers' then
    if exists(select 1 from public.sales_orders where workspace_id=w and customer_id=record_id) or exists(select 1 from public.invoices where workspace_id=w and customer_id=record_id) or exists(select 1 from public.payments where workspace_id=w and customer_id=record_id) then
      raise exception 'RECORD_IN_USE';
    end if;
    delete from public.customer_addresses where workspace_id=w and customer_id=record_id;
  elsif entity='customer_addresses' then
    if exists(select 1 from public.sales_orders where workspace_id=w and address_id=record_id) then raise exception 'RECORD_IN_USE'; end if;
  end if;
  execute format('delete from public.%I where workspace_id=$1 and id=$2',entity) using w,record_id;
  get diagnostics changed = row_count;
  if changed=0 then raise exception 'NOT_FOUND'; end if;
exception
  when foreign_key_violation then raise exception 'RECORD_IN_USE';
end $$;
grant execute on function public.delete_record(uuid,text,uuid,text) to authenticated;