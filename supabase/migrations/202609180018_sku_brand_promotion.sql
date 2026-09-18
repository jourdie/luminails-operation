-- v1.2 SKU naming, brand-aware import, promotion rules
alter table public.products add column if not exists product_set text not null default '';

create or replace function public.save_catalog_sku(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid; k uuid; old_cost numeric; product_name text; code_value text; brand_value uuid; effective_value date;
begin
 perform private.require_permission(w,'products',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 product_name=trim(coalesce(payload->>'product_name',payload->>'product_set','')); code_value=trim(coalesce(payload->>'sku_code','')); effective_value=coalesce(nullif(payload->>'effective_from','')::date,current_date);
 brand_value=nullif(payload->>'brand_id','')::uuid;
 if product_name='' or code_value='' then raise exception 'INVALID_SKU'; end if;
 if brand_value is not null and not exists(select 1 from public.brands where id=brand_value and workspace_id=w) then raise exception 'INVALID_BRAND'; end if;
 select product_id into p from public.skus where workspace_id=w and id=record_id;
 if p is null then select id into p from public.products where workspace_id=w and name=product_name order by id limit 1; end if;
 if p is null then insert into public.products(workspace_id,name,brand_id,product_class,product_set) values(w,product_name,brand_value,coalesce(payload->>'product_class',''),coalesce(payload->>'product_set','')) returning id into p;
 else update public.products set name=product_name,brand_id=coalesce(brand_value,brand_id),product_class=coalesce(payload->>'product_class',product_class),product_set=coalesce(payload->>'product_set',product_set) where id=p and workspace_id=w; end if;
 if record_id is null then
   insert into public.skus(workspace_id,product_id,sku_code,variant_name,parent_sku,product_type,sku_type,retail_price,active) values(w,p,code_value,coalesce(payload->>'variant_name',''),coalesce(payload->>'parent_sku',''),coalesce(payload->>'product_type',''),coalesce(payload->>'sku_type',''),coalesce(nullif(payload->>'retail_price','')::numeric,0),coalesce(nullif(lower(payload->>'active'),'')::boolean,true)) returning id into k;
 else
   update public.skus set product_id=p,sku_code=code_value,variant_name=coalesce(payload->>'variant_name',variant_name),parent_sku=coalesce(payload->>'parent_sku',parent_sku),product_type=coalesce(payload->>'product_type',product_type),sku_type=coalesce(payload->>'sku_type',sku_type),retail_price=coalesce(nullif(payload->>'retail_price','')::numeric,retail_price),active=coalesce(nullif(lower(payload->>'active'),'')::boolean,active) where workspace_id=w and id=record_id returning id into k;
   if k is null then raise exception 'NOT_FOUND'; end if;
 end if;
 if nullif(payload->>'cost','') is not null then
   perform private.require_permission(w,'suppliers','edit');
   if nullif(payload->>'supplier_id','') is null then raise exception 'COST_NOT_FOUND'; end if;
   if not exists(select 1 from public.supplier_skus where workspace_id=w and supplier_id=(payload->>'supplier_id')::uuid and sku_id=k) then insert into public.supplier_skus(workspace_id,supplier_id,sku_id) values(w,(payload->>'supplier_id')::uuid,k); end if;
   select v.cost into old_cost from public.supplier_cost_versions v join public.supplier_skus ss on ss.id=v.supplier_sku_id where ss.workspace_id=w and ss.supplier_id=(payload->>'supplier_id')::uuid and ss.sku_id=k and v.effective_from=effective_value;
   if old_cost is distinct from (payload->>'cost')::numeric then perform public.change_supplier_cost(w,payload||jsonb_build_object('sku_id',k,'effective_from',effective_value::text)); end if;
 end if;
 return k;
end $$;

create or replace function public.import_catalog_skus(w uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb; n integer:=0; brand_id uuid; supplier_id uuid;
begin
 perform private.require_permission(w,'products','create'); perform private.lock_workspace(w);
 if jsonb_typeof(payload->'rows')<>'array' or jsonb_array_length(payload->'rows')=0 then raise exception 'EMPTY_ORDER'; end if;
 for x in select value from jsonb_array_elements(payload->'rows') loop
   brand_id=null;
   if nullif(trim(coalesce(x->>'Merk',x->>'Brand')),'') is not null then select id into brand_id from public.brands where workspace_id=w and lower(name)=lower(trim(coalesce(x->>'Merk',x->>'Brand'))) limit 1; if brand_id is null then raise exception 'INVALID_BRAND'; end if; end if;
   supplier_id=null;
   if nullif(trim(x->>'Supplier'),'') is not null then select id into supplier_id from public.suppliers where workspace_id=w and (id::text=trim(x->>'Supplier') or lower(name)=lower(trim(x->>'Supplier')) or lower(code)=lower(trim(x->>'Supplier'))) limit 1; if supplier_id is null then raise exception 'INVALID_SUPPLIER'; end if; end if;
   perform public.save_catalog_sku(w,jsonb_build_object('brand_id',brand_id,'product_class',coalesce(x->>'Product Type',x->>'Product Class'),'product_name',coalesce(x->>'Product',x->>'Product Set',x->>'Product Name'),'product_set',coalesce(x->>'Product',x->>'Product Set',''),'sku_type',coalesce(x->>'SKU Type',''),'sku_code',x->>'SKU Code','parent_sku',x->>'SKU Induk','variant_name',x->>'Variant','retail_price',x->>'Retail Price','supplier_id',supplier_id,'cost',x->>'HPP','active',x->>'Active','effective_from',current_date::text),null); n=n+1;
 end loop; return n;
end $$;

create table if not exists public.promotion_rules(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
 name text not null, product_class text, sku_id uuid, min_spend numeric(24,2), free_qty integer not null default 0 check(free_qty>=0),
 start_date date, end_date date, active boolean not null default true, created_at timestamptz not null default now(),
 unique(workspace_id,id), foreign key(workspace_id,sku_id) references public.skus(workspace_id,id), check(end_date is null or start_date is null or end_date>=start_date)
);
create table if not exists public.promotion_tiers(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
 promotion_rule_id uuid not null, min_qty integer not null check(min_qty>0), unit_price numeric(24,2) not null check(unit_price>=0),
 unique(workspace_id,id), unique(promotion_rule_id,min_qty), foreign key(workspace_id,promotion_rule_id) references public.promotion_rules(workspace_id,id) on delete cascade
);
alter table public.promotion_rules enable row level security;
alter table public.promotion_tiers enable row level security;
revoke all on public.promotion_rules,public.promotion_tiers from anon,authenticated;
grant select on public.promotion_rules,public.promotion_tiers to authenticated;
create policy promotion_rules_read on public.promotion_rules for select to authenticated using(public.has_permission(workspace_id,'b2b') or public.has_permission(workspace_id,'products'));
create policy promotion_tiers_read on public.promotion_tiers for select to authenticated using(public.has_permission(workspace_id,'b2b') or public.has_permission(workspace_id,'products'));
create trigger audit_promotion_rules after insert or update or delete on public.promotion_rules for each row execute function private.audit_change();
create trigger audit_promotion_tiers after insert or update or delete on public.promotion_tiers for each row execute function private.audit_change();

create or replace function public.save_promotion_rule(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; t jsonb; scope text; existing record; d1 date; d2 date;
begin
 perform private.require_permission(w,'b2b',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 if nullif(trim(payload->>'name'),'') is null then raise exception 'INVALID_PROMOTION'; end if;
 d1=nullif(payload->>'start_date','')::date; d2=nullif(payload->>'end_date','')::date;
 if d1 is not null and d2 is not null and d2<d1 then raise exception 'INVALID_PROMOTION_DATE'; end if;
 if nullif(payload->>'sku_id','') is not null and not exists(select 1 from public.skus where workspace_id=w and id=(payload->>'sku_id')::uuid) then raise exception 'INVALID_SKU'; end if;
 if record_id is null then
   insert into public.promotion_rules(workspace_id,name,product_class,sku_id,min_spend,free_qty,start_date,end_date,active) values(w,trim(payload->>'name'),nullif(trim(payload->>'product_class'),''),nullif(payload->>'sku_id','')::uuid,nullif(payload->>'min_spend','')::numeric,coalesce(nullif(payload->>'free_qty','')::integer,0),d1,d2,coalesce((payload->>'active')::boolean,true)) returning id into r;
 else
   update public.promotion_rules set name=trim(payload->>'name'),product_class=nullif(trim(payload->>'product_class'),''),sku_id=nullif(payload->>'sku_id','')::uuid,min_spend=nullif(payload->>'min_spend','')::numeric,free_qty=coalesce(nullif(payload->>'free_qty','')::integer,0),start_date=d1,end_date=d2,active=coalesce((payload->>'active')::boolean,true) where workspace_id=w and id=record_id returning id into r;
   if r is null then raise exception 'NOT_FOUND'; end if;
   delete from public.promotion_tiers where workspace_id=w and promotion_rule_id=r;
 end if;
 if coalesce(jsonb_typeof(payload->'tiers'),'null')<>'array' or jsonb_array_length(payload->'tiers')=0 then raise exception 'PROMOTION_TIERS_REQUIRED'; end if;
 for t in select value from jsonb_array_elements(payload->'tiers') loop insert into public.promotion_tiers(workspace_id,promotion_rule_id,min_qty,unit_price) values(w,r,(t->>'min_qty')::integer,(t->>'unit_price')::numeric); end loop;
 -- A rule applies to the same SKU/class for all quantities in its tier range, so any active date overlap is ambiguous.
 select case when pr.sku_id is not null then 'SKU' else coalesce(pr.product_class,'ALL') end into scope from public.promotion_rules pr where pr.id=r;
 for existing in select pr.* from public.promotion_rules pr where pr.workspace_id=w and pr.id<>r and pr.active and (pr.sku_id=(select sku_id from public.promotion_rules where id=r) or (pr.sku_id is null and (select sku_id from public.promotion_rules where id=r) is null and lower(coalesce(pr.product_class,''))=lower(coalesce((select product_class from public.promotion_rules where id=r),'')))) and daterange(coalesce(pr.start_date,'0001-01-01'::date),coalesce(pr.end_date,'9999-12-31'::date),'[]') && daterange(coalesce(d1,'0001-01-01'::date),coalesce(d2,'9999-12-31'::date),'[]') loop raise exception 'PROMOTION_OVERLAP'; end loop;
 return r;
end $$;
grant execute on function public.save_promotion_rule(uuid,jsonb,uuid) to authenticated;
