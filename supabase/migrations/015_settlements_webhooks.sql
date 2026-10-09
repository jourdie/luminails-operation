create table if not exists public.settlement_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  settlement_import_row_id uuid not null references public.settlement_import_rows(id) on delete cascade,
  external_order_id text,
  product_revenue numeric(18,2) not null default 0,
  seller_discount numeric(18,2) not null default 0,
  refund numeric(18,2) not null default 0,
  platform_fee numeric(18,2) not null default 0,
  processing_fee numeric(18,2) not null default 0,
  free_shipping_fee numeric(18,2) not null default 0,
  service_fee numeric(18,2) not null default 0,
  promotion_fee numeric(18,2) not null default 0,
  shopee_tax numeric(18,2) not null default 0,
  other_shopee_fee numeric(18,2) not null default 0,
  net_released_income numeric(18,2) not null default 0,
  allocation_method text not null check (allocation_method in ('EXACT', 'ALLOCATED', 'UNMATCHED')),
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, source, external_event_id)
);

create or replace function public.claim_webhook_event(target_workspace_id uuid, target_source text, target_external_event_id text, target_payload jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare event_id uuid;
begin
  if not public.is_active_workspace_member(target_workspace_id) then raise exception 'permission_denied'; end if;
  insert into public.webhook_events (workspace_id, source, external_event_id, payload)
  values (target_workspace_id, target_source, target_external_event_id, target_payload)
  on conflict (workspace_id, source, external_event_id) do nothing
  returning id into event_id;
  return event_id;
end;
$$;
