-- 0021_properties_sold_at.sql
-- Columna autoritativa para la fecha en que una property se vendió.
-- Reemplaza el uso de `updated_at` como proxy en queries de sales YTD
-- (feature admin_user_directory, decisión C4).
--
-- - Trigger BEFORE UPDATE mantiene sold_at sincronizado con listing_status:
--     · Transición a 'sold' → sold_at := now()
--     · Transición desde 'sold' a cualquier otro → sold_at := null
--     · Cambios sin 'sold' involucrado → no toca sold_at
-- - Index parcial para acelerar filtros `where sold_at >= ...`.
-- - Backfill para registros legacy ya marcados sold: copia updated_at
--   como mejor aproximación disponible. Solo afecta filas sin sold_at.

alter table public.properties
  add column if not exists sold_at timestamptz;

create index if not exists properties_sold_at_idx
  on public.properties(sold_at)
  where sold_at is not null;

create or replace function public.properties_sync_sold_at()
returns trigger
language plpgsql
as $$
begin
  if old.listing_status is distinct from 'sold' and new.listing_status = 'sold' then
    new.sold_at := now();
  elsif old.listing_status = 'sold' and new.listing_status is distinct from 'sold' then
    new.sold_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_sync_sold_at on public.properties;
create trigger properties_sync_sold_at
  before update on public.properties
  for each row execute function public.properties_sync_sold_at();

-- Backfill defensivo: filas legacy con listing_status='sold' sin sold_at
update public.properties
   set sold_at = updated_at
 where listing_status = 'sold'
   and sold_at is null;
