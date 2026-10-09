create table if not exists public.reconciliation_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reconciliation_date date not null,
  sku_id uuid references public.skus(id) on delete restrict,
  external_order_id text,
  uploaded_qty numeric(18,3) not null default 0,
  manual_qty numeric(18,3) not null default 0,
  expected_movement_qty numeric(18,3) not null default 0,
  posted_movement_qty numeric(18,3) not null default 0,
  fulfillment_source text,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  status text not null check (status in ('MATCHED', 'POTENTIAL_MATCH', 'CONFLICT', 'MISSING_FROM_UPLOAD', 'MISSING_FROM_MANUAL', 'UNPOSTED', 'RESOLVED')),
  resolution_reason text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);
