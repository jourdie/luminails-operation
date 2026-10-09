create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  transaction_date date not null,
  qty_delta numeric(18,3) not null check (qty_delta <> 0),
  movement_type text not null check (movement_type in ('OPENING_BALANCE', 'RESTOCK_RECEIVED', 'SHOPEE_SALE', 'MANUAL_SALE', 'B2B_SALE', 'RESELLER_SALE', 'CUSTOMER_RETURN', 'DAMAGE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL')),
  unit_cost_snapshot numeric(18,2) not null check (unit_cost_snapshot >= 0),
  source_type text not null,
  source_id uuid,
  movement_purpose text not null default 'PHYSICAL_STOCK',
  created_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  reversal_of uuid references public.inventory_movements(id) on delete restrict,
  unique (workspace_id, source_type, source_id, sku_id, movement_purpose)
);
