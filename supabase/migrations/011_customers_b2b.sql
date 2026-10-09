create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_system text,
  external_customer_id text,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_system, external_customer_id)
);

create table if not exists public.customer_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

alter table public.sales_orders add constraint sales_orders_customer_fk foreign key (customer_id) references public.customers(id) on delete set null;

create table if not exists public.b2b_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sales_order_id uuid references public.sales_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid references public.customer_branches(id) on delete restrict,
  invoice_number text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')),
  customer_snapshot jsonb not null default '{}'::jsonb,
  total numeric(18,2) not null default 0 check (total >= 0),
  issued_at timestamptz,
  due_at date,
  unique (workspace_id, invoice_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid references public.b2b_invoices(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  payment_date date not null,
  reference text,
  created_by uuid references auth.users(id) on delete set null
);
