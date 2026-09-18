-- Workspace membership is an allowlist. No auth trigger creates memberships.
create table public.workspaces (id uuid primary key default gen_random_uuid(), name text not null, invoice_settings jsonb not null default '{}', created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id), display_name text, created_at timestamptz not null default now());
create table public.workspace_members (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 user_id uuid references auth.users(id), email text not null check(email = lower(email)), role text not null default 'MEMBER' check(role in ('OWNER','MEMBER')), active boolean not null default true,
 unique(workspace_id,email), unique(workspace_id,user_id), unique(workspace_id,id)
);
create table public.member_permissions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), member_id uuid not null,
 module text not null check(module in ('dashboard','products','suppliers','deposits','inventory','shopee','reconciliation','reseller','b2b','finance','reports','settings')),
 can_view boolean not null default false, can_create boolean not null default false, can_edit boolean not null default false, can_post boolean not null default false, can_export boolean not null default false,
 unique(member_id,module), foreign key(workspace_id,member_id) references public.workspace_members(workspace_id,id)
);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), user_id uuid, action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create schema if not exists private;
create function public.has_permission(w uuid, m text, a text default 'view') returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.workspace_members wm where wm.workspace_id=w and wm.user_id=auth.uid() and wm.active and
 (wm.role='OWNER' or exists(select 1 from public.member_permissions p where p.member_id=wm.id and p.module=m and p.can_view and case a when 'view' then p.can_view when 'create' then p.can_create when 'edit' then p.can_edit when 'post' then p.can_post when 'export' then p.can_export else false end)))
$$;
create function private.require_permission(w uuid,m text,a text) returns void language plpgsql security definer set search_path = '' as $$
begin if not public.has_permission(w,m,a) then raise exception 'ACCESS_DENIED' using errcode='42501'; end if; end $$;
-- Serialize posting per workspace. Transaction-level lock also covers ledger reads.
create function private.lock_workspace(w uuid) returns void language plpgsql set search_path = '' as $$
begin perform 1 from public.workspaces where id=w for update; if not found then raise exception 'NOT_FOUND'; end if; end $$;
create function public.claim_memberships() returns void language plpgsql security definer set search_path = '' as $$
declare e text;
begin
 select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if e is null then raise exception 'ACCESS_DENIED'; end if;
 update public.workspace_members set user_id=auth.uid() where email=e and user_id is null and active;
 insert into public.profiles(id,display_name) values(auth.uid(),e) on conflict(id) do nothing;
end $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; w uuid;
begin
 r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 w=(r->>'workspace_id')::uuid;
 if w is not null then insert into public.audit_logs(workspace_id,user_id,action,entity_type,entity_id,before_data,after_data) values(w,auth.uid(),TG_OP,TG_TABLE_NAME,(r->>'id')::uuid,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end); end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
