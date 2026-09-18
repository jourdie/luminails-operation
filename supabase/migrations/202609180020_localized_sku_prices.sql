-- v1.3 simplified SKU import headers
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
   perform public.save_catalog_sku(w,jsonb_build_object('brand_id',brand_id,'product_class',coalesce(x->>'Product Type',x->>'Product Class'),'product_name',coalesce(x->>'Product',x->>'Product Set',x->>'Product Name'),'product_set',coalesce(x->>'Product',x->>'Product Set',''),'sku_type',coalesce(x->>'SKU Type',''),'sku_code',x->>'SKU Code','parent_sku',x->>'SKU Induk','variant_name',x->>'Variant','retail_price',replace(replace(x->>'Retail Price','.',''),',','.'),'supplier_id',supplier_id,'cost',replace(replace(x->>'HPP','.',''),',','.'),'active',coalesce(x->>'Active','TRUE'),'effective_from',current_date::text),null); n=n+1;
 end loop; return n;
end $$;
