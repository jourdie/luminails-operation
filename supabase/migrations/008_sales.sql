create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('SHOPEE', 'MANUAL', 'RESELLER', 'B2B', 'COMMERCE')),
  external_order_id text,
  customer_id uuid,
  order_date date not null,
  raw_status text,
  internal_status text not null check (internal_status in ('PENDING_PAYMENT', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED', 'REFUNDED')),
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel, external_order_id)
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete restrict,
  external_item_id text,
  qty numeric(18,3) not null check (qty > 0),
  normal_price numeric(18,2) not null check (normal_price >= 0),
  selling_price numeric(18,2) not null check (selling_price >= 0),
  unit_cost_snapshot numeric(18,2) not null check (unit_cost_snapshot >= 0),
  unique (sales_order_id, external_item_id)
);

create table if not exists public.sales_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  adjustment_type text not null,
  amount numeric(18,2) not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fulfillment_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sales_order_item_id uuid not null references public.sales_order_items(id) on delete cascade,
  source_type text not null check (source_type in ('INVENTORY', 'PARTY', 'BLUESKY', 'FUTURE_SUPPLIER')),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  qty numeric(18,3) not null check (qty > 0),
  unit_cost_snapshot numeric(18,2) not null check (unit_cost_snapshot >= 0),
  is_posted boolean not null default false,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);
