-- One source order has one active supplier order. Creation and posting are atomic.
create function private.link_supplier_order(w uuid,sale uuid,supplier uuid,d date,kind text,invoice uuid default null,tracking text default null) returns uuid language plpgsql set search_path='' as $$
declare o public.sales_orders; p uuid; pi uuid; i public.sales_order_items;
begin
 select * into o from public.sales_orders where workspace_id=w and id=sale;
 if not found or o.status<>'DRAFT' then raise exception 'INVALID_STATUS'; end if;
 perform private.require_permission(w,private.sales_module(o.channel),'edit');
 if exists(select 1 from public.procurement_orders where workspace_id=w and source_sales_order_id=sale and status not in ('CANCELLED','REVERSED')) then raise exception 'SOURCE_ALREADY_LINKED'; end if;
 if exists(select 1 from public.fulfillment_allocations where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=sale) and (procurement_item_id is not null or fulfillment_type='LOCAL_STOCK' or supplier_id<>supplier)) then raise exception 'SOURCE_ALLOCATION_CONFLICT'; end if;
 insert into public.procurement_orders(workspace_id,supplier_id,order_number,order_date,order_type,source_sales_order_id,source_invoice_id,external_order_number,tracking_number)
 values(w,supplier,'PO-'||upper(substr(gen_random_uuid()::text,1,8)),d,kind,sale,invoice,o.external_order_number,tracking) returning id into p;
 delete from public.fulfillment_allocations where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=sale);
 for i in select * from public.sales_order_items where sales_order_id=sale loop
 perform private.supplier_cost(w,supplier,i.sku_id,d);
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,destination_type,destination_reference_id)
 values(w,p,i.sku_id,i.qty,case when kind='DROPSHIP_ECOMMERCE' then 'SHOPEE_ORDER' else 'B2B_ORDER' end,sale) returning id into pi;
 insert into public.fulfillment_allocations(workspace_id,sales_order_item_id,fulfillment_type,supplier_id,qty,procurement_item_id) values(w,i.id,'SUPPLIER',supplier,i.qty,pi);
 insert into public.reconciliation_links(workspace_id,sales_order_item_id,procurement_item_id,status,confirmed_by,confirmed_at,notes) values(w,i.id,pi,'MATCHED',auth.uid(),now(),'Ditautkan otomatis dari sumber pesanan');
 end loop;
 return p;
end $$;
create function public.create_supplier_from_invoice(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices; o public.sales_orders;
begin
 perform private.require_permission(w,'deposits','create'); perform private.require_permission(w,'b2b','edit'); perform private.lock_workspace(w);
 select * into i from public.invoices where workspace_id=w and id=(payload->>'invoice_id')::uuid;
 if not found or i.status<>'ISSUED' or i.sales_order_id is null then raise exception 'INVOICE_REQUIRED'; end if;
 select * into o from public.sales_orders where workspace_id=w and id=i.sales_order_id;
 if o.channel not in ('WHATSAPP','B2B') then raise exception 'INVOICE_REQUIRED'; end if;
 return private.link_supplier_order(w,o.id,(payload->>'supplier_id')::uuid,(payload->>'order_date')::date,'DROPSHIP_B2B',i.id);
end $$;
create function public.import_supplier_shopee(w uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb; sale uuid; n integer=0;
begin
 perform private.require_permission(w,'deposits','create'); perform private.require_permission(w,'shopee','create'); perform private.lock_workspace(w);
 if jsonb_typeof(payload->'orders')<>'array' or coalesce(jsonb_array_length(payload->'orders'),0)=0 then raise exception 'EMPTY_ORDER'; end if;
 for x in select value from jsonb_array_elements(payload->'orders') loop
 if nullif(x->>'external_order_number','') is null then raise exception 'INVALID_ORDER'; end if;
 if exists(select 1 from public.sales_orders where workspace_id=w and channel='SHOPEE' and external_order_number=x->>'external_order_number' and status<>'CANCELLED')
 or exists(select 1 from public.procurement_orders where workspace_id=w and external_order_number=x->>'external_order_number' and status not in ('CANCELLED','REVERSED')) then raise exception 'DUPLICATE_ORDER'; end if;
 sale=public.save_sales_order(w,x||jsonb_build_object('channel','SHOPEE'));
 perform private.link_supplier_order(w,sale,(payload->>'supplier_id')::uuid,(payload->>'order_date')::date,'DROPSHIP_ECOMMERCE',null,x->>'tracking_number'); n=n+1;
 end loop;
 return n;
end $$;
create or replace function public.cancel_draft(w uuid,entity text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c text; changed integer; source uuid;
begin
 perform private.lock_workspace(w);
 if entity='sales_orders' then
 select channel into c from public.sales_orders where workspace_id=w and id=record_id;
 perform private.require_permission(w,private.sales_module(c),'edit');
 if exists(select 1 from public.invoices where workspace_id=w and sales_order_id=record_id and status<>'VOID') then raise exception 'VOID_INVOICE_FIRST'; end if;
 if exists(select 1 from public.procurement_orders where workspace_id=w and source_sales_order_id=record_id and status not in ('CANCELLED','REVERSED')) then raise exception 'LINKED_ORDER_LOCKED'; end if;
 elsif entity='procurement_orders' then
 perform private.require_permission(w,'deposits','edit');
 select source_sales_order_id into source from public.procurement_orders where workspace_id=w and id=record_id and status='DRAFT';
 if source is not null then
 select channel into c from public.sales_orders where id=source; perform private.require_permission(w,private.sales_module(c),'edit');
 delete from public.reconciliation_links where procurement_item_id in(select id from public.procurement_items where procurement_order_id=record_id);
 delete from public.fulfillment_allocations where procurement_item_id in(select id from public.procurement_items where procurement_order_id=record_id);
 if c='SHOPEE' then update public.sales_orders set status='CANCELLED' where id=source; end if;
 end if;
 else raise exception 'INVALID_ENTITY'; end if;
 execute format('update public.%I set status=''CANCELLED'' where workspace_id=$1 and id=$2 and status=''DRAFT''',entity) using w,record_id;
 get diagnostics changed=row_count; if changed=0 then raise exception 'INVALID_STATUS'; end if;
end $$;
-- An invoice cannot be voided while its supplier draft can still be posted.
create function private.guard_linked_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='VOID' and exists(select 1 from public.procurement_orders where source_invoice_id=new.id and status='DRAFT') then raise exception 'CANCEL_SUPPLIER_DRAFT_FIRST'; end if;
 return new;
end $$;
create trigger guard_linked_invoice before update on public.invoices for each row execute function private.guard_linked_invoice();
create view public.v_manual_order_status with(security_invoker=true) as
select o.*,i.invoice_number,i.id as invoice_id,
 case when exists(select 1 from public.fulfillment_allocations a join public.sales_order_items si on si.id=a.sales_order_item_id join public.procurement_items pi on pi.id=a.procurement_item_id join public.procurement_orders p on p.id=pi.procurement_order_id where si.sales_order_id=o.id and a.active and p.status not in ('CANCELLED','REVERSED')) then 'Sudah rekonsiliasi' else 'Belum rekonsiliasi' end reconciliation_status,
 case when exists(select 1 from public.fulfillment_allocations a join public.sales_order_items si on si.id=a.sales_order_item_id join public.procurement_items pi on pi.id=a.procurement_item_id join public.procurement_orders p on p.id=pi.procurement_order_id where si.sales_order_id=o.id and a.active and p.status in ('POSTED','SHIPPED','RECEIVED')) then 'Sudah dibayar' else 'Belum dibayar' end supplier_payment_status,
 case when i.id is null then 'Belum ada invoice' when coalesce((select sum(amount) from public.payments where invoice_id=i.id and status='POSTED'),0)>=i.total then 'Lunas' when exists(select 1 from public.payments where invoice_id=i.id and status='POSTED') then 'Sebagian' else 'Belum dibayar' end customer_payment_status
from public.sales_orders o left join public.invoices i on i.sales_order_id=o.id and i.status='ISSUED';
grant select on public.v_manual_order_status to authenticated;
grant execute on function public.save_catalog_sku(uuid,jsonb,uuid), public.create_supplier_from_invoice(uuid,jsonb),public.import_supplier_shopee(uuid,jsonb) to authenticated;
revoke all on function private.link_supplier_order(uuid,uuid,uuid,date,text,uuid,text),private.guard_linked_invoice() from public,anon,authenticated;
