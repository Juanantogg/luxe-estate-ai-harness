-- 0028_properties_slug.sql
-- URLs amigables para properties: agrega columna `slug`, funcion
-- `generate_property_slug`, trigger BEFORE INSERT idempotente, backfill
-- deterministico e indice unico TOTAL. El slug es inmutable post-INSERT:
-- el trigger nunca se dispara en UPDATE.
--
-- Aplicada en remoto via MCP 2026-05-27. Verificada post-aplicacion:
-- 49 properties, 0 NULL, 49 slugs unicos, min_len=24 max_len=43.
-- get_advisors: 0 WARN nuevos introducidos por esta migracion.

-- (1) Extension unaccent para normalizar acentos (aeiouun, c, etc.).
create extension if not exists unaccent;

-- (2) Columna slug (nullable temporalmente para permitir el backfill).
alter table public.properties
  add column if not exists slug text;

-- (3) Funcion generadora. Pura, IMMUTABLE, SECURITY INVOKER.
create or replace function public.generate_property_slug(
  p_title text,
  p_city text,
  p_id uuid
)
returns text
language plpgsql
immutable
security invoker
set search_path = public, extensions
as $$
declare
  v_combined text;
  v_normalized text;
  v_truncated text;
  v_cut_position int;
  v_suffix text;
begin
  v_combined := coalesce(p_title, '') || ' ' || coalesce(p_city, '');
  v_normalized := lower(unaccent(v_combined));
  v_normalized := regexp_replace(v_normalized, '[^a-z0-9]+', '-', 'g');
  v_normalized := trim(both '-' from v_normalized);

  if v_normalized = '' then
    v_normalized := 'property';
  end if;

  if length(v_normalized) <= 80 then
    v_truncated := v_normalized;
  else
    v_cut_position := position('-' in reverse(substring(v_normalized from 1 for 80)));
    if v_cut_position > 0 then
      v_truncated := substring(v_normalized from 1 for (80 - v_cut_position));
    else
      v_truncated := substring(v_normalized from 1 for 80);
    end if;
    v_truncated := trim(both '-' from v_truncated);
    if v_truncated = '' then
      v_truncated := 'property';
    end if;
  end if;

  v_suffix := substring(replace(p_id::text, '-', '') from 1 for 4);

  return v_truncated || '-' || v_suffix;
end;
$$;

-- (4) Trigger BEFORE INSERT, idempotente: solo setea slug si vino NULL.
create or replace function public.properties_set_slug_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.slug is null then
    new.slug := public.generate_property_slug(new.title, new.city, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists properties_set_slug on public.properties;
create trigger properties_set_slug
  before insert on public.properties
  for each row execute function public.properties_set_slug_on_insert();

-- (5) Backfill determinístico.
update public.properties
  set slug = public.generate_property_slug(title, city, id)
  where slug is null;

-- (6) NOT NULL + indice unico TOTAL.
alter table public.properties
  alter column slug set not null;

create unique index if not exists properties_slug_key
  on public.properties(slug);
