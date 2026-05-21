-- 0003_properties.sql
-- Tabla central de propiedades + índices + búsqueda full-text + RLS.

create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete restrict,

  title text not null,
  description text,
  price numeric(12, 2) not null check (price > 0),

  listing_type public.listing_type not null,
  listing_status public.listing_status not null default 'draft',
  property_type public.property_type not null,

  address_line text not null,
  city text not null,
  state text,
  country text,
  postal_code text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),

  bedrooms smallint not null default 0 check (bedrooms >= 0),
  bathrooms numeric(3, 1) not null default 0 check (bathrooms >= 0),
  area_sqm numeric(8, 2) check (area_sqm >= 0),
  parking_spaces smallint default 0 check (parking_spaces >= 0),
  year_built smallint check (year_built >= 1800 and year_built <= 2100),

  is_featured boolean not null default false,
  is_premium boolean not null default false,
  previous_price numeric(12, 2),

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored
);

create index if not exists properties_owner_idx on public.properties(owner_id);
create index if not exists properties_status_idx on public.properties(listing_status);
create index if not exists properties_city_idx on public.properties(city);
create index if not exists properties_price_idx on public.properties(price);
create index if not exists properties_listing_type_idx on public.properties(listing_type);
create index if not exists properties_published_at_idx on public.properties(published_at desc nulls last);
create index if not exists properties_search_idx on public.properties using gin(search_vector);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- RLS
alter table public.properties enable row level security;

drop policy if exists "properties_select_public_or_own" on public.properties;
create policy "properties_select_public_or_own"
  on public.properties for select
  to authenticated
  using (
    listing_status in ('active', 'pending', 'sold', 'rented')
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "properties_insert_agent" on public.properties;
create policy "properties_insert_agent"
  on public.properties for insert
  to authenticated
  with check (
    public.is_agent_or_above()
    and (owner_id = auth.uid() or public.is_admin())
  );

drop policy if exists "properties_update_own_or_admin" on public.properties;
create policy "properties_update_own_or_admin"
  on public.properties for update
  to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "properties_delete_own_or_admin" on public.properties;
create policy "properties_delete_own_or_admin"
  on public.properties for delete
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());
