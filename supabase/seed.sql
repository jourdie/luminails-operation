insert into public.workspaces (name, slug)
values ('Luminails', 'luminails')
on conflict (slug) do nothing;

insert into public.workspaces (name, slug)
values ('Luminails Development', 'luminails-development')
on conflict (slug) do nothing;
