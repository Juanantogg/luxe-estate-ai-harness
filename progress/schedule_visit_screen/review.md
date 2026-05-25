APPROVED WITH NITS

# Review — feature schedule_visit_screen

Implementer entregó la feature siguiendo el spec aprobado (incluyendo el delta §16 sobre timezone). `./init.sh full` pasa verde. Cero hex en JSX. Cero exposición de `service_role`. Migraciones 0016 + 0017 con la semántica del spec. Trigger DB respeta el patrón `SECURITY DEFINER` + `search_path` fijo + sin GRANT a clientes. RPC `get_agent_occupied_slots` devuelve solo `scheduled_at` (zero PII). Server Action valida zod + ventana + hora local de la propiedad + mapea 23505 → `slot_taken`. UI con a11y completa (roving tabindex, ArrowKeys/Home/End/PageUp/PageDown, `role="grid"`, `aria-pressed`/`aria-disabled`, banner `role="alert"`, toast `role="status" aria-live="polite"`). Indicador de TZ en sidebar y encima del grid. `feature_list.json` correctamente en `in_progress` (no `done`).

## Checklist crítico

| Item                                                               | Estado | Evidencia                                                                                                                                    |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cero hex en JSX                                                    | ✅     | `grep` sobre `src/components/visits/` y `src/app/(app)/property/[id]/schedule/` → NO_HEX_LITERALS                                            |
| `"use client"` solo donde aplica                                   | ✅     | `VisitPropertySummary` y `page.tsx` son Server; `VisitScheduler/MonthCalendar/TimeSlotGrid/MessageTextarea` son Client (interactividad real) |
| `await params` en page.tsx                                         | ✅     | `src/app/(app)/property/[id]/schedule/page.tsx:27` `const { id } = await params` y `:52` `const { date } = await searchParams`               |
| Sin libs nuevas                                                    | ✅     | `git diff HEAD -- package.json pnpm-lock.yaml` vacío                                                                                         |
| Sin `service_role` cliente/Server Actions                          | ✅     | `grep service_role` en visits → 0 matches; `actions.ts:81` usa `createClient` de `@/lib/supabase/server`                                     |
| Migraciones 0001-0015 intactas                                     | ✅     | `git status` solo muestra untracked 0016/0017                                                                                                |
| Feature no marcada `done`                                          | ✅     | `feature_list.json:209` `"status": "in_progress"`                                                                                            |
| 0016 columna `timezone` + backfill 12 ciudades                     | ✅     | `supabase/migrations/0016_properties_timezone.sql:13-15,19-33` (LA/Vancouver/NY/NY-Miami/Copenhagen)                                         |
| 0017 unique partial index + trigger + RPC                          | ✅     | `0017_*.sql:26-28` (index), `:31-77` (trigger SECURITY DEFINER con JOIN a `properties.timezone`), `:85-105` (RPC + GRANT to authenticated)   |
| Trigger inserta en `notifications` con shape correcto              | ✅     | `0017_*.sql:53-69` `type='visit_confirmed'`, `recipient_id=NEW.agent_id`, `visit_id=NEW.id`                                                  |
| RPC devuelve solo `scheduled_at`                                   | ✅     | `0017_*.sql:90,96-101` `returns table (scheduled_at timestamptz)`                                                                            |
| zod: uuid + ISO offset + ventana 24h-60d + message trim().max(500) | ✅     | `actions.ts:29-47`                                                                                                                           |
| Re-fetch property (owner/listing/timezone) + checks                | ✅     | `actions.ts:92-119`                                                                                                                          |
| Check de hora en zona local de la propiedad                        | ✅     | `actions.ts:123-135` usa `getZonedHourMinute(scheduledDate, property.timezone)`, no UTC/browser                                              |
| INSERT con status `confirmed`, duration 30, agent_id derivado      | ✅     | `actions.ts:137-149`                                                                                                                         |
| Map 23505 → `slot_taken`                                           | ✅     | `actions.ts:153-162`                                                                                                                         |
| revalidatePath schedule + profile                                  | ✅     | `actions.ts:154,170-171`                                                                                                                     |
| Action NO inserta en notifications                                 | ✅     | Solo `visits.insert`; trigger DB hace lo demás                                                                                               |
| Middleware regex para `/property/[id]/schedule`                    | ✅     | `proxy.ts:61` `/^\/property\/[^/]+\/schedule\/?$/.test(pathname)`; no matchea `/property/[id]` ni `/property/[id]/edit`                      |
| Rutas previas siguen protegidas                                    | ✅     | `proxy.ts:56-60` mantiene dashboard/favorites/profile/visits/admin                                                                           |
| Layout split md:5/12 + md:7/12                                     | ✅     | `page.tsx:66,70`                                                                                                                             |
| MonthCalendar Lun-Dom + chevrons + a11y completa                   | ✅     | `MonthCalendar.tsx:31` `WEEKDAY_LABELS_ES = ['Lun',…,'Dom']`; `:93-154` keyboard; roving tabindex `:215,222`                                 |
| TimeSlotGrid: hint TZ encima del grid                              | ✅     | `TimeSlotGrid.tsx:96-98` "Horarios en zona local de la propiedad ({label})"                                                                  |
| Slots ocupados con line-through + aria-disabled                    | ✅     | `TimeSlotGrid.tsx:116,118,131-132`                                                                                                           |
| MessageTextarea contador con thresholds                            | ✅     | `MessageTextarea.tsx:29-35,53,62-68` (warning >=450, danger >=500, aria-describedby)                                                         |
| VisitPropertySummary muestra TZ label                              | ✅     | `VisitPropertySummary.tsx:28,61-64`                                                                                                          |
| CTA sticky-bottom mobile, normal md+                               | ✅     | `VisitScheduler.tsx:203-207`                                                                                                                 |
| Toast `role="status"` aria-live polite + redirect 600ms            | ✅     | `VisitScheduler.tsx:157-160,227-236`                                                                                                         |
| Banner error `role="alert"`                                        | ✅     | `VisitScheduler.tsx:195-201`                                                                                                                 |
| `generateDaySlots(date, tz)` 22 timestamps en zona propiedad       | ✅     | `slot-utils.ts:127-137` itera y usa `zonedToUtc`                                                                                             |
| `formatSlotLabel(d, tz)` con Intl + timeZone explícito             | ✅     | `slot-utils.ts:143-150`                                                                                                                      |
| `getMonthDays(monthIso, tz)` calcula en zona propiedad             | ✅     | `slot-utils.ts:160-198` + `makeMonthDay` compara via `formatIsoDate(now, tz)`                                                                |
| Browser TZ no afecta slots                                         | ✅     | Helpers reciben `timeZone` siempre; no usan `getTimezoneOffset()` del Date                                                                   |
| Middleware redirige no-auth a `/login?next=...`                    | ✅     | `proxy.ts:63-68`                                                                                                                             |
| Property no existe/no active → notFound                            | ✅     | `page.tsx:41-43`                                                                                                                             |
| Owner accediendo a /schedule → redirect a dashboard edit           | ✅     | `page.tsx:45-47`                                                                                                                             |
| Pre-fetch occupiedSlotsIso via RPC                                 | ✅     | `page.tsx:49` `getAgentOccupiedSlots(...)`                                                                                                   |
| loading.tsx skeleton split                                         | ✅     | `loading.tsx` cubre sidebar 4/3 + calendar 6×7 + slots + textarea + footer                                                                   |

## NITs (no bloqueantes)

| #   | File:Line                    | Nota                                                                                                                                                                                                                                                                      |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | `VisitScheduler.tsx:238-239` | `<input type="hidden">` con `maxDateTime.toISOString()` queda en el DOM sin `name`, no se envía al server ni se lee. Es decoración muerta; el comentario "validación visual (no UI)" no es claro. Se puede borrar.                                                        |
| N2  | `slot-utils.ts:144`          | `formatSlotLabel` usa `es-MX` con `hour12: false` → muestra "10:00" / "19:30". El mockup usa "10:00 AM" (12h). Decisión razonable (formato 24h es-MX neutro y más compacto), pero diverge del PNG. Confirmar con humano si prefiere 12h.                                  |
| N3  | `MonthCalendar.tsx:158-163`  | `useEffect` solo actualiza un `ref` sin side effect efectivo. Puede simplificarse o eliminarse — no auto-focusea cuando cambia el mes vía chevron.                                                                                                                        |
| N4  | `timezone-label.ts:41`       | Entrada `Australia: 'Australia'` (sin prefijo) parece typo: las demás keys son IANA completas. Inocua (nunca matchea) pero ruido.                                                                                                                                         |
| N5  | `slot-utils.ts:33-35`        | Constantes `HOUR_START`/`HOUR_END_INCLUSIVE`/`SLOTS_PER_DAY` declaradas a nivel módulo y también exportadas vía `VISIT_SLOT_CONSTANTS`. Mínima duplicación, ok.                                                                                                           |
| N6  | `proxy.ts:14-21`             | El header `x-pathname` y su comentario quedan del cambio anterior; no es esta feature pero se podría limpiar en un cleanup separado.                                                                                                                                      |
| N7  | `actions.ts:46`              | `z.literal('')` combinado con `.optional()` y `.transform(v => null)` funciona, pero el branch `message: input.message ?? ''` (`actions.ts:74`) hace que un `null` entrante se vuelva `''` y luego `null`. Path doblemente normalizado. Funciona; ligeramente redundante. |
| N8  | `MonthCalendar.tsx:242`      | "Hoy" se marca con `ring-1 ring-primary`; el spec sugería `ring-primary-soft`. Diferencia visual mínima, contraste OK.                                                                                                                                                    |
| N9  | `page.tsx:34-38`             | Doble-check de `user` con `redirect()` es defense-in-depth correcto, pero como el middleware ya redirige, el `redirect()` aquí solo dispara si el middleware se brinca (caso edge). Bien documentado en el comentario.                                                    |

## Notas finales

- **Cercanía al spec**: muy alta. El implementer aplicó §16 al pie (orden de migraciones 0016→0017 invertido como pide el spec; trigger con JOIN a `properties.timezone`; check de hora en TZ propiedad). El campo `agentId` se omitió del client como nota correcta en `notes.md` (el server lo deriva).
- **Arquitectura**: separación `lib/visits/{actions,queries,slot-utils,timezone-label}` clara y reutilizable; `components/visits/` con barrel `index.ts`.
- **Riesgo aceptado documentado**: tras éxito redirige a `/profile?tab=visits` que aún no existe (R3 acordado).
- **DB**: migraciones aplicadas en remoto vía conexión directa (no MCP) — verificado por implementer con query post-mig. `pnpm db:seed` es idempotente con el nuevo campo.
- **Listo para commit**.
