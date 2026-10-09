create table if not exists public.restocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  reference text not null,
  transaction_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'POSTED', 'IN_TRANSIT', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'REVERSED')),
  posted_at timestamptz,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, reference)
);

create table if not exists public.restock_items (
  id uuid primary key default gen_random_uuid(),
  restock_id uuid not null references public.restocks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete restrict,
  qty numeric(18,3) not null check (qty > 0),
  received_qty numeric(18,3) not null default 0 check (received_qty >= 0 and received_qty <= qty),
  unit_cost_snapshot numeric(18,2) not null check (unit_cost_snapshot >= 0)
);
