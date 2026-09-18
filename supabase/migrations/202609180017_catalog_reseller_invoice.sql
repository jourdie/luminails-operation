-- v1.1 catalog, reseller branch flag, and invoice presentation
alter table public.products add column if not exists product_class text not null default '';
alter table public.skus add column if not exists sku_type text not null default '', add column if not exists retail_price numeric(24,2) not null default 0;
alter table public.customers add column if not exists has_multiple_branches boolean not null default false, add column if not exists address text, add column if not exists city text, add column if not exists province text, add column if not exists postal_code text, add column if not exists recipient text;

create or replace function public.save_catalog_sku(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid; k uuid; old_cost numeric; product_name text; code_value text;
begin
 perform private.require_permission(w,'products',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 product_name=trim(coalesce(payload->>'product_name','')); code_value=trim(coalesce(payload->>'sku_code',''));
 if product_name='' or code_value='' then raise exception 'INVALID_SKU'; end if;
 select product_id into p from public.skus where workspace_id=w and id=record_id;
 if p is null then select id into p from public.products where workspace_id=w and name=product_name order by id limit 1; end if;
 if p is null then insert into public.products(workspace_id,name,product_class) values(w,product_name,coalesce(payload->>'product_class','')) returning id into p;
 else update public.products set name=product_name,product_class=coalesce(payload->>'product_class',product_class) where id=p and workspace_id=w; end if;
 if record_id is null then
   insert into public.skus(workspace_id,product_id,sku_code,variant_name,parent_sku,product_type,sku_type,retail_price,active) values(w,p,code_value,coalesce(payload->>'variant_name',''),coalesce(payload->>'parent_sku',''),coalesce(payload->>'product_type',''),coalesce(payload->>'sku_type',''),coalesce(nullif(payload->>'retail_price','')::numeric,0),coalesce(nullif(lower(payload->>'active'),'')::boolean,true)) returning id into k;
 else
   update public.skus set product_id=p,sku_code=code_value,variant_name=coalesce(payload->>'variant_name',variant_name),parent_sku=coalesce(payload->>'parent_sku',parent_sku),product_type=coalesce(payload->>'product_type',product_type),sku_type=coalesce(payload->>'sku_type',sku_type),retail_price=coalesce(nullif(payload->>'retail_price','')::numeric,retail_price),active=coalesce(nullif(lower(payload->>'active'),'')::boolean,active) where workspace_id=w and id=record_id returning id into k;
   if k is null then raise exception 'NOT_FOUND'; end if;
 end if;
 if nullif(payload->>'cost','') is not null then
   perform private.require_permission(w,'suppliers','edit');
   if nullif(payload->>'supplier_id','') is null or nullif(payload->>'effective_from','') is null then raise exception 'COST_NOT_FOUND'; end if;
   select v.cost into old_cost from public.supplier_cost_versions v join public.supplier_skus ss on ss.id=v.supplier_sku_id where ss.workspace_id=w and ss.supplier_id=(payload->>'supplier_id')::uuid and ss.sku_id=k and v.effective_from=(payload->>'effective_from')::date;
   if old_cost is distinct from (payload->>'cost')::numeric then perform public.change_supplier_cost(w,payload||jsonb_build_object('sku_id',k)); end if;
 end if;
 return k;
end $$;

create or replace function public.import_catalog_skus(w uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb; n integer:=0;
begin
 perform private.require_permission(w,'products','create'); perform private.lock_workspace(w);
 if jsonb_typeof(payload->'rows')<>'array' or jsonb_array_length(payload->'rows')=0 then raise exception 'EMPTY_ORDER'; end if;
 for x in select value from jsonb_array_elements(payload->'rows') loop
   perform public.save_catalog_sku(w,jsonb_build_object('product_class',x->>'Product Class','product_name',x->>'Product Name','sku_type',x->>'SKU Type','sku_code',x->>'SKU Code','parent_sku',x->>'SKU Induk','variant_name',x->>'Variant','retail_price',x->>'Retail Price','supplier_id',x->>'Supplier','cost',x->>'HPP','effective_from',x->>'Effective From','active',x->>'Active'),null); n=n+1;
 end loop; return n;
end $$;

create or replace function public.save_reseller_customer(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid; a uuid; multi boolean;
begin
 perform private.require_permission(w,'reseller',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 multi=coalesce((payload->>'has_multiple_branches')::boolean,false);
 if nullif(trim(payload->>'name'),'') is null then raise exception 'INVALID_CUSTOMER'; end if;
 if not multi and nullif(trim(payload->>'address'),'') is null then raise exception 'ADDRESS_REQUIRED'; end if;
 if record_id is null then
  insert into public.customers(workspace_id,customer_type,name,contact_name,phone,email,instagram,payment_terms,credit_limit,notes,active,has_multiple_branches,address,city,province,postal_code,recipient) values(w,'RESELLER',trim(payload->>'name'),payload->>'contact_name',payload->>'phone',payload->>'email',payload->>'instagram',coalesce(nullif(payload->>'payment_terms','')::integer,0),coalesce(nullif(payload->>'credit_limit','')::numeric,0),payload->>'notes',coalesce((payload->>'active')::boolean,true),multi,payload->>'address',payload->>'city',payload->>'province',payload->>'postal_code',payload->>'recipient') returning id into c;
 else
  update public.customers set name=trim(payload->>'name'),contact_name=payload->>'contact_name',phone=payload->>'phone',email=payload->>'email',instagram=payload->>'instagram',payment_terms=coalesce(nullif(payload->>'payment_terms','')::integer,0),credit_limit=coalesce(nullif(payload->>'credit_limit','')::numeric,0),notes=payload->>'notes',active=coalesce((payload->>'active')::boolean,true),has_multiple_branches=multi,address=payload->>'address',city=payload->>'city',province=payload->>'province',postal_code=payload->>'postal_code',recipient=payload->>'recipient' where workspace_id=w and id=record_id and customer_type='RESELLER' returning id into c;
  if c is null then raise exception 'NOT_FOUND'; end if;
 end if;
 if not multi then
  select id into a from public.customer_addresses where workspace_id=w and customer_id=c and is_default limit 1;
  if a is null then insert into public.customer_addresses(workspace_id,customer_id,branch_name,recipient,phone,address,city,province,postal_code,is_default) values(w,c,'Utama',payload->>'recipient',payload->>'phone',payload->>'address',payload->>'city',payload->>'province',payload->>'postal_code',true);
  else update public.customer_addresses set recipient=payload->>'recipient',phone=payload->>'phone',address=payload->>'address',city=payload->>'city',province=payload->>'province',postal_code=payload->>'postal_code',is_default=true where id=a; end if;
 end if; return c;
end $$;

create or replace function public.issue_invoice(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.sales_orders; c public.customers; address jsonb; r uuid; seq integer;
begin perform private.lock_workspace(w); select * into o from public.sales_orders where id=(payload->>'sales_order_id')::uuid and workspace_id=w;
 if not found or o.status not in ('DRAFT','POSTED') or o.customer_id is null then raise exception 'INVOICE_REQUIRES_CUSTOMER'; end if;
 perform private.require_permission(w,private.sales_module(o.channel),'post'); select * into c from public.customers where id=o.customer_id;
 if nullif(payload->>'address_id','') is not null then select to_jsonb(a) into address from public.customer_addresses a where id=(payload->>'address_id')::uuid and customer_id=c.id and workspace_id=w; if address is null then raise exception 'INVALID_ADDRESS'; end if; elsif c.has_multiple_branches=false and c.address is not null then address=jsonb_build_object('branch_name','Utama','recipient',c.recipient,'phone',c.phone,'address',c.address,'city',c.city,'province',c.province,'postal_code',c.postal_code); end if;
 select count(*)+1 into seq from public.invoices where workspace_id=w and extract(year from created_at)=extract(year from now());
 insert into public.invoices(workspace_id,sales_order_id,customer_id,invoice_number,due_date,customer_snapshot,address_snapshot,settings_snapshot,normal_subtotal,selling_subtotal,adjustment_total,total,notes) values(w,o.id,c.id,'LUM-INV-'||to_char(current_date,'YYYY')||'-'||lpad(seq::text,4,'0'),(payload->>'due_date')::date,to_jsonb(c),address,(select invoice_settings from public.workspaces where id=w),o.normal_subtotal,o.selling_subtotal,o.adjustment_total,o.grand_total,payload->>'notes') returning id into r;
 insert into public.invoice_items(workspace_id,invoice_id,sku_snapshot,description,qty,normal_unit_price,unit_price,line_total) select w,r,jsonb_build_object('product_class',coalesce(nullif(p.product_class,''),p.category),'sku_type',coalesce(nullif(s.sku_type,''),nullif(s.variant_name,'')),'name',p.name,'variant_name',s.variant_name),i.description,i.qty,i.normal_unit_price,i.selling_unit_price,i.selling_line_total from public.sales_order_items i join public.skus s on s.id=i.sku_id join public.products p on p.id=s.product_id where i.sales_order_id=o.id;
 return r;
end $$;

grant execute on function public.import_catalog_skus(uuid,jsonb),public.save_reseller_customer(uuid,jsonb,uuid) to authenticated;