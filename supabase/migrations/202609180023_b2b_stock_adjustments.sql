-- B2B customer workflow and bulk stock adjustments for the SKU template.
create or replace function public.save_b2b_customer(w uuid,payload jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid; a uuid; multi boolean;
begin
 perform private.require_permission(w,'b2b',case when record_id is null then 'create' else 'edit' end); perform private.lock_workspace(w);
 multi=coalesce((payload->>'has_multiple_branches')::boolean,false);
 if nullif(trim(payload->>'name'),'') is null then raise exception 'INVALID_CUSTOMER'; end if;
 if not multi and nullif(trim(payload->>'address'),'') is null then raise exception 'ADDRESS_REQUIRED'; end if;
 if record_id is null then
  insert into public.customers(workspace_id,customer_type,name,contact_name,phone,email,instagram,payment_terms,credit_limit,notes,active,has_multiple_branches,address,city,province,postal_code,recipient) values(w,'B2B',trim(payload->>'name'),payload->>'contact_name',payload->>'phone',payload->>'email',payload->>'instagram',coalesce(nullif(payload->>'payment_terms','')::integer,0),coalesce(nullif(payload->>'credit_limit','')::numeric,0),payload->>'notes',coalesce((payload->>'active')::boolean,true),multi,payload->>'address',payload->>'city',payload->>'province',payload->>'postal_code',payload->>'recipient') returning id into c;
 else
  update public.customers set name=trim(payload->>'name'),contact_name=payload->>'contact_name',phone=payload->>'phone',email=payload->>'email',instagram=payload->>'instagram',payment_terms=coalesce(nullif(payload->>'payment_terms','')::integer,0),credit_limit=coalesce(nullif(payload->>'credit_limit','')::numeric,0),notes=payload->>'notes',active=coalesce((payload->>'active')::boolean,true),has_multiple_branches=multi,address=payload->>'address',city=payload->>'city',province=payload->>'province',postal_code=payload->>'postal_code',recipient=payload->>'recipient' where workspace_id=w and id=record_id and customer_type='B2B' returning id into c;
  if c is null then raise exception 'NOT_FOUND'; end if;
 end if;
 if not multi then
  select id into a from public.customer_addresses where workspace_id=w and customer_id=c and is_default limit 1;
  if a is null then insert into public.customer_addresses(workspace_id,customer_id,branch_name,recipient,phone,address,city,province,postal_code,is_default) values(w,c,'Utama',payload->>'recipient',payload->>'phone',payload->>'address',payload->>'city',payload->>'province',payload->>'postal_code',true);
  else update public.customer_addresses set recipient=payload->>'recipient',phone=payload->>'phone',address=payload->>'address',city=payload->>'city',province=payload->>'province',postal_code=payload->>'postal_code',is_default=true where id=a; end if;
 end if; return c;
end $$;

grant execute on function public.save_b2b_customer(uuid,jsonb,uuid) to authenticated;

create or replace function public.post_stock_adjustments(w uuid,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb; n integer:=0; k uuid; l uuid; q integer; c numeric; t text; d date; code text;
begin
 perform private.require_permission(w,'inventory','post'); perform private.lock_workspace(w);
 if jsonb_typeof(payload->'rows')<>'array' or jsonb_array_length(payload->'rows')=0 then raise exception 'EMPTY_ORDER'; end if;
 select id into l from public.inventory_locations where workspace_id=w order by name limit 1;
 if l is null then insert into public.inventory_locations(workspace_id,name) values(w,'Gudang Utama') returning id into l; end if;
 for x in select value from jsonb_array_elements(payload->'rows') loop
  code=trim(coalesce(x->>'sku_code',''));
  select id into k from public.skus where workspace_id=w and sku_code=code and active;
  if k is null then raise exception 'INVALID_SKU'; end if;
  q=coalesce(nullif(x->>'qty_delta','')::integer,0); t=upper(coalesce(nullif(x->>'movement_type',''),'ADJUSTMENT_IN'));
  if t in ('IN','MASUK') then t='ADJUSTMENT_IN'; elsif t in ('OUT','KELUAR') then t='ADJUSTMENT_OUT'; end if;
  if t not in ('OPENING_BALANCE','ADJUSTMENT_IN','CUSTOMER_RETURN','DAMAGE','ADJUSTMENT_OUT') or q=0 or (t in ('DAMAGE','ADJUSTMENT_OUT') and q>0) or (t in ('OPENING_BALANCE','ADJUSTMENT_IN','CUSTOMER_RETURN') and q<0) then raise exception 'INVALID_AMOUNT'; end if;
  d=coalesce(nullif(x->>'transaction_date','')::date,current_date);
  c=case when q<0 then private.stock_cost(w,k,l,-q) else coalesce(nullif(x->>'unit_cost','')::numeric,(select v.cost from public.supplier_cost_versions v join public.supplier_skus ss on ss.id=v.supplier_sku_id where ss.workspace_id=w and ss.sku_id=k order by v.effective_from desc limit 1),0) end;
  insert into public.inventory_movements(workspace_id,sku_id,location_id,transaction_date,qty_delta,movement_type,unit_cost,source_type,notes) values(w,k,l,d,q,t,c,'adjustment',nullif(x->>'notes',''));
  n=n+1;
 end loop;
 return n;
end $$;

grant execute on function public.post_stock_adjustments(uuid,jsonb) to authenticated;