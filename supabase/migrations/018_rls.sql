alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.member_permissions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists workspace_read_member on public.workspaces;
create policy workspace_read_member on public.workspaces
  for select using (public.is_active_workspace_member(id));

drop policy if exists profile_read_self_or_member on public.profiles;
create policy profile_read_self_or_member on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members viewer
      join public.workspace_members subject on subject.workspace_id = viewer.workspace_id
      where viewer.user_id = auth.uid()
        and viewer.is_active = true
        and viewer.role = 'OWNER'
        and subject.user_id = profiles.id
        and subject.is_active = true
    )
  );

drop policy if exists workspace_members_read_member on public.workspace_members;
create policy workspace_members_read_member on public.workspace_members
  for select using (
    public.is_active_workspace_member(workspace_id)
    and (
      user_id = auth.uid()
      or public.has_workspace_permission(workspace_id, 'settings', 'view')
    )
  );

drop policy if exists workspace_members_manage_owner on public.workspace_members;
create policy workspace_members_manage_owner on public.workspace_members
  for all using (
    public.has_workspace_permission(workspace_id, 'settings', 'edit')
  ) with check (
    public.has_workspace_permission(workspace_id, 'settings', 'edit')
  );

drop policy if exists member_permissions_read_member on public.member_permissions;
create policy member_permissions_read_member on public.member_permissions
  for select using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.id = member_permissions.workspace_member_id
        and public.is_active_workspace_member(wm.workspace_id)
        and (
          wm.user_id = auth.uid()
          or public.has_workspace_permission(wm.workspace_id, 'settings', 'view')
        )
    )
  );

drop policy if exists member_permissions_manage_owner on public.member_permissions;
create policy member_permissions_manage_owner on public.member_permissions
  for all using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.id = member_permissions.workspace_member_id
        and public.has_workspace_permission(wm.workspace_id, 'settings', 'edit')
    )
  ) with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.id = member_permissions.workspace_member_id
        and public.has_workspace_permission(wm.workspace_id, 'settings', 'edit')
    )
  );

drop policy if exists audit_logs_read_settings on public.audit_logs;
create policy audit_logs_read_settings on public.audit_logs
  for select using (
    public.has_workspace_permission(workspace_id, 'settings', 'view')
  );

drop policy if exists audit_logs_insert_member on public.audit_logs;
create policy audit_logs_insert_member on public.audit_logs
  for insert with check (
    user_id = auth.uid()
    and public.is_active_workspace_member(workspace_id)
  );
