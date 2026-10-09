create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('BANK', 'CASH', 'MARKETPLACE_LIQUID', 'MARKETPLACE_PENDING', 'FX_ASSET', 'PREPAID_ASSET', 'CREDIT_CARD', 'LOAN', 'OTHER_ASSET', 'OTHER_LIABILITY')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  accounting_period date not null,
  description text not null,
  category text not null,
  purpose text not null check (purpose in ('BUSINESS', 'PERSONAL')),
  payment_source text not null check (payment_source in ('CASH_BANK', 'CREDIT_CARD', 'OTHER')),
  amount numeric(18,2) not null check (amount > 0),
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null check (category in ('CREDIT_CARD', 'LOAN', 'PAYABLE', 'OTHER_LIABILITY')),
  created_at timestamptz not null default now()
);

create table if not exists public.liability_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  liability_id uuid not null references public.liabilities(id) on delete restrict,
  transaction_date date not null,
  amount_delta numeric(18,2) not null check (amount_delta <> 0),
  transaction_type text not null check (transaction_type in ('OPENING_BALANCE', 'EXPENSE', 'REPAYMENT', 'ADJUSTMENT', 'REVERSAL')),
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.financial_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  snapshot_date date not null,
  amount numeric(18,2) not null,
  created_by uuid references auth.users(id) on delete set null,
  unique (financial_account_id, snapshot_date)
);
