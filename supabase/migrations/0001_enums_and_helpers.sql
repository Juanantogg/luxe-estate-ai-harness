-- 0001_enums_and_helpers.sql
-- Enums del dominio + funciones helper para RLS y triggers.

do $$ begin
  create type public.user_role as enum ('user', 'agent', 'broker', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_type as enum (
    'house', 'apartment', 'villa', 'penthouse', 'condo', 'townhouse', 'commercial'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.listing_type as enum ('sale', 'rent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.listing_status as enum (
    'draft', 'active', 'pending', 'sold', 'rented', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visit_status as enum (
    'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'new_property', 'visit_confirmed', 'visit_reminder',
    'new_message', 'price_drop', 'favorite_update', 'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.amenity_key as enum (
    'pool', 'gym', 'wifi', 'air_conditioning', 'garden',
    'smart_home', 'parking', 'patio', 'wine_cellar',
    'ev_charging', 'central_heating'
  );
exception when duplicate_object then null; end $$;

-- Helper: rol del usuario actual.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: ¿es admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: ¿es agent, broker o admin?
create or replace function public.is_agent_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('agent', 'broker', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Trigger genérico para mantener updated_at al día.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
