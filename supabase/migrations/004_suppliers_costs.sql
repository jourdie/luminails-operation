create table if not exists public.supplier_skus (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  sku_id uuid not null references public.skus(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, supplier_id, sku_id)
);

create table if not exists public.supplier_cost_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_sku_id uuid not null references public.supplier_skus(id) on delete restrict,
  cost numeric(18,2) not null check (cost >= 0),
  effective_from date not null,
  effective_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
