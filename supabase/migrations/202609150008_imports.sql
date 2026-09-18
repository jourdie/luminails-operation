create function public.save_import_preview(w uuid,payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare b uuid; r jsonb; n integer=0;
begin perform private.require_permission(w,'shopee','create');
 insert into public.import_batches(workspace_id,filename,storage_path,column_mapping) values(w,payload->>'filename',payload->>'storage_path',coalesce(payload->'column_mapping','{}')) returning id into b;
 for r in select value from jsonb_array_elements(payload->'rows') loop n=n+1;
 insert into public.import_rows(workspace_id,batch_id,row_number,raw_data,external_order_id,external_item_id,sku_id,status,errors) values(w,b,n,r,r->>'external_order_id',r->>'external_item_id',nullif(r->>'sku_id','')::uuid,coalesce(r->>'status','NEW'),coalesce(r->'errors','[]'));
 end loop; return b;
end $$;
-- Import creates drafts only; stock/deposit change only via post_sales_order.
create function public.commit_import(w uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare b uuid; o jsonb; r uuid; added integer=0; duplicates integer=0;
begin perform private.require_permission(w,'shopee','create'); perform private.lock_workspace(w);
 b=(payload->>'batch_id')::uuid;
 if not exists(select 1 from public.import_batches where id=b and workspace_id=w and status<>'COMMITTED') then raise exception 'INVALID_STATUS'; end if;
 for o in select value from jsonb_array_elements(payload->'orders') loop
 if o->>'channel'<>'SHOPEE' or nullif(o->>'external_order_number','') is null or exists(select 1 from jsonb_array_elements(o->'items') i where nullif(i->>'external_item_id','') is null) then raise exception 'IMPORT_ID_REQUIRED'; end if;
 if exists(select 1 from public.sales_orders where workspace_id=w and channel='SHOPEE' and external_order_number=o->>'external_order_number') then
 duplicates=duplicates+1; update public.import_rows set status='DUPLICATE' where batch_id=b and external_order_id=o->>'external_order_number';
 else
 r=public.save_sales_order(w,o); added=added+1;
 update public.import_rows set status='IMPORTED',sales_order_id=r where batch_id=b and external_order_id=o->>'external_order_number';
 end if;
 end loop;
 update public.import_batches set status='COMMITTED' where id=b;
 return jsonb_build_object('created',added,'duplicates',duplicates);
end $$;
