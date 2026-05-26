-- 0019_storage_property_images_drafts.sql
-- Permite a usuarios autenticados subir imágenes de propiedad a un prefijo
-- temporal `_drafts/{auth.uid()}/...` antes de crear el registro `properties`
-- (feature add_edit_property_form). Tras el insert, la Server Action mueve
-- los archivos a `properties/{property_id}/...` y aplica la policy estándar
-- de ownership (que sigue intacta).
--
-- Path convention final dentro del bucket `property-images`:
--   _drafts/{auth.uid()}/{uuid}.{ext}       ← upload temporal
--   properties/{property_id}/{uuid}.{ext}   ← path definitivo
--
-- Otros prefijos quedan rechazados (defense-in-depth).

-- =========================================
-- INSERT
-- =========================================
drop policy if exists "property_images_storage_insert" on storage.objects;
create policy "property_images_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) = '_drafts'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      or (
        split_part(name, '/', 1) = 'properties'
        and exists (
          select 1 from public.properties p
          where p.id::text = split_part(name, '/', 2)
            and p.owner_id = auth.uid()
        )
      )
    )
  );

-- =========================================
-- UPDATE
-- =========================================
drop policy if exists "property_images_storage_update" on storage.objects;
create policy "property_images_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) = '_drafts'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      or (
        split_part(name, '/', 1) = 'properties'
        and exists (
          select 1 from public.properties p
          where p.id::text = split_part(name, '/', 2)
            and p.owner_id = auth.uid()
        )
      )
    )
  )
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) = '_drafts'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      or (
        split_part(name, '/', 1) = 'properties'
        and exists (
          select 1 from public.properties p
          where p.id::text = split_part(name, '/', 2)
            and p.owner_id = auth.uid()
        )
      )
    )
  );

-- =========================================
-- DELETE
-- =========================================
drop policy if exists "property_images_storage_delete" on storage.objects;
create policy "property_images_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) = '_drafts'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      or (
        split_part(name, '/', 1) = 'properties'
        and exists (
          select 1 from public.properties p
          where p.id::text = split_part(name, '/', 2)
            and p.owner_id = auth.uid()
        )
      )
    )
  );

-- SELECT permanece igual (mig 0012): cualquier authenticated puede listar
-- objetos del bucket `property-images`. Los `_drafts/` técnicamente son
-- visibles si alguien adivina el path, pero el bucket es público por diseño
-- (las imágenes finales ya lo eran) y el prefijo `_drafts/` queda como una
-- "soft" landing zone — el riesgo es bajo y se documenta en §11 R1 del spec.
