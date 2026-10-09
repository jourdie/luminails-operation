create or replace view public.v_inventory_balance as
select
  im.workspace_id,
  im.sku_id,
  im.location_id,
  sum(im.qty_delta) as actual_stock,
  sum(im.qty_delta * im.unit_cost_snapshot) as ledger_value
from public.inventory_movements im
group by im.workspace_id, im.sku_id, im.location_id;

create or replace view public.v_inventory_value as
select workspace_id, sum(ledger_value) as inventory_value
from public.v_inventory_balance
group by workspace_id;

create or replace view public.v_supplier_deposit_balance as
select workspace_id, supplier_id, sum(amount_delta) as balance
from public.supplier_deposit_movements
group by workspace_id, supplier_id;

create or replace view public.v_supplier_usage_daily as
select workspace_id, supplier_id, transaction_date, sum(abs(amount_delta)) as usage_amount
from public.supplier_deposit_movements
where amount_delta < 0
group by workspace_id, supplier_id, transaction_date;

create or replace view public.v_customer_receivables as
select
  i.workspace_id,
  i.id as invoice_id,
  i.customer_id,
  i.invoice_number,
  i.total,
  coalesce(sum(p.amount), 0) as paid,
  i.total - coalesce(sum(p.amount), 0) as outstanding
from public.b2b_invoices i
left join public.payments p on p.invoice_id = i.id
group by i.workspace_id, i.id, i.customer_id, i.invoice_number, i.total;

create or replace view public.v_sales_profit as
select
  o.workspace_id,
  o.order_date,
  o.channel,
  sum(i.selling_price * i.qty) as net_sales,
  sum(i.unit_cost_snapshot * i.qty) as cogs,
  sum((i.selling_price - i.unit_cost_snapshot) * i.qty) as gross_profit
from public.sales_orders o
join public.sales_order_items i on i.sales_order_id = o.id
where o.internal_status not in ('CANCELLED', 'RETURNED', 'REFUNDED')
group by o.workspace_id, o.order_date, o.channel;

create or replace view public.v_low_stock as
select
  s.workspace_id,
  s.id as sku_id,
  s.seller_sku,
  s.product_name,
  s.minimum_stock,
  coalesce(sum(im.qty_delta), 0) as actual_stock
from public.skus s
left join public.inventory_movements im on im.sku_id = s.id
group by s.workspace_id, s.id, s.seller_sku, s.product_name, s.minimum_stock
having coalesce(sum(im.qty_delta), 0) <= s.minimum_stock;

create or replace view public.v_supplier_runway as
select
  b.workspace_id,
  b.supplier_id,
  b.balance,
  coalesce(avg(abs(u.usage_amount)), 0) as average_daily_usage,
  case when coalesce(avg(abs(u.usage_amount)), 0) > 0 then b.balance / avg(abs(u.usage_amount)) else null end as estimated_days
from public.v_supplier_deposit_balance b
left join public.v_supplier_usage_daily u on u.workspace_id = b.workspace_id and u.supplier_id = b.supplier_id
group by b.workspace_id, b.supplier_id, b.balance;

create or replace view public.v_business_position as
select
  w.id as workspace_id,
  coalesce((select sum(amount_delta) from public.supplier_deposit_movements d where d.workspace_id = w.id), 0)
    + coalesce((select inventory_value from public.v_inventory_value iv where iv.workspace_id = w.id), 0) as calculated_assets,
  coalesce((select sum(amount_delta) from public.liability_transactions lt where lt.workspace_id = w.id), 0) as calculated_liabilities
from public.workspaces w;
