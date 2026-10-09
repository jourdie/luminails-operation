create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null check (source in ('SHOPEE_ORDER_ALL', 'SKU_SHOPEE', 'MANUAL', 'COMMERCE')),
  filename text not null,
  file_hash text not null,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  status text not null default 'UPLOADED' check (status in ('UPLOADED', 'VALIDATED', 'CONFIRMED', 'POSTED', 'FAILED')),
  unique (workspace_id, source, file_hash)
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  external_order_id text,
  external_item_id text,
  raw_row jsonb not null,
  validation_status text not null default 'PENDING',
  mapping_status text not null default 'PENDING',
  error_messages jsonb not null default '[]'::jsonb,
  unique (import_batch_id, row_number)
);

create table if not exists public.settlement_import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  filename text not null,
  file_hash text not null,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  status text not null default 'UPLOADED',
  unique (workspace_id, file_hash)
);

create table if not exists public.settlement_import_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid not null references public.settlement_import_batches(id) on delete cascade,
  row_number integer not null,
  external_order_id text,
  raw_row jsonb not null,
  allocation_method text check (allocation_method in ('EXACT', 'ALLOCATED', 'UNMATCHED')),
  fee_components jsonb not null default '{}'::jsonb,
  unique (batch_id, row_number)
);
