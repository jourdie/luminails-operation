insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('imports','imports',false,10485760,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']),
 ('invoices','invoices',false,10485760,array['application/pdf']),
 ('attachments','attachments',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
-- Object names begin with workspace UUID. Private downloads require authorization.
create policy workspace_files_read on storage.objects for select to authenticated using(bucket_id in ('imports','invoices','attachments') and public.has_permission((storage.foldername(name))[1]::uuid,case bucket_id when 'imports' then 'shopee' when 'invoices' then 'b2b' else 'settings' end,'view'));
create policy workspace_files_create on storage.objects for insert to authenticated with check(bucket_id in ('imports','invoices','attachments') and public.has_permission((storage.foldername(name))[1]::uuid,case bucket_id when 'imports' then 'shopee' when 'invoices' then 'b2b' else 'settings' end,'create'));
