create function public.save_master(w uuid,entity text,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare m text; allowed text[]; columns_sql text; values_sql text; updates_sql text; r uuid; k text; old_type text;
begin
 case entity
 when 'brands' then m='products'; allowed=array['name'];
 when 'products' then m='products'; allowed=array['brand_id','name','category','active'];
 when 'skus' then m='products'; allowed=array['product_id','sku_code','variant_name','barcode','unit','active','minimum_stock','safety_stock_days'];
 when 'suppliers' then m='suppliers'; allowed=array['name','code','contact_name','phone','whatsapp','lead_time_days','notes','active'];
 when 'supplier_skus' then m='suppliers'; allowed=array['supplier_id','sku_id'];
 when 'inventory_locations' then m='settings'; allowed=array['name'];
 when 'customers' then m=case payload->>'customer_type' when 'RESELLER' then 'reseller' else 'b2b' end; allowed=array['customer_type','name','contact_name','phone','email','instagram','payment_terms','credit_limit','notes','active'];
 when 'customer_addresses' then
 select customer_type into old_type from public.customers where id=(payload->>'customer_id')::uuid and workspace_id=w;
 m=case old_type when 'RESELLER' then 'reseller' else 'b2b' end; allowed=array['customer_id','branch_name','recipient','phone','address','city','province','postal_code','is_default'];
 when 'financial_accounts' then m='finance'; allowed=array['name','account_type','currency','active'];
 else raise exception 'INVALID_ENTITY'; end case;
 perform private.require_permission(w,m,case when record_id is null then 'create' else 'edit' end);
 if record_id is not null and entity='customers' then
 select customer_type into old_type from public.customers where id=record_id and workspace_id=w;
 perform private.require_permission(w,case old_type when 'RESELLER' then 'reseller' else 'b2b' end,'edit');
 end if;
 if record_id is not null and entity='customer_addresses' then
 select c.customer_type into old_type from public.customers c join public.customer_addresses a on a.customer_id=c.id where a.id=record_id and a.workspace_id=w;
 perform private.require_permission(w,case old_type when 'RESELLER' then 'reseller' else 'b2b' end,'edit');
 end if;
 for k in select jsonb_object_keys(payload) loop if not k=any(allowed) then raise exception 'INVALID_FIELD'; end if; end loop;
 select string_agg(format('%I',key),','),string_agg(format('x.%I',key),','),string_agg(format('%1$I=x.%1$I',key),',') into columns_sql,values_sql,updates_sql from jsonb_object_keys(payload) key;
 if columns_sql is null then raise exception 'EMPTY_INPUT'; end if;
 if record_id is null then
 execute format('insert into public.%I (workspace_id,%s) select $1,%s from jsonb_populate_record(null::public.%I,$2) x returning id',entity,columns_sql,values_sql,entity) into r using w,payload;
 else
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$2) x where t.workspace_id=$1 and t.id=$3 returning t.id',entity,updates_sql,entity) into r using w,payload,record_id;
 if r is null then raise exception 'NOT_FOUND'; end if;
 end if; return r;
end $$;
create function public.change_supplier_cost(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare ss uuid; r uuid;
begin perform private.require_permission(w,'suppliers','edit'); perform private.lock_workspace(w);
 insert into public.supplier_skus(workspace_id,supplier_id,sku_id) values(w,(payload->>'supplier_id')::uuid,(payload->>'sku_id')::uuid) on conflict(workspace_id,supplier_id,sku_id) do update set sku_id=excluded.sku_id returning id into ss;
 insert into public.supplier_cost_versions(workspace_id,supplier_sku_id,cost,effective_from) values(w,ss,(payload->>'cost')::numeric,(payload->>'effective_from')::date) returning id into r; return r;
end $$;
create function public.confirm_reconciliation(w uuid,payload jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare i record; p record; a uuid;
begin perform private.require_permission(w,'reconciliation','post'); perform private.lock_workspace(w);
 select s.*,o.status,o.channel into i from public.sales_order_items s join public.sales_orders o on o.id=s.sales_order_id where s.id=(payload->>'sales_order_item_id')::uuid and s.workspace_id=w;
 if not found or i.status<>'DRAFT' then raise exception 'INVALID_STATUS'; end if;
 perform private.require_permission(w,private.sales_module(i.channel),'edit');
 select x.*,o.supplier_id,o.status into p from public.procurement_items x join public.procurement_orders o on o.id=x.procurement_order_id where x.id=(payload->>'procurement_item_id')::uuid and x.workspace_id=w;
 if not found or p.status not in ('POSTED','SHIPPED','RECEIVED') or p.sku_id<>i.sku_id or p.destination_type='WAREHOUSE' then raise exception 'RECONCILIATION_CONFLICT'; end if;
 select id into a from public.fulfillment_allocations where sales_order_item_id=i.id and fulfillment_type='SUPPLIER' and supplier_id=p.supplier_id and qty=p.qty and (procurement_item_id is null or procurement_item_id=p.id) limit 1;
 if a is null then raise exception 'RECONCILIATION_CONFLICT'; end if;
 update public.fulfillment_allocations set procurement_item_id=p.id where id=a;
 insert into public.reconciliation_links(workspace_id,sales_order_item_id,procurement_item_id,status,confirmed_by,confirmed_at,notes) values(w,i.id,p.id,'MATCHED',auth.uid(),now(),payload->>'notes') on conflict(sales_order_item_id,procurement_item_id) do update set status='MATCHED',confirmed_by=auth.uid(),confirmed_at=now();
end $$;
create function public.issue_invoice(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.sales_orders; c public.customers; address jsonb; r uuid; seq integer;
begin perform private.lock_workspace(w); select * into o from public.sales_orders where id=(payload->>'sales_order_id')::uuid and workspace_id=w;
 if not found or o.status<>'POSTED' or o.customer_id is null then raise exception 'INVOICE_REQUIRES_CUSTOMER'; end if;
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
create function public.record_payment(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.invoices; paid numeric; a numeric; r uuid;
begin perform private.require_permission(w,'finance','post'); perform private.lock_workspace(w);
 select * into i from public.invoices where id=(payload->>'invoice_id')::uuid and workspace_id=w;
 if not found or i.status<>'ISSUED' then raise exception 'INVALID_STATUS'; end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=i.id and status='POSTED'; a=(payload->>'amount')::numeric;
 if a<=0 or paid+a>i.total then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
 insert into public.payments(workspace_id,customer_id,invoice_id,payment_date,amount,payment_method,financial_account_id,reference,notes) values(w,i.customer_id,i.id,(payload->>'payment_date')::date,a,payload->>'payment_method',nullif(payload->>'financial_account_id','')::uuid,payload->>'reference',payload->>'notes') returning id into r; return r;
end $$;
create function public.void_invoice(w uuid,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare i public.invoices; c text;
begin perform private.lock_workspace(w); select * into i from public.invoices where id=record_id and workspace_id=w;
 if not found or i.status<>'ISSUED' then raise exception 'INVALID_STATUS'; end if;
 select customer_type into c from public.customers where id=i.customer_id;
 perform private.require_permission(w,case c when 'RESELLER' then 'reseller' else 'b2b' end,'post');
 if exists(select 1 from public.payments where invoice_id=i.id and status='POSTED') then raise exception 'REVERSE_PAYMENT_FIRST'; end if;
 update public.invoices set status='VOID' where id=i.id;
end $$;
create function public.record_finance(w uuid,entity text,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid; c text;
begin perform private.require_permission(w,'finance','post');
 if entity='financial_balance_snapshots' then
 select currency into c from public.financial_accounts where id=(payload->>'financial_account_id')::uuid and workspace_id=w;
 if c is null or c<>payload->>'currency' or (c='IDR' and (payload->>'exchange_rate')::numeric<>1) then raise exception 'INVALID_CURRENCY'; end if;
 insert into public.financial_balance_snapshots(workspace_id,financial_account_id,snapshot_date,amount_original_currency,currency,exchange_rate,notes) values(w,(payload->>'financial_account_id')::uuid,(payload->>'snapshot_date')::date,(payload->>'amount_original_currency')::numeric,c,(payload->>'exchange_rate')::numeric,payload->>'notes') returning id into r;
 elsif entity='expenses' then
 insert into public.expenses(workspace_id,expense_date,category,amount,financial_account_id,description,reference) values(w,(payload->>'expense_date')::date,payload->>'category',(payload->>'amount')::numeric,nullif(payload->>'financial_account_id','')::uuid,payload->>'description',payload->>'reference') returning id into r;
 else raise exception 'INVALID_ENTITY'; end if; return r;
end $$;
create function public.reverse_finance(w uuid,entity text,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin perform private.require_permission(w,'finance','post'); perform private.lock_workspace(w);
 if entity not in ('payments','expenses') then raise exception 'INVALID_ENTITY'; end if;
 execute format('update public.%I set status=''REVERSED'' where workspace_id=$1 and id=$2 and status=''POSTED''',entity) using w,record_id;
 get diagnostics changed = row_count; if changed=0 then raise exception 'INVALID_STATUS'; end if;
end $$;
create function public.open_receivable(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid; c jsonb;
begin perform private.require_permission(w,'finance','post'); perform private.lock_workspace(w);
 select to_jsonb(x) into c from public.customers x where id=(payload->>'customer_id')::uuid and workspace_id=w; if c is null then raise exception 'NOT_FOUND'; end if;
 insert into public.invoices(workspace_id,customer_id,invoice_number,invoice_date,due_date,customer_snapshot,total,notes) values(w,(payload->>'customer_id')::uuid,'OPEN-'||upper(substr(gen_random_uuid()::text,1,8)),(payload->>'invoice_date')::date,(payload->>'due_date')::date,c,(payload->>'total')::numeric,'Saldo awal piutang: '||coalesce(payload->>'notes','')) returning id into r; return r;
end $$;
create function public.manage_member(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid; p jsonb;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role='OWNER' and active) then raise exception 'ACCESS_DENIED'; end if;
 perform private.lock_workspace(w);
 if exists(select 1 from public.workspace_members where workspace_id=w and email=lower(payload->>'email') and role='OWNER') then raise exception 'OWNER_PROTECTED'; end if;
 insert into public.workspace_members(workspace_id,email,role,active) values(w,lower(payload->>'email'),'MEMBER',coalesce((payload->>'active')::boolean,true)) on conflict(workspace_id,email) do update set active=excluded.active returning id into r;
 for p in select value from jsonb_array_elements(coalesce(payload->'permissions','[]')) loop
 insert into public.member_permissions(workspace_id,member_id,module,can_view,can_create,can_edit,can_post,can_export) values(w,r,p->>'module',coalesce((p->>'can_view')::boolean,false),coalesce((p->>'can_create')::boolean,false),coalesce((p->>'can_edit')::boolean,false),coalesce((p->>'can_post')::boolean,false),coalesce((p->>'can_export')::boolean,false)) on conflict(member_id,module) do update set can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,can_post=excluded.can_post,can_export=excluded.can_export;
 end loop; return r;
end $$;
create function public.save_workspace(w uuid,payload jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin perform private.require_permission(w,'settings','edit');
 update public.workspaces set name=coalesce(payload->>'name',name),invoice_settings=coalesce(payload->'invoice_settings',invoice_settings) where id=w;
 insert into public.audit_logs(workspace_id,user_id,action,entity_type,entity_id,after_data) values(w,auth.uid(),'UPDATE','workspaces',w,payload);
end $$;
create function public.cancel_draft(w uuid,entity text,record_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare c text; changed integer;
begin perform private.lock_workspace(w);
 if entity='sales_orders' then select channel into c from public.sales_orders where workspace_id=w and id=record_id; perform private.require_permission(w,private.sales_module(c),'edit');
 elsif entity='procurement_orders' then perform private.require_permission(w,'deposits','edit'); else raise exception 'INVALID_ENTITY'; end if;
 execute format('update public.%I set status=''CANCELLED'' where workspace_id=$1 and id=$2 and status=''DRAFT''',entity) using w,record_id;
 get diagnostics changed = row_count; if changed=0 then raise exception 'INVALID_STATUS'; end if;
end $$;
