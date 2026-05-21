-- 0010_storage_buckets.sql
-- Buckets de Storage: property-images (público) y avatars (público).

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- =========================================
-- Políticas para property-images
-- Path convention: properties/{property_id}/{filename}
-- =========================================

drop policy if exists "property_images_storage_select" on storage.objects;
create policy "property_images_storage_select"
  on storage.objects for select to public
  using (bucket_id = 'property-images');

drop policy if exists "property_images_storage_insert" on storage.objects;
create policy "property_images_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties p
        where p.id::text = split_part(name, '/', 2)
          and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "property_images_storage_update" on storage.objects;
create policy "property_images_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties p
        where p.id::text = split_part(name, '/', 2)
          and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "property_images_storage_delete" on storage.objects;
create policy "property_images_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties p
        where p.id::text = split_part(name, '/', 2)
          and p.owner_id = auth.uid()
      )
    )
  );

-- =========================================
-- Políticas para avatars
-- Path convention: {user_id}/{filename}
-- =========================================

drop policy if exists "avatars_storage_select" on storage.objects;
create policy "avatars_storage_select"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_storage_insert" on storage.objects;
create policy "avatars_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_storage_update" on storage.objects;
create policy "avatars_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_storage_delete" on storage.objects;
create policy "avatars_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
