create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, email)
);

create table if not exists public.member_permissions (
  id uuid primary key default gen_random_uuid(),
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  module text not null check (module in (
    'dashboard', 'shopee_orders', 'manual_orders', 'b2b', 'reseller',
    'inventory', 'restock', 'supplier_deposit', 'finance', 'reports', 'settings'
  )),
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_post boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_member_id, module)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id, is_active);
create index if not exists member_permissions_member_idx
  on public.member_permissions (workspace_member_id, module);
create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);

create or replace function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.is_active = true
  );
$$;

create or replace function public.has_workspace_permission(
  target_workspace_id uuid,
  target_module text,
  target_action text
)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    left join public.member_permissions mp on mp.workspace_member_id = wm.id
      and mp.module = target_module
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.is_active = true
      and (
        wm.role = 'OWNER'
        or case target_action
          when 'view' then coalesce(mp.can_view, false)
          when 'create' then coalesce(mp.can_create, false)
          when 'edit' then coalesce(mp.can_edit, false)
          when 'post' then coalesce(mp.can_post, false)
          when 'export' then coalesce(mp.can_export, false)
          else false
        end
      )
  );
$$;
