-- 0014_anon_select_amenities_and_owner_profile.sql
-- Continuación de 0013: la página pública /property/[id] necesita renderizar
-- amenities y el nombre/avatar del agente dueño. Abrimos esas dos lecturas
-- al rol `anon` con cuidado:
--
-- 1) property_amenities → SELECT a `anon` SOLO si la `property` padre está
--    `active`. Mismo patrón que property_images en 0013.
-- 2) profiles → SELECT a `anon` SOLO si el perfil es dueño de al menos UNA
--    `property` con `listing_status = 'active'`. Esto restringe la fuga a
--    perfiles que ya son públicos de facto por publicar listings activos.
--
-- RLS no filtra por columna, así que la responsabilidad de NO exponer
-- email/phone a anon vive en el código cliente: `getOwnerPublicProfile` en
-- src/lib/properties/queries.ts es el único punto autorizado para leer
-- `profiles` desde contextos públicos, y selecciona explícitamente solo
-- (id, full_name, avatar_url, role, city).

-- property_amenities: SELECT a anon cuando la property está active.
drop policy if exists "property_amenities_select_anon" on public.property_amenities;
create policy "property_amenities_select_anon"
  on public.property_amenities
  for select
  to anon
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_amenities.property_id
        and p.listing_status = 'active'
    )
  );

-- profiles: SELECT a anon limitado a perfiles que ya son dueños públicos.
drop policy if exists "profiles_select_public_owners_anon" on public.profiles;
create policy "profiles_select_public_owners_anon"
  on public.profiles
  for select
  to anon
  using (
    exists (
      select 1 from public.properties p
      where p.owner_id = profiles.id
        and p.listing_status = 'active'
    )
  );
