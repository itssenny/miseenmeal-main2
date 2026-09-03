-- Mise & Meal manual recipe entry enhancements. Run after 002_profiles.sql.

alter table public.recipes
  add column if not exists total_minutes integer
  check (total_minutes is null or total_minutes >= 0);

-- Preserve existing timing while allowing future recipes to store an explicit
-- total that is independent from the optional prep/cook breakdown.
update public.recipes
set total_minutes = coalesce(prep_minutes, 0) + coalesce(cook_minutes, 0)
where total_minutes is null
  and (prep_minutes is not null or cook_minutes is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-covers', 'recipe-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Recipe covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'recipe-covers');
create policy "Users can upload their own recipe covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can replace their own recipe covers"
  on storage.objects for update to authenticated
  using (bucket_id = 'recipe-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recipe-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can delete their own recipe covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
