create table if not exists public.supplier_deposit_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  transaction_date date not null,
  amount_delta numeric(18,2) not null check (amount_delta <> 0),
  movement_type text not null check (movement_type in ('OPENING_BALANCE', 'TOP_UP', 'DROPSHIP_USAGE', 'RESTOCK_POSTED', 'ADJUSTMENT', 'REVERSAL')),
  source_type text not null,
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  reversal_of uuid references public.supplier_deposit_movements(id) on delete restrict,
  unique (workspace_id, source_type, source_id, supplier_id)
);
