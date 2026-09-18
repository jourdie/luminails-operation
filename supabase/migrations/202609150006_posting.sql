create function private.sales_module(c text) returns text language sql immutable as $$ select case c when 'SHOPEE' then 'shopee' when 'RESELLER' then 'reseller' else 'b2b' end $$;
create function private.supplier_cost(w uuid,s uuid,k uuid,d date) returns numeric language plpgsql set search_path = '' as $$
declare c numeric;
begin
 select v.cost into c from public.supplier_cost_versions v join public.supplier_skus ss on ss.id=v.supplier_sku_id join public.suppliers sp on sp.id=ss.supplier_id join public.skus sk on sk.id=ss.sku_id
 where ss.workspace_id=w and ss.supplier_id=s and ss.sku_id=k and sp.active and sk.active and v.effective_from<=d and (v.effective_until is null or v.effective_until>d) order by v.effective_from desc limit 1;
 if c is null then raise exception 'COST_NOT_FOUND'; end if; return c;
end $$;
create function private.stock_cost(w uuid,k uuid,l uuid,q integer) returns numeric language plpgsql set search_path = '' as $$
declare n numeric; v numeric;
begin select coalesce(sum(qty_delta),0),coalesce(sum(qty_delta*unit_cost),0) into n,v from public.inventory_movements where workspace_id=w and sku_id=k and location_id=l;
 if n<q then raise exception 'INSUFFICIENT_STOCK'; end if; return case when n=0 then 0 else round(v/n,6) end;
end $$;
create function private.deduct_deposit(w uuid,s uuid,a numeric,r uuid,d date) returns void language plpgsql set search_path = '' as $$
begin
 if a=0 then return; end if;
 if (select coalesce(sum(amount),0) from public.supplier_deposit_entries where workspace_id=w and supplier_id=s and status in ('POSTED','REVERSED'))<a then raise exception 'INSUFFICIENT_DEPOSIT'; end if;
 insert into public.supplier_deposit_entries(workspace_id,supplier_id,transaction_date,entry_type,amount,reference_type,reference_id) values(w,s,d,'PURCHASE',-a,'procurement',r);
end $$;
create function public.save_sales_order(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare o uuid; i jsonb; a jsonb; item_id uuid; c text; discount numeric; n numeric; s numeric; old_order public.sales_orders;
begin
 c=payload->>'channel'; perform private.require_permission(w,private.sales_module(c),case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 if record_id is not null then
 select * into old_order from public.sales_orders where id=record_id and workspace_id=w for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.require_permission(w,private.sales_module(old_order.channel),'edit');
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
create function public.save_procurement_order(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare o uuid; i jsonb;
begin perform private.require_permission(w,'deposits','create');
 insert into public.procurement_orders(workspace_id,supplier_id,order_number,order_date,external_order_number,tracking_number,notes) values(w,(payload->>'supplier_id')::uuid,'PO-'||upper(substr(gen_random_uuid()::text,1,8)),(payload->>'order_date')::date,nullif(payload->>'external_order_number',''),payload->>'tracking_number',payload->>'notes') returning id into o;
 if jsonb_array_length(payload->'items')<1 then raise exception 'EMPTY_ORDER'; end if;
 for i in select value from jsonb_array_elements(payload->'items') loop
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,destination_type,inventory_location_id) values(w,o,(i->>'sku_id')::uuid,(i->>'qty')::integer,i->>'destination_type',nullif(i->>'inventory_location_id','')::uuid);
 end loop; return o;
end $$;
create function public.post_procurement_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
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
end $$;
create function public.receive_procurement_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.procurement_orders; i public.procurement_items;
begin perform private.require_permission(w,'inventory','post'); perform private.lock_workspace(w);
 select * into o from public.procurement_orders where id=record_id and workspace_id=w for update; if not found then raise exception 'NOT_FOUND'; end if;
 if o.status not in ('POSTED','SHIPPED') then raise exception 'INVALID_STATUS'; end if;
 for i in select * from public.procurement_items where procurement_order_id=o.id and destination_type='WAREHOUSE' loop
 insert into public.inventory_movements(workspace_id,sku_id,location_id,transaction_date,qty_delta,movement_type,unit_cost,source_type,source_id) values(w,i.sku_id,i.inventory_location_id,current_date,i.qty,'RESTOCK_RECEIVED',i.unit_cost_snapshot,'procurement',o.id);
 end loop;
 update public.procurement_orders set status='RECEIVED',received_at=now() where id=o.id;
end $$;
create function public.post_sales_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
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
create function public.post_supplier_deposit_topup(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid; a numeric; t text; s uuid;
begin perform private.require_permission(w,'deposits','post'); perform private.lock_workspace(w);
 t=payload->>'entry_type'; a=(payload->>'amount')::numeric; s=(payload->>'supplier_id')::uuid;
 if t not in ('OPENING','TOPUP','REFUND','ADJUSTMENT_IN','ADJUSTMENT_OUT') or a<=0 then raise exception 'INVALID_AMOUNT'; end if;
 if t='ADJUSTMENT_OUT' then a=-a; end if;
 if coalesce((select sum(amount) from public.supplier_deposit_entries where supplier_id=s and workspace_id=w and status in ('POSTED','REVERSED')),0)+a<0 then raise exception 'INSUFFICIENT_DEPOSIT'; end if;
 insert into public.supplier_deposit_entries(workspace_id,supplier_id,transaction_date,entry_type,amount,notes) values(w,s,(payload->>'transaction_date')::date,t,a,payload->>'notes') returning id into r; return r;
end $$;
create function public.post_stock_adjustment(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid; q integer; c numeric; k uuid; l uuid; t text;
begin perform private.require_permission(w,'inventory','post'); perform private.lock_workspace(w);
 q=(payload->>'qty_delta')::integer; k=(payload->>'sku_id')::uuid; l=(payload->>'location_id')::uuid; t=payload->>'movement_type';
 if t not in ('OPENING_BALANCE','ADJUSTMENT_IN','CUSTOMER_RETURN','DAMAGE','ADJUSTMENT_OUT') or q=0 or (t in ('DAMAGE','ADJUSTMENT_OUT') and q>0) or (t in ('OPENING_BALANCE','ADJUSTMENT_IN','CUSTOMER_RETURN') and q<0) then raise exception 'INVALID_AMOUNT'; end if;
 c=case when q<0 then private.stock_cost(w,k,l,-q) else (payload->>'unit_cost')::numeric end;
 insert into public.inventory_movements(workspace_id,sku_id,location_id,transaction_date,qty_delta,movement_type,unit_cost,source_type,notes) values(w,k,l,(payload->>'transaction_date')::date,q,t,c,'adjustment',payload->>'notes') returning id into r; return r;
end $$;
create function private.reverse_deposit(w uuid,r uuid) returns void language plpgsql set search_path = '' as $$
declare e public.supplier_deposit_entries;
begin select * into e from public.supplier_deposit_entries where id=r and workspace_id=w;
 if not found or e.status<>'POSTED' or e.entry_type='REVERSAL' then raise exception 'INVALID_STATUS'; end if;
 if (select coalesce(sum(amount),0) from public.supplier_deposit_entries where workspace_id=w and supplier_id=e.supplier_id and status in ('POSTED','REVERSED'))-e.amount<0 then raise exception 'INSUFFICIENT_DEPOSIT'; end if;
 insert into public.supplier_deposit_entries(workspace_id,supplier_id,transaction_date,entry_type,amount,reference_type,reference_id,reversed_entry_id,notes) values(w,e.supplier_id,current_date,'REVERSAL',-e.amount,e.reference_type,e.reference_id,e.id,'Pembalikan transaksi');
 update public.supplier_deposit_entries set status='REVERSED' where id=e.id;
end $$;
create function public.reverse_supplier_deposit_entry(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin perform private.require_permission(w,'deposits','post'); perform private.lock_workspace(w);
 if exists(select 1 from public.supplier_deposit_entries where id=record_id and workspace_id=w and reference_id is not null) then raise exception 'REVERSE_SOURCE_REQUIRED'; end if;
 perform private.reverse_deposit(w,record_id);
end $$;
create function public.reverse_sales_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.sales_orders; e record; p record;
begin perform private.lock_workspace(w); select * into o from public.sales_orders where id=record_id and workspace_id=w;
 if not found then raise exception 'NOT_FOUND'; end if; perform private.require_permission(w,private.sales_module(o.channel),'post');
 if o.status<>'POSTED' then raise exception 'INVALID_STATUS'; end if;
 if exists(select 1 from public.invoices where sales_order_id=o.id and status<>'VOID') then raise exception 'VOID_INVOICE_FIRST'; end if;
 for e in select * from public.inventory_movements where source_type='sales' and source_id=o.id and reversal_of is null loop
 insert into public.inventory_movements(workspace_id,sku_id,location_id,qty_delta,movement_type,unit_cost,source_type,source_id,reversal_of) values(w,e.sku_id,e.location_id,-e.qty_delta,'REVERSAL',e.unit_cost,'sales',o.id,e.id);
 end loop;
 -- Reverse only procurement created by this sale. Pre-existing reconciled purchases stay posted.
 for p in select distinct h.id from public.procurement_orders h join public.procurement_items i on i.procurement_order_id=h.id where i.destination_reference_id=o.id and h.workspace_id=w loop
 for e in select id from public.supplier_deposit_entries where workspace_id=w and reference_type='procurement' and reference_id=p.id and status='POSTED' and entry_type='PURCHASE' loop perform private.reverse_deposit(w,e.id); end loop;
 update public.procurement_orders set status='REVERSED' where id=p.id;
 end loop;
 update public.fulfillment_allocations set active=false where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=o.id);
 update public.reconciliation_links set active=false where sales_order_item_id in(select id from public.sales_order_items where sales_order_id=o.id);
 update public.sales_orders set status='REVERSED' where id=o.id;
end $$;
create function public.reverse_procurement_order(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare o public.procurement_orders; e record;
begin perform private.require_permission(w,'deposits','post'); perform private.lock_workspace(w); select * into o from public.procurement_orders where id=record_id and workspace_id=w;
 if not found or o.status not in ('POSTED','SHIPPED','RECEIVED') then raise exception 'INVALID_STATUS'; end if;
 if exists(select 1 from public.fulfillment_allocations a join public.procurement_items i on i.id=a.procurement_item_id where i.procurement_order_id=o.id) then raise exception 'REVERSE_SOURCE_REQUIRED'; end if;
 for e in select * from public.inventory_movements where source_type='procurement' and source_id=o.id and reversal_of is null loop
 perform private.require_permission(w,'inventory','post'); perform private.stock_cost(w,e.sku_id,e.location_id,e.qty_delta);
 -- Preserve inventory valuation: reversing an old receipt after later consumption is unsafe.
 if exists(select 1 from public.inventory_movements m where m.workspace_id=w and m.sku_id=e.sku_id and m.location_id=e.location_id and m.posted_at>e.posted_at) then raise exception 'LATER_STOCK_MOVEMENT'; end if;
 insert into public.inventory_movements(workspace_id,sku_id,location_id,qty_delta,movement_type,unit_cost,source_type,source_id,reversal_of) values(w,e.sku_id,e.location_id,-e.qty_delta,'REVERSAL',e.unit_cost,'procurement',o.id,e.id);
 end loop;
 for e in select id from public.supplier_deposit_entries where workspace_id=w and reference_type='procurement' and reference_id=o.id and status='POSTED' and entry_type='PURCHASE' loop perform private.reverse_deposit(w,e.id); end loop;
 update public.procurement_orders set status='REVERSED' where id=o.id;
end $$;
