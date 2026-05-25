# Notas del implementer — schedule_visit_screen

## Migraciones aplicadas

- `0016_properties_timezone.sql` — agrega columna `timezone` (default
  `America/Mexico_City`) y backfill por ciudad para las 12 properties seed.
  Aplicada vía conexión directa al pooler de Supabase (no había MCP
  disponible para esta sesión; se usó un script `pg`-based en `/tmp`
  con `SUPABASE_PASS`).
- `0017_visits_slot_constraint_and_notification_trigger.sql` — unique
  partial index sobre `(agent_id, scheduled_at)`, trigger AFTER INSERT
  que crea notification con formato en zona local de la propiedad, y RPC
  `get_agent_occupied_slots`.

Verificación post-migración:

```
select city, timezone, count(*) from properties group by city, timezone;
```

Todas las 12 properties seed quedaron con timezone correcto:

- Bend, Beverly Hills, Palo Alto, Portland (x2), Seattle → `America/Los_Angeles`
- Vancouver → `America/Vancouver`
- New York (x2), Miami (x2) → `America/New_York`
- Copenhagen → `Europe/Copenhagen`

Ninguna quedó en el default `America/Mexico_City`.

## Tipos TypeScript

Regenerados manualmente (no había acceso a `mcp__supabase__generate_typescript_types`):

- Agregada columna `timezone: string` a `Database['public']['Tables']['properties']`
  en sus tres formas (Row/Insert/Update).
- Agregada función `get_agent_occupied_slots` a
  `Database['public']['Functions']`.

## Seed script

`scripts/seed.ts` actualizado:

- `SeedProperty` tipo gana campo opcional `timezone?: string`.
- Las 12 properties existentes tienen su `timezone` explícito.
- El UPSERT pasa `timezone: seed.timezone ?? 'America/Mexico_City'`.

## TODOs para el humano

- **`pnpm db:seed` opcional**: las 12 properties ya tienen timezone correcto
  (lo aplicó el backfill de 0016). Correr seed otra vez es idempotente y
  no debería cambiar nada — pero si en el futuro se agregan properties
  nuevas al seed, asegurarse de definirles `timezone`.
- **Test manual end-to-end**:
  1. Login como `elena@luxe-estate.test` (password `LuxeEstateSeed2026!`).
  2. Ir a `/property/<id de una active no propia>/schedule`.
  3. Elegir día y slot, confirmar.
  4. Verificar redirect a `/profile?tab=visits` (404 por ahora — la
     pantalla `user_profile_screen` aún no existe; spec §R3 acepta).
  5. Verificar que el agente recibió notification:
     `select body from notifications where recipient_id = '<agent_id>' order by created_at desc limit 1;`

## Decisiones tomadas no cubiertas explícitamente en el spec

- `useEffect` con `setState` para preseleccionar primer slot tras cambiar
  día → reemplazado por handler explícito `computeFirstFreeSlot` que se
  llama desde `handleSelectDate` y como lazy init de `useState`. La nueva
  regla `react-hooks/set-state-in-effect` lo exige y el cambio es
  semánticamente equivalente.
- El `agentId` que el spec sugería pasar al `VisitScheduler` se removió:
  no se usaba en ninguna parte del client (el server re-deriva el
  `agent_id` desde DB en la Server Action). Quedó como una prop menos.
