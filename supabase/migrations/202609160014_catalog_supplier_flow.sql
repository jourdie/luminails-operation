-- Shopee catalog and invoice-first supplier orders. Existing ledgers remain unchanged.
alter table public.skus add column parent_sku text not null default '', add column product_type text not null default '';
alter table public.procurement_orders add column order_type text not null default 'RESTOCK' check(order_type in ('RESTOCK','DROPSHIP_ECOMMERCE','DROPSHIP_B2B')),
 add column source_sales_order_id uuid, add column source_invoice_id uuid,
 add foreign key(workspace_id,source_sales_order_id) references public.sales_orders(workspace_id,id),
 add foreign key(workspace_id,source_invoice_id) references public.invoices(workspace_id,id);
create unique index procurement_active_source on public.procurement_orders(workspace_id,source_sales_order_id) where status not in ('CANCELLED','REVERSED');

create function public.save_catalog_sku(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid; k uuid; old_cost numeric;
begin
 perform private.require_permission(w,'products',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 if nullif(trim(payload->>'product_name'),'') is null or nullif(trim(payload->>'sku_code'),'') is null then raise exception 'INVALID_SKU'; end if;
 if record_id is not null and not exists(select 1 from public.skus where id=record_id and workspace_id=w) then raise exception 'NOT_FOUND'; end if;
 select id into p from public.products where workspace_id=w and name=trim(payload->>'product_name') order by id limit 1;
 if p is null then insert into public.products(workspace_id,name) values(w,trim(payload->>'product_name')) returning id into p; end if;
 if record_id is null then
 insert into public.skus(workspace_id,product_id,sku_code,variant_name,parent_sku,product_type) values(w,p,trim(payload->>'sku_code'),coalesce(payload->>'variant_name',''),coalesce(payload->>'parent_sku',''),coalesce(payload->>'product_type','')) returning id into k;
 else
 update public.skus set product_id=p,sku_code=trim(payload->>'sku_code'),variant_name=coalesce(payload->>'variant_name',''),parent_sku=coalesce(payload->>'parent_sku',''),product_type=coalesce(payload->>'product_type','') where workspace_id=w and id=record_id returning id into k;
 end if;
 if nullif(payload->>'cost','') is not null then
 perform private.require_permission(w,'suppliers','edit');
 if nullif(payload->>'supplier_id','') is null or nullif(payload->>'effective_from','') is null then raise exception 'COST_NOT_FOUND'; end if;
 select v.cost into old_cost from public.supplier_cost_versions v join public.supplier_skus ss on ss.id=v.supplier_sku_id where ss.workspace_id=w and ss.supplier_id=(payload->>'supplier_id')::uuid and ss.sku_id=k and v.effective_from=(payload->>'effective_from')::date;
 if old_cost is distinct from (payload->>'cost')::numeric then
 perform public.change_supplier_cost(w,payload||jsonb_build_object('sku_id',k));
 end if;
 end if; return k;
end $$;
create or replace function public.issue_invoice(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.sales_orders; c public.customers; address jsonb; r uuid; seq integer;
begin perform private.lock_workspace(w); select * into o from public.sales_orders where id=(payload->>'sales_order_id')::uuid and workspace_id=w;
 if not found or o.status not in ('DRAFT','POSTED') or o.customer_id is null then raise exception 'INVOICE_REQUIRES_CUSTOMER'; end if;
 perform private.require_permission(w,private.sales_module(o.channel),'post');
 select * into c from public.customers where id=o.customer_id;
 if nullif(payload->>'address_id','') is not null then
 select to_jsonb(a) into address from public.customer_addresses a where id=(payload->>'address_id')::uuid and customer_id=c.id and workspace_id=w;
 if address is null then raise exception 'INVALID_ADDRESS'; end if;
 end if;
 select count(*)+1 into seq from public.invoices where workspace_id=w and extract(year from created_at)=extract(year from now());
 insert into public.invoices(workspace_id,sales_order_id,customer_id,invoice_number,due_date,customer_snapshot,address_snapshot,settings_snapshot,normal_subtotal,selling_subtotal,adjustment_total,total,notes)
 values(w,o.id,c.id,'LUM-INV-'||to_char(current_date,'YYYY')||'-'||lpad(seq::text,4,'0'),(payload->>'due_date')::date,to_jsonb(c),address,(select invoice_settings from public.workspaces where id=w),o.normal_subtotal,o.selling_subtotal,o.adjustment_total,o.grand_total,payload->>'notes') returning id into r;
 insert into public.invoice_items(workspace_id,invoice_id,sku_snapshot,description,qty,normal_unit_price,unit_price,line_total) select w,r,jsonb_build_object('sku_code',s.sku_code,'name',p.name,'variant_name',s.variant_name),i.description,i.qty,i.normal_unit_price,i.selling_unit_price,i.selling_line_total from public.sales_order_items i join public.skus s on s.id=i.sku_id join public.products p on p.id=s.product_id where i.sales_order_id=o.id;
 return r;
end $$;
create or replace function public.save_sales_order(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare o uuid; i jsonb; a jsonb; item_id uuid; c text; discount numeric; n numeric; s numeric; old_order public.sales_orders;
begin
 c=payload->>'channel'; perform private.require_permission(w,private.sales_module(c),case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 if record_id is not null then
 select * into old_order from public.sales_orders where id=record_id and workspace_id=w for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.require_permission(w,private.sales_module(old_order.channel),'edit');
 if exists(select 1 from public.invoices where sales_order_id=record_id and status<>'VOID') then raise exception 'VOID_INVOICE_FIRST'; end if;
 if exists(select 1 from public.procurement_orders where source_sales_order_id=record_id and status not in ('CANCELLED','REVERSED')) then raise exception 'LINKED_ORDER_LOCKED'; end if;
 if old_order.status<>'DRAFT' then raise exception 'IMMUTABLE_POSTED'; end if;
 if old_order.channel<>c then raise exception 'CHANNEL_IMMUTABLE'; end if;
 delete from public.reconciliation_links where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=record_id);
 delete from public.fulfillment_allocations where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=record_id);
 delete from public.sales_order_adjustments where sales_order_id=record_id;
 delete from public.sales_order_items where sales_order_id=record_id;
 o=record_id;
 update public.sales_orders set order_date=(payload->>'order_date')::date, customer_id=nullif(payload->>'customer_id','')::uuid,address_id=nullif(payload->>'address_id','')::uuid,notes=payload->>'notes' where id=o;
 else
 insert into public.sales_orders(workspace_id,order_number,channel,order_date,customer_id,address_id,external_order_number,notes) values(w,'LUM-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,8)),c,(payload->>'order_date')::date,nullif(payload->>'customer_id','')::uuid,nullif(payload->>'address_id','')::uuid,nullif(payload->>'external_order_number',''),payload->>'notes') returning id into o;
 end if;
 if jsonb_array_length(payload->'items')<1 then raise exception 'EMPTY_ORDER'; end if;
 for i in select value from jsonb_array_elements(payload->'items') loop
 if not exists(select 1 from public.skus where id=(i->>'sku_id')::uuid and workspace_id=w and active) then raise exception 'INVALID_SKU'; end if;
 insert into public.sales_order_items(workspace_id,sales_order_id,sku_id,external_item_id,qty,normal_unit_price,selling_unit_price,description) values(w,o,(i->>'sku_id')::uuid,nullif(i->>'external_item_id',''),(i->>'qty')::integer,(i->>'normal_unit_price')::numeric,(i->>'selling_unit_price')::numeric,i->>'description') returning id into item_id;
 for a in select value from jsonb_array_elements(coalesce(i->'allocations','[]')) loop
 insert into public.fulfillment_allocations(workspace_id,sales_order_item_id,fulfillment_type,supplier_id,inventory_location_id,qty,procurement_item_id) values(w,item_id,a->>'fulfillment_type',nullif(a->>'supplier_id','')::uuid,nullif(a->>'inventory_location_id','')::uuid,(a->>'qty')::integer,nullif(a->>'procurement_item_id','')::uuid);
 end loop;
 end loop;
 discount=coalesce((payload->>'discount')::numeric,0); if discount<0 then raise exception 'INVALID_DISCOUNT'; end if;
 if discount>0 then insert into public.sales_order_adjustments(workspace_id,sales_order_id,adjustment_type,description,amount) values(w,o,'DISCOUNT','Diskon tambahan',-discount); end if;
 select sum(normal_line_total),sum(selling_line_total) into n,s from public.sales_order_items where sales_order_id=o;
 if discount>s then raise exception 'NEGATIVE_TOTAL'; end if;
 update public.sales_orders set normal_subtotal=n,selling_subtotal=s,adjustment_total=-discount,grand_total=s-discount,updated_at=now() where id=o;
 return o;
end $$;
create or replace function public.update_procurement_draft(w uuid,record_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i jsonb;
begin
 if exists(select 1 from public.procurement_orders where id=record_id and workspace_id=w and source_sales_order_id is not null) then raise exception 'LINKED_ORDER_LOCKED'; end if; perform private.require_permission(w,'deposits','edit'); perform private.lock_workspace(w);
 if not exists(select 1 from public.procurement_orders where id=record_id and workspace_id=w and status='DRAFT') then raise exception 'IMMUTABLE_POSTED'; end if;
 update public.procurement_orders set supplier_id=(payload->>'supplier_id')::uuid,order_date=(payload->>'order_date')::date,external_order_number=nullif(payload->>'external_order_number',''),tracking_number=payload->>'tracking_number',notes=payload->>'notes' where id=record_id;
 delete from public.procurement_items where procurement_order_id=record_id;
 if jsonb_array_length(payload->'items')<1 then raise exception 'EMPTY_ORDER'; end if;
 for i in select value from jsonb_array_elements(payload->'items') loop
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,destination_type,inventory_location_id) values(w,record_id,(i->>'sku_id')::uuid,(i->>'qty')::integer,i->>'destination_type',nullif(i->>'inventory_location_id','')::uuid);
 end loop;
end $$;
create or replace function public.post_procurement_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.procurement_orders; i public.procurement_items; c numeric; total numeric=0;
begin perform private.require_permission(w,'deposits','post'); perform private.lock_workspace(w);
 select * into o from public.procurement_orders where id=record_id and workspace_id=w for update; if not found then raise exception 'NOT_FOUND'; end if;
 if o.status<>'DRAFT' then raise exception 'IMMUTABLE_POSTED'; end if;
 if not exists(select 1 from public.procurement_items where procurement_order_id=o.id) then raise exception 'EMPTY_ORDER'; end if;
 for i in select * from public.procurement_items where procurement_order_id=o.id loop
 c=private.supplier_cost(w,o.supplier_id,i.sku_id,o.order_date); update public.procurement_items set unit_cost_snapshot=c where id=i.id; total=total+i.qty*c;
 end loop;
 perform private.deduct_deposit(w,o.supplier_id,total,o.id,o.order_date);
 update public.procurement_orders set status='POSTED',posted_at=now() where id=o.id;
 if o.source_sales_order_id is not null then perform public.post_sales_order(w,o.source_sales_order_id); end if;
end $$;
