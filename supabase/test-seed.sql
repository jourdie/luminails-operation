-- DEVELOPMENT DATA ONLY. Never run this file against a production database.
insert into public.workspaces(id,name) values('10000000-0000-0000-0000-000000000001','Luminails');
insert into public.brands(id,workspace_id,name) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','PARTY'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Bluesky');
insert into public.suppliers(id,workspace_id,name,code,lead_time_days) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','PARTY','PARTY',3),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Bluesky','BLUESKY',5);
insert into public.inventory_locations(id,workspace_id,name) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Luminails Main Stock');
do $$ declare names text[]=array['PARTY PH Bond','PARTY Base Coat','PARTY Top Coat','PARTY Gel Polish 260','Bluesky Rubber Base','Buffer','Nail File','Shinner','Emery Board']; p uuid; s uuid; ss uuid; i integer; w uuid='10000000-0000-0000-0000-000000000001'; sp uuid;
begin for i in 1..9 loop
 p=('50000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
 s=('60000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
 sp=case when i=5 then '30000000-0000-0000-0000-000000000002'::uuid else '30000000-0000-0000-0000-000000000001'::uuid end;
 insert into public.products(id,workspace_id,brand_id,name,category) values(p,w,case when i=5 then '20000000-0000-0000-0000-000000000002'::uuid else '20000000-0000-0000-0000-000000000001'::uuid end,names[i],case when i<=5 then 'Gel & Treatment' else 'Tools' end);
 insert into public.skus(id,workspace_id,product_id,sku_code,minimum_stock) values(s,w,p,'LUM-'||lpad(i::text,3,'0'),10);
 insert into public.supplier_skus(workspace_id,supplier_id,sku_id) values(w,sp,s) returning id into ss;
 insert into public.supplier_cost_versions(workspace_id,supplier_sku_id,cost,effective_from) values(w,ss,case when i<=5 then 88000 else 8000 end,'2020-01-01');
 insert into public.inventory_movements(workspace_id,sku_id,location_id,qty_delta,movement_type,unit_cost,source_type,notes) values(w,s,'40000000-0000-0000-0000-000000000001',case when i=3 then 4 when i=4 then 0+2 else 24 end,'OPENING_BALANCE',case when i<=5 then 88000 else 8000 end,'seed','DATA UJI — bukan saldo produksi');
 end loop; end $$;
insert into public.supplier_deposit_entries(workspace_id,supplier_id,transaction_date,entry_type,amount,notes) values
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date,'OPENING',20000000,'DATA UJI'),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',current_date,'OPENING',5000000,'DATA UJI');
insert into public.customers(id,workspace_id,customer_type,name,payment_terms) values('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','B2B','Lash Up Studio (uji)',14),('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','RESELLER','Reseller Uji',7);
insert into public.customer_addresses(workspace_id,customer_id,branch_name,address) select '10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',branch,'Alamat contoh untuk pengujian' from unnest(array['PIK','Gading','Serpong']) branch;
insert into public.financial_accounts(id,workspace_id,name,account_type,currency) values
 ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Bank Jago (uji)','BANK','IDR'),
 ('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Shopee Cair (uji)','MARKETPLACE_LIQUID','IDR'),
 ('80000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Shopee Mengendap (uji)','MARKETPLACE_PENDING','IDR'),
 ('80000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Mandiri Credit Card (uji)','LIABILITY','IDR');
insert into public.financial_balance_snapshots(workspace_id,financial_account_id,snapshot_date,amount_original_currency,currency,exchange_rate,notes) select workspace_id,id,current_date,case when account_type='LIABILITY' then 1500000 else 10000000 end,'IDR',1,'DATA UJI' from public.financial_accounts;
