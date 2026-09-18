create view public.v_inventory_balance with(security_invoker=true) as
 select workspace_id,sku_id,location_id,sum(qty_delta)::integer current_stock,
 case when sum(qty_delta)=0 then 0 else round(sum(qty_delta*unit_cost)/sum(qty_delta),6) end average_cost,
 case when sum(qty_delta)=0 then 0 else round(sum(qty_delta*unit_cost),2) end inventory_value
 from public.inventory_movements group by workspace_id,sku_id,location_id;
create view public.v_inventory_value with(security_invoker=true) as select workspace_id,sum(inventory_value) inventory_value from public.v_inventory_balance group by workspace_id;
create view public.v_supplier_deposit_balance with(security_invoker=true) as
 select s.workspace_id,s.id supplier_id,s.name,s.lead_time_days,coalesce(sum(e.amount),0) balance from public.suppliers s left join public.supplier_deposit_entries e on e.supplier_id=s.id and e.status in ('POSTED','REVERSED') group by s.workspace_id,s.id,s.name,s.lead_time_days;
create view public.v_supplier_usage_daily with(security_invoker=true) as
 select workspace_id,supplier_id,transaction_date,sum(-amount) usage from public.supplier_deposit_entries where entry_type='PURCHASE' and status='POSTED' group by workspace_id,supplier_id,transaction_date;
create view public.v_deposit_forecast with(security_invoker=true) as
 select b.*,coalesce(u.spend7,0) spend_7d,coalesce(u.spend30,0) spend_30d,round(coalesce(u.spend7,0)/7,2) daily_7d,round(coalesce(u.spend30,0)/30,2) daily_30d,
 round(b.balance/nullif(u.spend7/7,0),1) runway_7d,round(b.balance/nullif(u.spend30/30,0),1) runway_30d,
 current_date+floor(b.balance/nullif(u.spend7/7,0))::integer depletion_date,
 current_date+greatest(0,floor(b.balance/nullif(u.spend7/7,0))::integer-b.lead_time_days) suggested_deposit_date
 from public.v_supplier_deposit_balance b left join lateral(select sum(usage) filter(where transaction_date>=current_date-6) spend7,sum(usage) spend30 from public.v_supplier_usage_daily u where u.supplier_id=b.supplier_id and u.transaction_date between current_date-29 and current_date) u on true;
create view public.v_low_stock with(security_invoker=true) as
 select s.workspace_id,s.id sku_id,s.sku_code,p.name,p.category,b.name brand,coalesce(v.current_stock,0) current_stock,coalesce(v.average_cost,0) average_cost,coalesce(v.inventory_value,0) inventory_value,
 coalesce(u.usage7,0)/7 daily_7d,coalesce(u.usage30,0)/30 daily_30d,
 greatest(coalesce(s.minimum_stock,0),ceil(coalesce(u.usage7,0)/7*(coalesce(lt.days,3)+s.safety_stock_days))) reorder_point,
 case when coalesce(v.current_stock,0)<=0 then 'Out of Stock' when v.current_stock<=coalesce(u.usage7,0)/7*coalesce(lt.days,3) then 'Restock Sekarang' when v.current_stock<=greatest(coalesce(s.minimum_stock,0),ceil(coalesce(u.usage7,0)/7*(coalesce(lt.days,3)+s.safety_stock_days))) then 'Perlu Restock' else 'Aman' end stock_status
 from public.skus s join public.products p on p.id=s.product_id left join public.brands b on b.id=p.brand_id
 left join lateral(select sum(current_stock) current_stock,sum(inventory_value) inventory_value,sum(inventory_value)/nullif(sum(current_stock),0) average_cost from public.v_inventory_balance v where v.sku_id=s.id) v on true
 left join lateral(select sum(-qty_delta) filter(where transaction_date>=current_date-6) usage7,sum(-qty_delta) usage30 from public.inventory_movements m where m.sku_id=s.id and m.qty_delta<0 and m.movement_type like '%_SALE' and m.transaction_date between current_date-29 and current_date and not exists(select 1 from public.inventory_movements r where r.reversal_of=m.id)) u on true
 left join lateral(select max(sp.lead_time_days) days from public.supplier_skus ss join public.suppliers sp on sp.id=ss.supplier_id where ss.sku_id=s.id) lt on true where s.active;
create view public.v_customer_receivables with(security_invoker=true) as
 select i.workspace_id,i.id invoice_id,i.customer_id,i.invoice_number,i.invoice_date,i.due_date,i.total,coalesce(p.paid,0) paid,i.total-coalesce(p.paid,0) outstanding,
 case when i.status='VOID' then 'VOID' when coalesce(p.paid,0)>=i.total then 'PAID' when i.due_date<current_date then 'OVERDUE' when coalesce(p.paid,0)>0 then 'PARTIALLY_PAID' else i.status end payment_status
 from public.invoices i left join lateral(select sum(amount) paid from public.payments where invoice_id=i.id and status='POSTED') p on true where i.status<>'VOID';
create view public.v_sales_pnl with(security_invoker=true) as
 select o.workspace_id,o.id sales_order_id,o.order_number,o.customer_id,o.channel,o.order_date,o.normal_subtotal revenue,o.normal_subtotal-o.selling_subtotal-o.adjustment_total discounts,o.grand_total net_sales,coalesce(c.cogs,0) cogs,o.grand_total-coalesce(c.cogs,0) gross_profit,o.marketplace_fee,
 o.channel='SHOPEE' and o.marketplace_fee is null fee_data_missing
 from public.sales_orders o left join lateral(select sum(a.qty*a.unit_cost_snapshot) cogs from public.sales_order_items i join public.fulfillment_allocations a on a.sales_order_item_id=i.id where i.sales_order_id=o.id) c on true where o.status='POSTED' and public.has_permission(o.workspace_id,'finance','view');
create view public.v_customer_pnl with(security_invoker=true) as select workspace_id,customer_id,channel,sum(net_sales) revenue,sum(cogs) cogs,sum(gross_profit) gross_profit,100*sum(gross_profit)/nullif(sum(net_sales),0) gross_margin from public.v_sales_pnl group by workspace_id,customer_id,channel;
create view public.v_latest_financial_balances with(security_invoker=true) as
 select a.workspace_id,a.id financial_account_id,a.name,a.account_type,a.currency,s.snapshot_date,s.amount_original_currency,s.exchange_rate,s.amount_idr from public.financial_accounts a left join lateral(select * from public.financial_balance_snapshots s where s.financial_account_id=a.id and s.snapshot_date<=current_date order by snapshot_date desc limit 1) s on true where a.active;
create view public.v_business_position with(security_invoker=true) as
 select workspace_id,'ACCOUNT' source,name category,case when account_type='LIABILITY' then 'LIABILITY' else 'ASSET' end position_type,coalesce(amount_idr,0) amount from public.v_latest_financial_balances
 union all select workspace_id,'DEPOSIT',name,'ASSET',balance from public.v_supplier_deposit_balance where public.has_permission(workspace_id,'finance','view')
 union all select workspace_id,'INVENTORY','Persediaan','ASSET',inventory_value from public.v_inventory_value where public.has_permission(workspace_id,'finance','view')
 union all select workspace_id,'RECEIVABLE','Piutang','ASSET',sum(outstanding) from public.v_customer_receivables where public.has_permission(workspace_id,'finance','view') group by workspace_id;
create view public.v_reconciliation_candidates with(security_invoker=true) as
 select i.workspace_id,i.id sales_order_item_id,o.order_number,o.external_order_number,i.sku_id,i.qty sold_qty,p.id procurement_item_id,p.qty procurement_qty,h.supplier_id,h.order_date,h.tracking_number,
 case when p.qty=i.qty and h.external_order_number=o.external_order_number then 'POTENTIAL_MATCH' else 'CONFLICT' end match_status
 from public.sales_order_items i join public.sales_orders o on o.id=i.sales_order_id join public.procurement_items p on p.workspace_id=i.workspace_id and p.sku_id=i.sku_id join public.procurement_orders h on h.id=p.procurement_order_id
 where o.status='DRAFT' and h.status in ('POSTED','SHIPPED','RECEIVED') and p.destination_type<>'WAREHOUSE' and ((o.external_order_number is not null and o.external_order_number=h.external_order_number) or abs(o.order_date-h.order_date)<=3) and public.has_permission(i.workspace_id,'reconciliation','view');
