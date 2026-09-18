-- Preserve recipient data and expose only authorized sales status summaries.
create function public.sales_supplier_state(w uuid,sale uuid) returns table(reconciliation_status text,supplier_payment_status text) language plpgsql stable security definer set search_path='' as $$
declare channel_name text;
begin
 select channel into channel_name from public.sales_orders where workspace_id=w and id=sale;
 if channel_name is null or not (public.has_permission(w,private.sales_module(channel_name),'view') or public.has_permission(w,'finance','view') or public.has_permission(w,'reconciliation','view')) then raise exception 'ACCESS_DENIED'; end if;
 return query select
 case when count(*)>0 and bool_and(coalesce(p.status not in ('CANCELLED','REVERSED'),false)) then 'Sudah rekonsiliasi' else 'Belum rekonsiliasi' end,
 case when count(*)>0 and bool_and(coalesce(p.status in ('POSTED','SHIPPED','RECEIVED'),false)) then 'Sudah dibayar' else 'Belum dibayar' end
 from public.sales_order_items si join public.fulfillment_allocations a on a.sales_order_item_id=si.id and a.active and a.fulfillment_type='SUPPLIER'
 left join public.procurement_items pi on pi.id=a.procurement_item_id left join public.procurement_orders p on p.id=pi.procurement_order_id
 where si.workspace_id=w and si.sales_order_id=sale;
end $$;
grant execute on function public.sales_supplier_state(uuid,uuid) to authenticated;
create or replace view public.v_manual_order_status with(security_invoker=true) as
select o.*,i.invoice_number,i.id as invoice_id,s.reconciliation_status,s.supplier_payment_status,
 case when i.id is null then 'Belum ada invoice' when coalesce((select sum(amount) from public.payments where invoice_id=i.id and status='POSTED'),0)>=i.total then 'Lunas' when exists(select 1 from public.payments where invoice_id=i.id and status='POSTED') then 'Sebagian' else 'Belum dibayar' end customer_payment_status
from public.sales_orders o left join public.invoices i on i.sales_order_id=o.id and i.status='ISSUED'
cross join lateral public.sales_supplier_state(o.workspace_id,o.id) s;
alter table public.procurement_orders add column shipping_snapshot jsonb;
create or replace function public.create_supplier_from_invoice(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices; o public.sales_orders; p uuid;
begin
 perform private.require_permission(w,'deposits','create'); perform private.require_permission(w,'b2b','edit'); perform private.lock_workspace(w);
 select * into i from public.invoices where workspace_id=w and id=(payload->>'invoice_id')::uuid;
 if not found or i.status<>'ISSUED' or i.sales_order_id is null then raise exception 'INVOICE_REQUIRED'; end if;
 select * into o from public.sales_orders where workspace_id=w and id=i.sales_order_id;
 if o.channel not in ('WHATSAPP','B2B') then raise exception 'INVOICE_REQUIRED'; end if;
 p=private.link_supplier_order(w,o.id,(payload->>'supplier_id')::uuid,(payload->>'order_date')::date,'DROPSHIP_B2B',i.id);
 update public.procurement_orders set shipping_snapshot=i.address_snapshot where id=p;
 return p;
end $$;
create or replace function public.import_supplier_shopee(w uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb; sale uuid; p uuid; n integer=0;
begin
 perform private.require_permission(w,'deposits','create'); perform private.require_permission(w,'shopee','create'); perform private.lock_workspace(w);
 if jsonb_typeof(payload->'orders')<>'array' or coalesce(jsonb_array_length(payload->'orders'),0)=0 then raise exception 'EMPTY_ORDER'; end if;
 for x in select value from jsonb_array_elements(payload->'orders') loop
 if nullif(x->>'external_order_number','') is null then raise exception 'INVALID_ORDER'; end if;
 if exists(select 1 from public.sales_orders where workspace_id=w and channel='SHOPEE' and external_order_number=x->>'external_order_number' and status<>'CANCELLED')
 or exists(select 1 from public.procurement_orders where workspace_id=w and external_order_number=x->>'external_order_number' and status not in ('CANCELLED','REVERSED')) then raise exception 'DUPLICATE_ORDER'; end if;
 sale=public.save_sales_order(w,x||jsonb_build_object('channel','SHOPEE'));
 p=private.link_supplier_order(w,sale,(payload->>'supplier_id')::uuid,(payload->>'order_date')::date,'DROPSHIP_ECOMMERCE',null,x->>'tracking_number');
 update public.procurement_orders set shipping_snapshot=x->'shipping_snapshot' where id=p; n=n+1;
 end loop;
 return n;
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
 insert into public.procurement_orders(workspace_id,supplier_id,order_number,order_date,status,external_order_number,posted_at,order_type) values(w,a.supplier_id,'PO-'||upper(substr(gen_random_uuid()::text,1,8)),o.order_date,'POSTED',o.external_order_number,now(),case when o.channel='SHOPEE' then 'DROPSHIP_ECOMMERCE' else 'DROPSHIP_B2B' end) returning id into po;
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
update public.procurement_orders p set order_type=case when exists(select 1 from public.procurement_items i where i.procurement_order_id=p.id and i.destination_type='SHOPEE_ORDER') then 'DROPSHIP_ECOMMERCE' else 'DROPSHIP_B2B' end where p.order_type='RESTOCK' and exists(select 1 from public.procurement_items i where i.procurement_order_id=p.id and i.destination_type<>'WAREHOUSE');
create or replace function public.update_procurement_draft(w uuid,record_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i jsonb;
begin perform private.require_permission(w,'deposits','edit'); perform private.lock_workspace(w);
 if exists(select 1 from public.procurement_orders where id=record_id and workspace_id=w and source_sales_order_id is not null) then raise exception 'LINKED_ORDER_LOCKED'; end if;
 if not exists(select 1 from public.procurement_orders where id=record_id and workspace_id=w and status='DRAFT') then raise exception 'IMMUTABLE_POSTED'; end if;
 update public.procurement_orders set supplier_id=(payload->>'supplier_id')::uuid,order_date=(payload->>'order_date')::date,external_order_number=nullif(payload->>'external_order_number',''),tracking_number=payload->>'tracking_number',notes=payload->>'notes' where id=record_id;
 delete from public.procurement_items where procurement_order_id=record_id;
 if jsonb_array_length(payload->'items')<1 then raise exception 'EMPTY_ORDER'; end if;
 for i in select value from jsonb_array_elements(payload->'items') loop
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,destination_type,inventory_location_id) values(w,record_id,(i->>'sku_id')::uuid,(i->>'qty')::integer,i->>'destination_type',nullif(i->>'inventory_location_id','')::uuid);
 end loop;
end $$;
