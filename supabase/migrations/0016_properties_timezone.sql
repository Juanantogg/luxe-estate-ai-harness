-- 0016_properties_timezone.sql
--
-- Agrega columna `timezone` a `properties` (IANA tz string, ej.
-- 'America/Los_Angeles'). Se usa para:
--   1. Renderizar slots en la pantalla schedule_visit_screen con
--      Intl.DateTimeFormat({ timeZone: property.timezone }).
--   2. Formatear el body de la notification al agente en zona local
--      de la propiedad (en lugar de UTC).
--
-- Default 'America/Mexico_City' (paleta es-MX). Backfill de las 12
-- propiedades seed según ciudad.

alter table public.properties
  add column if not exists timezone text not null
    default 'America/Mexico_City';

-- Backfill por ciudad (idempotente: solo afecta filas con default vigente).
-- Las 12 properties del seed mapean a estos timezones:
update public.properties set timezone = 'America/Los_Angeles'
  where city in ('Beverly Hills', 'Palo Alto', 'Seattle', 'Portland', 'Bend')
    and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/Vancouver'
  where city = 'Vancouver' and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/New_York'
  where city = 'New York' and timezone = 'America/Mexico_City';

update public.properties set timezone = 'America/New_York'
  where city = 'Miami' and timezone = 'America/Mexico_City';

update public.properties set timezone = 'Europe/Copenhagen'
  where city = 'Copenhagen' and timezone = 'America/Mexico_City';

-- Cualquier property no mapeada queda en 'America/Mexico_City' (default razonable).
