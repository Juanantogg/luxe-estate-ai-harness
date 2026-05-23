-- 0013_anon_select_active_properties.sql
-- Permite a clientes anónimos (rol `anon`) leer propiedades activas y sus
-- imágenes. Necesario para que /, /property/[id] y /search funcionen sin
-- login. NO abre profiles, favorites, visits ni messages a anon.

-- properties: SELECT solo de listings activos.
drop policy if exists "properties_select_active_anon" on public.properties;
create policy "properties_select_active_anon"
  on public.properties
  for select
  to anon
  using (listing_status = 'active');

-- property_images: SELECT solo de imágenes cuyo property padre esté active.
drop policy if exists "property_images_select_anon" on public.property_images;
create policy "property_images_select_anon"
  on public.property_images
  for select
  to anon
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and p.listing_status = 'active'
    )
  );
