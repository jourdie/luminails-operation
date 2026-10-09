create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  seller_sku text,
  parent_sku text,
  product_name text not null,
  variation_name text,
  shopee_price numeric(18,2) not null default 0 check (shopee_price >= 0),
  shopee_stock_reference numeric(18,3),
  hpp numeric(18,2) not null default 0 check (hpp >= 0),
  minimum_stock numeric(18,3) not null default 0 check (minimum_stock >= 0),
  safety_stock_days numeric(10,2) not null default 0 check (safety_stock_days >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_skus (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete cascade,
  channel text not null check (channel in ('SHOPEE', 'COMMERCE')),
  external_product_id text,
  external_variation_id text,
  external_seller_sku text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel, external_product_id, external_variation_id)
);
