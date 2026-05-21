-- 0005_property_amenities.sql
-- Tabla many-to-one entre properties y amenities (enum).

create table if not exists public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity public.amenity_key not null,
  primary key (property_id, amenity)
);

create index if not exists property_amenities_amenity_idx
  on public.property_amenities(amenity);

alter table public.property_amenities enable row level security;

drop policy if exists "property_amenities_select" on public.property_amenities;
create policy "property_amenities_select"
  on public.property_amenities for select to authenticated
  using (true);

drop policy if exists "property_amenities_modify_owner_or_admin" on public.property_amenities;
create policy "property_amenities_modify_owner_or_admin"
  on public.property_amenities for all to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );
