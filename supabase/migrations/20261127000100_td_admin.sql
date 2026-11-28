begin;

create schema if not exists td_private;
revoke all on schema td_private from public, anon, authenticated;

create table if not exists td_private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table td_private.admins enable row level security;

create or replace function public.td_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from td_private.admins where user_id = auth.uid());
$$;
revoke all on function public.td_is_admin() from public, anon, authenticated;
grant execute on function public.td_is_admin() to authenticated;

create table if not exists public.td_support_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer text not null check (char_length(customer) between 1 and 80),
  phone text not null check (phone ~ '^0([35789][0-9]{8}|2[0-9]{9})$'),
  equipment text not null check (equipment in ('Thang máy', 'Biến tần', 'Điện mặt trời', 'Khác')),
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'new' check (status in ('new', 'working', 'done'))
);
alter table public.td_support_requests enable row level security;
revoke all on public.td_support_requests from public, anon, authenticated;
grant select, update (status) on public.td_support_requests to authenticated;

create policy td_admin_read_requests on public.td_support_requests
  for select to authenticated using ((select public.td_is_admin()));
create policy td_admin_update_requests on public.td_support_requests
  for update to authenticated using ((select public.td_is_admin()))
  with check ((select public.td_is_admin()));

create or replace function public.td_submit_support(
  p_customer text, p_phone text, p_equipment text, p_description text
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.td_support_requests (customer, phone, equipment, description)
  values (btrim(p_customer), btrim(p_phone), p_equipment, btrim(p_description));
  return true;
end;
$$;
revoke all on function public.td_submit_support(text, text, text, text) from public, anon, authenticated;
grant execute on function public.td_submit_support(text, text, text, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('td-product-images', 'td-product-images', true, 5242880,
    array['image/jpeg','image/png','image/webp']),
  ('td-documents', 'td-documents', false, 20971520,
    array['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy td_admin_read_storage on storage.objects
  for select to authenticated using (
    bucket_id in ('td-product-images', 'td-documents') and (select public.td_is_admin())
  );
create policy td_admin_upload_storage on storage.objects
  for insert to authenticated with check (
    (select public.td_is_admin()) and
    ((bucket_id = 'td-product-images' and name in ('drive','battery','power','board'))
      or bucket_id = 'td-documents')
  );
create policy td_admin_replace_product_image on storage.objects
  for update to authenticated using (
    bucket_id = 'td-product-images' and name in ('drive','battery','power','board')
    and (select public.td_is_admin())
  ) with check (
    bucket_id = 'td-product-images' and name in ('drive','battery','power','board')
    and (select public.td_is_admin())
  );

commit;
