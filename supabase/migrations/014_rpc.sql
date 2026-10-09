create or replace function public.post_stock_adjustment(
  target_workspace_id uuid,
  target_sku_id uuid,
  target_location_id uuid,
  target_qty_delta numeric,
  target_unit_cost numeric,
  target_source_id uuid,
  target_source_type text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare movement_id uuid;
begin
  if not public.has_workspace_permission(target_workspace_id, 'inventory', 'post') then
    raise exception 'permission_denied';
  end if;
  if target_qty_delta = 0 or target_unit_cost < 0 then
    raise exception 'invalid_adjustment';
  end if;
  insert into public.inventory_movements (workspace_id, sku_id, location_id, transaction_date, qty_delta, movement_type, unit_cost_snapshot, source_type, source_id, created_by)
  values (target_workspace_id, target_sku_id, target_location_id, current_date, target_qty_delta, case when target_qty_delta > 0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end, target_unit_cost, target_source_type, target_source_id, auth.uid())
  returning id into movement_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, after_data)
  values (target_workspace_id, auth.uid(), 'STOCK_ADJUSTMENT', 'inventory_movement', movement_id, jsonb_build_object('qty_delta', target_qty_delta));
  return movement_id;
end;
$$;

create or replace function public.post_supplier_deposit_topup(
  target_workspace_id uuid,
  target_supplier_id uuid,
  target_amount numeric,
  target_source_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare movement_id uuid;
begin
  if not public.has_workspace_permission(target_workspace_id, 'supplier_deposit', 'post') then
    raise exception 'permission_denied';
  end if;
  if target_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into public.supplier_deposit_movements (workspace_id, supplier_id, transaction_date, amount_delta, movement_type, source_type, source_id, created_by)
  values (target_workspace_id, target_supplier_id, current_date, target_amount, 'TOP_UP', 'DEPOSIT_TOP_UP', target_source_id, auth.uid())
  returning id into movement_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, after_data)
  values (target_workspace_id, auth.uid(), 'SUPPLIER_DEPOSIT_TOP_UP', 'supplier_deposit_movement', movement_id, jsonb_build_object('amount', target_amount));
  return movement_id;
end;
$$;

create or replace function public.post_fulfillment(target_workspace_id uuid, target_order_id uuid, target_location_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  allocation record;
  source_supplier_id uuid;
  source_amount numeric;
begin
  if not public.has_workspace_permission(target_workspace_id, 'shopee_orders', 'post') then raise exception 'permission_denied'; end if;
  if exists (select 1 from public.fulfillment_allocations fa join public.sales_order_items soi on soi.id = fa.sales_order_item_id where soi.sales_order_id = target_order_id and fa.is_posted) then
    raise exception 'fulfillment_already_posted';
  end if;
  if exists (
    select 1 from public.sales_order_items soi
    where soi.sales_order_id = target_order_id
      and soi.qty <> (select coalesce(sum(fa.qty), 0) from public.fulfillment_allocations fa where fa.sales_order_item_id = soi.id)
  ) then raise exception 'fulfillment_quantity_mismatch'; end if;

  for allocation in
    select fa.*, soi.sku_id, o.order_date, o.channel
    from public.fulfillment_allocations fa
    join public.sales_order_items soi on soi.id = fa.sales_order_item_id
    join public.sales_orders o on o.id = soi.sales_order_id
    where o.id = target_order_id
  loop
    if allocation.source_type = 'INVENTORY' then
      if (select coalesce(sum(im.qty_delta), 0) from public.inventory_movements im where im.workspace_id = target_workspace_id and im.sku_id = allocation.sku_id and im.location_id = target_location_id) < allocation.qty then raise exception 'inventory_insufficient'; end if;
      insert into public.inventory_movements (workspace_id, sku_id, location_id, transaction_date, qty_delta, movement_type, unit_cost_snapshot, source_type, source_id, created_by)
      values (target_workspace_id, allocation.sku_id, target_location_id, allocation.order_date, -allocation.qty, case when allocation.channel = 'SHOPEE' then 'SHOPEE_SALE' else 'MANUAL_SALE' end, allocation.unit_cost_snapshot, 'SALES_ORDER', target_order_id, auth.uid());
    else
      source_supplier_id := allocation.supplier_id;
      source_amount := allocation.qty * allocation.unit_cost_snapshot;
      if (select coalesce(sum(sdm.amount_delta), 0) from public.supplier_deposit_movements sdm where sdm.workspace_id = target_workspace_id and sdm.supplier_id = source_supplier_id) < source_amount then raise exception 'supplier_deposit_insufficient'; end if;
      insert into public.supplier_deposit_movements (workspace_id, supplier_id, transaction_date, amount_delta, movement_type, source_type, source_id, created_by)
      values (target_workspace_id, source_supplier_id, allocation.order_date, -source_amount, 'DROPSHIP_USAGE', 'SALES_ORDER', target_order_id, auth.uid());
    end if;
    update public.fulfillment_allocations set is_posted = true, posted_at = now() where id = allocation.id;
  end loop;
  update public.sales_orders set internal_status = 'COMPLETED', posted_at = now() where id = target_order_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, after_data)
  values (target_workspace_id, auth.uid(), 'FULFILLMENT_POSTED', 'sales_order', target_order_id, jsonb_build_object('posted_at', now()));
end;
$$;

create or replace function public.record_payment(target_workspace_id uuid, target_invoice_id uuid, target_amount numeric, target_payment_date date)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare payment_id uuid;
begin
  if not public.has_workspace_permission(target_workspace_id, 'finance', 'post') then raise exception 'permission_denied'; end if;
  if target_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into public.payments (workspace_id, invoice_id, amount, payment_date, created_by)
  values (target_workspace_id, target_invoice_id, target_amount, target_payment_date, auth.uid()) returning id into payment_id;
  insert into public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, after_data)
  values (target_workspace_id, auth.uid(), 'PAYMENT_RECORDED', 'payment', payment_id, jsonb_build_object('amount', target_amount));
  return payment_id;
end;
$$;
