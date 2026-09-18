-- Ambiguous manual purchases also require an explicit review, even without an external ID.
create function private.check_reconciliation(w uuid,s uuid,k uuid,q integer,item_id uuid,external_id text,d date) returns void language plpgsql set search_path='' as $$
begin
 if exists(
  select 1 from public.procurement_items p join public.procurement_orders h on h.id=p.procurement_order_id
  where h.workspace_id=w and h.supplier_id=s and p.sku_id=k and p.destination_type<>'WAREHOUSE'
    and p.destination_reference_id is null and h.status in ('POSTED','SHIPPED','RECEIVED')
    and ((external_id is not null and h.external_order_number=external_id) or (p.qty=q and abs(h.order_date-d)<=3))
    and not exists(select 1 from public.fulfillment_allocations a where a.procurement_item_id=p.id and a.active)
    and not exists(select 1 from public.reconciliation_links l where l.sales_order_item_id=item_id and l.procurement_item_id=p.id and l.status='UNMATCHED' and l.active and l.confirmed_by is not null)
 ) then raise exception 'RECONCILIATION_REQUIRED'; end if;
end $$;
create function public.reject_reconciliation(w uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i record;
begin
 perform private.require_permission(w,'reconciliation','post'); perform private.lock_workspace(w);
 select s.id,o.channel,o.status into i from public.sales_order_items s join public.sales_orders o on o.id=s.sales_order_id where s.id=(payload->>'sales_order_item_id')::uuid and s.workspace_id=w;
 if not found or i.status<>'DRAFT' then raise exception 'INVALID_STATUS'; end if;
 perform private.require_permission(w,private.sales_module(i.channel),'edit');
 if not exists(select 1 from public.procurement_items where id=(payload->>'procurement_item_id')::uuid and workspace_id=w) then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.reconciliation_links where sales_order_item_id=i.id and procurement_item_id=(payload->>'procurement_item_id')::uuid and status='MATCHED' and active) then raise exception 'RECONCILIATION_CONFLICT'; end if;
 insert into public.reconciliation_links(workspace_id,sales_order_item_id,procurement_item_id,status,confirmed_by,confirmed_at,notes)
 values(w,i.id,(payload->>'procurement_item_id')::uuid,'UNMATCHED',auth.uid(),now(),coalesce(payload->>'notes','Ditinjau: transaksi berbeda'))
 on conflict(sales_order_item_id,procurement_item_id) do update set status='UNMATCHED',confirmed_by=auth.uid(),confirmed_at=now(),notes=excluded.notes;
end $$;
create or replace view public.v_reconciliation_candidates with(security_invoker=true) as
 select i.workspace_id,i.id sales_order_item_id,o.order_number,o.external_order_number,i.sku_id,i.qty sold_qty,p.id procurement_item_id,p.qty procurement_qty,h.supplier_id,h.order_date,h.tracking_number,
 case when p.qty=i.qty and h.external_order_number=o.external_order_number then 'POTENTIAL_MATCH' else 'CONFLICT' end match_status
 from public.sales_order_items i join public.sales_orders o on o.id=i.sales_order_id join public.procurement_items p on p.workspace_id=i.workspace_id and p.sku_id=i.sku_id join public.procurement_orders h on h.id=p.procurement_order_id
 where o.status='DRAFT' and h.status in ('POSTED','SHIPPED','RECEIVED') and p.destination_type<>'WAREHOUSE' and p.destination_reference_id is null
 and ((o.external_order_number is not null and o.external_order_number=h.external_order_number) or abs(o.order_date-h.order_date)<=3)
 and exists(select 1 from public.fulfillment_allocations a where a.sales_order_item_id=i.id and a.fulfillment_type='SUPPLIER' and a.supplier_id=h.supplier_id)
 and not exists(select 1 from public.fulfillment_allocations a where a.procurement_item_id=p.id and a.active)
 and not exists(select 1 from public.reconciliation_links l where l.sales_order_item_id=i.id and l.procurement_item_id=p.id and l.active and l.confirmed_by is not null)
 and public.has_permission(i.workspace_id,'reconciliation','view');
create view public.v_reconciliation_status with(security_invoker=true) as
 select a.workspace_id,a.id allocation_id,i.id sales_order_item_id,o.order_number,i.sku_id,a.supplier_id,a.qty,
 case when a.procurement_item_id is not null then 'MATCHED'
 when (select count(*) from public.v_reconciliation_candidates c where c.sales_order_item_id=i.id)>1 then 'CONFLICT'
 when exists(select 1 from public.v_reconciliation_candidates c where c.sales_order_item_id=i.id) then 'POTENTIAL_MATCH'
 else 'UNMATCHED' end status
 from public.fulfillment_allocations a join public.sales_order_items i on i.id=a.sales_order_item_id join public.sales_orders o on o.id=i.sales_order_id
 where a.fulfillment_type='SUPPLIER' and a.active and o.status='DRAFT' and public.has_permission(a.workspace_id,'reconciliation');
revoke all on function private.check_reconciliation(uuid,uuid,uuid,integer,uuid,text,date) from public,anon,authenticated;
grant execute on function public.reject_reconciliation(uuid,jsonb) to authenticated;
grant select on public.v_reconciliation_status to authenticated;
-- JSON numeric parsers may lose precision. Preserve FX decimals as text at the API boundary.
create view public.v_financial_snapshots with(security_invoker=true) as
 select id,workspace_id,financial_account_id,snapshot_date,amount_original_currency::text amount_original_currency,currency,exchange_rate::text exchange_rate,amount_idr::text amount_idr,notes
 from public.financial_balance_snapshots;
create view public.v_account_balances with(security_invoker=true) as
 select workspace_id,financial_account_id,name,account_type,currency,snapshot_date,amount_original_currency::text amount_original_currency,exchange_rate::text exchange_rate,amount_idr::text amount_idr
 from public.v_latest_financial_balances;
grant select on public.v_financial_snapshots,public.v_account_balances to authenticated;
-- Reference data is readable by the modules that need it; writes remain separately gated.
do $$ declare t text; begin
 for t in select unnest(array['brands','products','skus']) loop
 execute format('drop policy member_read on public.%I',t);
 execute format('create policy member_read on public.%I for select to authenticated using (public.has_permission(workspace_id,''products'') or public.has_permission(workspace_id,''inventory'') or public.has_permission(workspace_id,''b2b'') or public.has_permission(workspace_id,''reseller'') or public.has_permission(workspace_id,''shopee'') or public.has_permission(workspace_id,''deposits'') or public.has_permission(workspace_id,''suppliers'') or public.has_permission(workspace_id,''finance'') or public.has_permission(workspace_id,''reconciliation''))',t);
 end loop;
end $$;
drop policy member_read on public.suppliers;
create policy member_read on public.suppliers for select to authenticated using(public.has_permission(workspace_id,'suppliers') or public.has_permission(workspace_id,'deposits') or public.has_permission(workspace_id,'finance') or public.has_permission(workspace_id,'b2b') or public.has_permission(workspace_id,'shopee') or public.has_permission(workspace_id,'reseller') or public.has_permission(workspace_id,'reconciliation') or public.has_permission(workspace_id,'inventory'));
create or replace function private.validate_sales_address() returns trigger language plpgsql set search_path='' as $$
declare c public.customers;
begin
 if new.customer_id is not null then
 select * into c from public.customers where id=new.customer_id and workspace_id=new.workspace_id;
 if not found or not c.active then raise exception 'INVALID_CUSTOMER'; end if;
 perform private.require_permission(new.workspace_id,case c.customer_type when 'RESELLER' then 'reseller' else 'b2b' end,'view');
 end if;
 if new.address_id is not null and not exists(select 1 from public.customer_addresses where id=new.address_id and customer_id=new.customer_id and workspace_id=new.workspace_id) then raise exception 'INVALID_ADDRESS'; end if;
 if new.status='POSTED' and exists(select 1 from public.sales_order_items i join public.skus s on s.id=i.sku_id where i.sales_order_id=new.id and not s.active) then raise exception 'INVALID_SKU'; end if;
 return new;
end $$;
create or replace function public.post_sales_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.sales_orders; i public.sales_order_items; a public.fulfillment_allocations; c numeric; po uuid; pi uuid; old_pi record;
begin perform private.lock_workspace(w);
 select * into o from public.sales_orders where id=record_id and workspace_id=w for update; if not found then raise exception 'NOT_FOUND'; end if;
 perform private.require_permission(w,private.sales_module(o.channel),'post'); if o.status<>'DRAFT' then raise exception 'IMMUTABLE_POSTED'; end if;
 if not exists(select 1 from public.sales_order_items where sales_order_id=o.id) then raise exception 'EMPTY_ORDER'; end if;
 for i in select * from public.sales_order_items where sales_order_id=o.id order by id loop
 if (select coalesce(sum(qty),0) from public.fulfillment_allocations where sales_order_item_id=i.id)<>i.qty then raise exception 'ALLOCATION_MISMATCH'; end if;
 for a in select * from public.fulfillment_allocations where sales_order_item_id=i.id order by id loop
 if a.fulfillment_type='LOCAL_STOCK' then
 c=private.stock_cost(w,i.sku_id,a.inventory_location_id,a.qty);
 insert into public.inventory_movements(workspace_id,sku_id,location_id,transaction_date,qty_delta,movement_type,unit_cost,source_type,source_id) values(w,i.sku_id,a.inventory_location_id,o.order_date,-a.qty,o.channel||'_SALE',c,'sales',o.id);
 else
 if a.procurement_item_id is not null then
 select p.*,h.supplier_id,h.status,h.external_order_number into old_pi from public.procurement_items p join public.procurement_orders h on h.id=p.procurement_order_id where p.id=a.procurement_item_id and p.workspace_id=w;
 if not found or old_pi.sku_id<>i.sku_id or old_pi.qty<>a.qty or old_pi.supplier_id<>a.supplier_id or old_pi.destination_type='WAREHOUSE' or old_pi.status not in ('POSTED','SHIPPED','RECEIVED') then raise exception 'RECONCILIATION_CONFLICT'; end if;
 if not exists(select 1 from public.reconciliation_links where sales_order_item_id=i.id and procurement_item_id=a.procurement_item_id and status='MATCHED' and active) then raise exception 'RECONCILIATION_REQUIRED'; end if;
 c=old_pi.unit_cost_snapshot;
 else
 -- A possible existing manual dropship must be reviewed before a new deduction.
 perform private.check_reconciliation(w,a.supplier_id,i.sku_id,a.qty,i.id,o.external_order_number,o.order_date);
 c=private.supplier_cost(w,a.supplier_id,i.sku_id,o.order_date);
 insert into public.procurement_orders(workspace_id,supplier_id,order_number,order_date,status,external_order_number,posted_at) values(w,a.supplier_id,'PO-'||upper(substr(gen_random_uuid()::text,1,8)),o.order_date,'POSTED',o.external_order_number,now()) returning id into po;
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,unit_cost_snapshot,destination_type,destination_reference_id) values(w,po,i.sku_id,a.qty,c,case o.channel when 'SHOPEE' then 'SHOPEE_ORDER' when 'B2B' then 'B2B_ORDER' when 'RESELLER' then 'RESELLER_ORDER' else 'CUSTOMER' end,o.id) returning id into pi;
 perform private.deduct_deposit(w,a.supplier_id,a.qty*c,po,o.order_date);
 update public.fulfillment_allocations set procurement_item_id=pi where id=a.id;
 end if;
 end if;
 update public.fulfillment_allocations set unit_cost_snapshot=c where id=a.id;
 end loop;
 update public.sales_order_items set unit_cost_snapshot=(select round(sum(qty*unit_cost_snapshot)/i.qty,6) from public.fulfillment_allocations where sales_order_item_id=i.id) where id=i.id;
 end loop;
 update public.sales_orders set status='POSTED',posted_at=now() where id=o.id;
end $$;

