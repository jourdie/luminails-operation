-- Membership checks and ledger rules must remain valid for direct RPC callers.
create function private.validate_sales_address() returns trigger language plpgsql set search_path='' as $$
begin
 if new.address_id is not null and not exists(select 1 from public.customer_addresses where id=new.address_id and customer_id=new.customer_id and workspace_id=new.workspace_id) then raise exception 'INVALID_ADDRESS'; end if;
 return new;
end $$;
create trigger sales_address_owner before insert or update on public.sales_orders for each row execute function private.validate_sales_address();
create function public.mark_procurement_shipped(w uuid,record_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_permission(w,'deposits','post'); perform private.lock_workspace(w);
 update public.procurement_orders set status='SHIPPED',tracking_number=payload->>'tracking_number' where workspace_id=w and id=record_id and status='POSTED';
 if not found then raise exception 'INVALID_STATUS'; end if;
end $$;
create function public.update_procurement_draft(w uuid,record_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i jsonb;
begin perform private.require_permission(w,'deposits','edit'); perform private.lock_workspace(w);
 if not exists(select 1 from public.procurement_orders where id=record_id and workspace_id=w and status='DRAFT') then raise exception 'IMMUTABLE_POSTED'; end if;
 update public.procurement_orders set supplier_id=(payload->>'supplier_id')::uuid,order_date=(payload->>'order_date')::date,external_order_number=nullif(payload->>'external_order_number',''),tracking_number=payload->>'tracking_number',notes=payload->>'notes' where id=record_id;
 delete from public.procurement_items where procurement_order_id=record_id;
 if jsonb_array_length(payload->'items')<1 then raise exception 'EMPTY_ORDER'; end if;
 for i in select value from jsonb_array_elements(payload->'items') loop
 insert into public.procurement_items(workspace_id,procurement_order_id,sku_id,qty,destination_type,inventory_location_id) values(w,record_id,(i->>'sku_id')::uuid,(i->>'qty')::integer,i->>'destination_type',nullif(i->>'inventory_location_id','')::uuid);
 end loop;
end $$;
create function public.correct_financial_snapshot(w uuid,record_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare old_row public.financial_balance_snapshots; c text;
begin perform private.require_permission(w,'finance','edit'); perform private.lock_workspace(w);
 select * into old_row from public.financial_balance_snapshots where id=record_id and workspace_id=w; if not found then raise exception 'NOT_FOUND'; end if;
 select currency into c from public.financial_accounts where id=old_row.financial_account_id;
 if c='IDR' and (payload->>'exchange_rate')::numeric<>1 then raise exception 'INVALID_CURRENCY'; end if;
 update public.financial_balance_snapshots set amount_original_currency=(payload->>'amount_original_currency')::numeric,exchange_rate=(payload->>'exchange_rate')::numeric,notes=payload->>'notes' where id=record_id;
end $$;
create view public.v_sku_performance with(security_invoker=true) as
 select i.workspace_id,i.sku_id,s.sku_code,p.name,o.order_date,o.channel,sum(i.qty) units,
 sum(i.selling_line_total+case when o.selling_subtotal=0 then 0 else o.adjustment_total*i.selling_line_total/o.selling_subtotal end) net_sales,
 sum(i.qty*i.unit_cost_snapshot) cogs,
 sum(i.selling_line_total+case when o.selling_subtotal=0 then 0 else o.adjustment_total*i.selling_line_total/o.selling_subtotal end-i.qty*i.unit_cost_snapshot) gross_profit
 from public.sales_order_items i join public.sales_orders o on o.id=i.sales_order_id join public.skus s on s.id=i.sku_id join public.products p on p.id=s.product_id
 where o.status='POSTED' and public.has_permission(i.workspace_id,'finance') group by i.workspace_id,i.sku_id,s.sku_code,p.name,o.order_date,o.channel;
grant select on public.v_sku_performance to authenticated;
grant execute on function public.mark_procurement_shipped(uuid,uuid,jsonb), public.update_procurement_draft(uuid,uuid,jsonb),public.correct_financial_snapshot(uuid,uuid,jsonb) to authenticated;
revoke all on function private.validate_sales_address() from public,anon,authenticated;
