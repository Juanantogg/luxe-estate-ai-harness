-- 0012_storage_hardening.sql
-- Cierra el advisor "public_bucket_allows_listing": los buckets siguen
-- siendo públicos (URL pública del objeto funciona sin auth), pero
-- el listing de objetos via storage.objects requiere autenticación.

drop policy if exists "property_images_storage_select" on storage.objects;
create policy "property_images_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-images');

drop policy if exists "avatars_storage_select" on storage.objects;
create policy "avatars_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
