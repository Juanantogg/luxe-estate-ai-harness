# Review — feature `invitation_status_indicator`

**Veredicto:** APPROVED WITH NITS

**Fecha:** 2026-05-26
**Reviewer:** subagente reviewer (sesión leader)
**Migración aplicada por:** leader (vía MCP). Implementer entregó el archivo SQL en disco; el ledger remoto matchea byte a byte con `supabase/migrations/0023_profiles_invitation_status.sql` (reportado por el leader, confiable).
**Migración 0024 correctiva:** del leader (revoke EXECUTE de `on_auth_user_confirmed`); contenido trivial validado abajo.

## Resumen ejecutivo

Feature lista para mergear tras 0 bloqueantes y 3 NITs no bloqueantes. El implementer respetó el spec aprobado (1019 líneas) sin desviaciones materiales: migración 0023 SQL byte a byte vs §1 del spec, 5 tabs con "Invitaciones" al final, rename `?role=` → `?tab=` sin alias en URL, texto literal "Pendiente" en el botón disabled, fila pending SIN background highlight. Self-protection (`requireAcceptedTarget`) integrada en las tres actions sensibles (`changeRole`, `suspendUser`, `reactivateUser`) y deliberadamente NO en `inviteUser`. `init.sh full` verde (lint + type-check + build, 14 rutas, `/admin/users` sigue ƒ dynamic).

## Checklist

- Tokens y colores: [x] — `grep '\[#[0-9a-fA-F]' src/components/admin/ src/app/(admin)/ src/lib/admin/` → cero matches.
- Componentes y framework: [x] — todos los archivos modificados/creados son Server Components. Únicos `'use client'` en el módulo (sin cambios) son `UserDirectorySearch.tsx`, `InviteUserButton.tsx`, `InviteUserDialog.tsx`, `ChangeRoleConfirmDialog.tsx`, `ChangeRoleMenu.tsx`, `error.tsx` — los 4 últimos preexisten y necesitan interactividad real. `UserDirectorySearch` solo cambia comentarios. `page.tsx:55` `const sp = await searchParams;` correcto.
- Supabase: [x] — sin `createClient` directo nuevo (queries pasan supabase como arg desde page; `actions.ts` usa `createClient()` de `@/lib/supabase/server` y `createAdminClient()` de `@/lib/supabase/admin`). RLS activado vía mig 0023 (columna sobre tabla ya con RLS de mig 0002, sin nueva tabla). Mutaciones siempre en Server Actions.
- Fidelidad visual: [x] — el mockup `admin_user_directory_cards` NO contempla estado pending; el designer documentó (§5.1) la decisión de extender con `mail_outline` + `text-warning` + `Avatar status="away"`, tokens ya validados. Spec §13 cerrada por el humano.
- Calidad: [x] — `./init.sh full` PASA (lint 0, type-check 0, build OK, 14 rutas, `/admin/users` ƒ dynamic). Sin `console.log` de debug. Textos en español neutro.

## Acceptance ítem por ítem (feature_list.json)

1. **Migración nueva agrega enum `invitation_status_t` + columna NOT NULL DEFAULT 'accepted'** — ✅ `supabase/migrations/0023_profiles_invitation_status.sql:27-39`.
2. **Backfill: todos los profiles existentes → 'accepted'** — ✅ `0023:44-46` (UPDATE explícito por idempotencia) + verificado por leader vía MCP (11 profiles, 10 accepted, 1 pending marcado manualmente post-mig).
3. **Trigger `handle_new_user` actualizado: invited_at NOT NULL + email_confirmed_at NULL → 'pending'** — ✅ `0023:58-88` líneas 71-75.
4. **Trigger nuevo `on_auth_user_confirmed` AFTER UPDATE OF email_confirmed_at: NULL→NOT NULL flippea a 'accepted'** — ✅ `0023:97-117`.
5. **Ambos triggers SECURITY DEFINER + set search_path = public** — ✅ `0023:61-62` y `0023:100-101`.
6. **`src/types/database.ts` regenerado vía MCP** — ✅ `database.ts:226,241,256,525,684` + `database.ts:7` ("Última regeneración: ... + 0023"). Leader confirma paridad byte a byte vs lo regenerado por MCP.
7. **`UserStatusIndicator` con 3 estados (Invitado pendiente / Activo / Inactivo) con iconos y colores correctos** — ✅ `UserStatusIndicator.tsx:26-42` mapeo completo; `mail_outline + text-warning + "Invitado pendiente"`, `check_circle + text-primary + "Activo"`, `remove_circle_outline + text-muted + "Inactivo"`.
8. **`getDirectoryUsers` selecciona `invitation_status`** — ✅ `queries.ts:126` (`'id, email, full_name, avatar_url, role, is_active, invitation_status, created_at'`).
9. **Self-protection: UI muestra botón disabled "Pendiente" + server-side bloquea changeRole/suspendUser/reactivateUser con error `invalid`** — ✅ `UserDirectoryRow.tsx:108-119` botón disabled "Pendiente"; `actions.ts:99-139` helper `requireAcceptedTarget`; integrado en `changeRole:162-163`, `suspendUser:217-218`, `reactivateUser:290-291`; mensaje literal "El usuario invitado todavía no aceptó la invitación." (`actions.ts:133`). NO se invoca desde `inviteUser` (verificado en `actions.ts:356-431`).
10. **Tab nueva "Invitaciones" filtra estrictamente por pending; tabs existentes excluyen pending** — ✅ `queries.ts:132-139` branching; `UserDirectoryTabs.tsx:22-28` arr de 5 tabs con `pending` al final; `UserDirectoryTabs.tsx:30-36` `buildHref` usa `?tab=`.
11. **Badge en tab "Invitaciones" con count; sin badge si 0** — ✅ `UserDirectoryTabs.tsx:57,72-76` `showBadge = tab.value === 'pending' && pendingCount > 0`; render condicional con `<Badge variant="warning" size="sm">`. `getPendingInvitationCount` en `queries.ts:221-231` con `head: true`.

## Migraciones — verificación SQL

### `0023_profiles_invitation_status.sql`

- `diff` byte a byte vs spec §1 (líneas 53-176, excluyendo cercos ```): **idéntico**.
- Comprende (1) enum guard idempotente, (2) `add column if not exists` con default 'accepted' NOT NULL, (3) UPDATE backfill defensivo, (4) índice parcial `profiles_pending_invitation_idx` sobre `created_at desc` WHERE pending, (5) replace `handle_new_user` SECURITY DEFINER set search_path public, (6) trigger nuevo `on_auth_user_confirmed` AFTER UPDATE OF `email_confirmed_at` con guard NULL→NOT NULL y filtro `where invitation_status = 'pending'` (defensivo).
- RLS: la columna se agrega sobre `profiles`, que ya tiene RLS habilitado desde mig 0002. No requiere policies nuevas (consultable por authenticated bajo policies existentes).

### `0024_on_auth_user_confirmed_revoke_execute.sql` (leader)

```sql
revoke execute on function public.on_auth_user_confirmed() from public;
revoke execute on function public.on_auth_user_confirmed() from anon;
revoke execute on function public.on_auth_user_confirmed() from authenticated;
```

- Patrón idéntico a mig 0011 + 0017 + 0018 (revoke EXECUTE de funciones SECURITY DEFINER que solo el motor de triggers debe invocar). La función NO está en la cadena de policies RLS — solo se ejecuta vía AFTER UPDATE en `auth.users`. Revoke trivialmente seguro: el motor de triggers no necesita EXECUTE explícito al usar SECURITY DEFINER. ✅

## Spec §13 — confirmaciones humanas reflejadas en código

1. **Migración 0023** — ✅ archivo `0023_profiles_invitation_status.sql` existe y tiene el contenido del spec.
2. **Tab al final** — ✅ `UserDirectoryTabs.tsx:22-28` array `TABS` con `pending` en índice 4 (último).
3. **Rename `?role=` → `?tab=` SIN alias en URL** — ✅ `UserDirectoryTabs.tsx:32` `params.set('tab', tab)`; `page.tsx:66` `const tab = parseDirectoryTabParam(sp.tab);`. `parseDirectoryRoleParam` se mantiene como alias deprecated en código (`queries.ts:83`) pero NO se invoca desde ningún call site nuevo (ver NIT 1). El `SearchParams` type del page solo declara `tab?` (`page.tsx:27`).
4. **Texto "Pendiente"** — ✅ `UserDirectoryRow.tsx:118` (botón) literal "Pendiente". El `<UserStatusIndicator>` muestra "Invitado pendiente" como texto descriptivo aparte (`UserStatusIndicator.tsx:30`) — esto es lo esperado: el botón es corto, el indicador es explicativo.
5. **Sin bg highlight para pending** — ✅ `UserDirectoryRow.tsx:44-47` `liClassName` solo agrega `bg-surface-soft` cuando `isCaller`, no cuando `status === 'pending'`.

## Self-protection — auditoría dedicada

- `requireAcceptedTarget` definida en `actions.ts:99-139`. Lee `profiles.invitation_status` con `maybeSingle()` del target. Si error → `{ code: 'server', message: 'No se pudo validar el estado del usuario.' }`. Si no row → deja pasar (decisión documentada §4.1 del spec, el `not_found` lo cubre la action más abajo). Si pending → `{ code: 'invalid', message: 'El usuario invitado todavía no aceptó la invitación.' }`.
- **`changeRole`** (`actions.ts:146-194`): orden requireAdminCaller → self-target → requireAcceptedTarget → lookup → no-op → UPDATE. ✅ Línea 162-163.
- **`suspendUser`** (`actions.ts:201-267`): mismo orden + signOut admin. ✅ Línea 217-218.
- **`reactivateUser`** (`actions.ts:272-325`): mismo orden. ✅ Línea 290-291.
- **`inviteUser`** (`actions.ts:356-431`): NO invoca `requireAcceptedTarget` — diseño correcto, el target nuevo no existe todavía o la propia API de Supabase responde con `already_invited`/`already_exists`. ✅

UI bloquea simétricamente: `UserDirectoryRow.tsx:108-119` `actionsNode` renderea botón disabled "Pendiente" cuando `status === 'pending'` (después de la rama del caller, antes de `ChangeRoleMenu`). El menú nunca se monta para targets pending → no hay forma de disparar la action via UI; el server-side es defensa contra ataques directos via DevTools.

## Decisiones del implementer

- **Rename `DirectoryRoleFilter` → `DirectoryTab` con alias deprecated**: ✅ correcto. `DirectoryRoleFilter` se mantiene exportado en `queries.ts:19` con JSDoc `@deprecated`, junto a `parseDirectoryRoleParam` (`queries.ts:83`). Ningún call site interno los usa (verificado con grep — solo aparecen en su propia definición). El alias queda como cinturón de seguridad por si algún consumer externo hipotético importaba esos símbolos; aceptable.
- **`getPendingInvitationCount` con `head: true`**: ✅ correcto, evita transferir rows. Si falla, devuelve 0 y loguea (`queries.ts:226-229`) — un badge ausente es preferible a un 500.
- **Defensa simétrica self-target en `reactivateUser`** (preexistía): se mantiene aunque sea imposible que el caller esté inactivo. ✅ documentado en `actions.ts:281-288`.

## NITs no bloqueantes

1. **Alias `parseDirectoryRoleParam` exportado pero sin tests ni call sites** (`queries.ts:79-86`). Pro: cinturón. Contra: deuda muerta, JSDoc dice "ningún call site interno la usa". Sugerencia futura: borrar en una limpieza después de confirmar que ningún consumer externo lo importa (`grep` repo entero es trivial — actualmente 0). NO bloquea.

2. **`UserDirectoryEmptyState reason='no_matches'` en tab "Invitaciones" sin pending**: el copy genérico "No encontramos usuarios con los filtros aplicados" es funcional pero menos específico. El spec §11 ya lo identifica como "deuda futura" para un copy tipo "No hay invitaciones pendientes". NO bloquea.

3. **`Avatar status="away"` con `aria-label="Estado: away"` literal en inglés** (heredado del primitivo `Avatar`, no introducido por esta feature): el `UserStatusIndicator` adyacente dice "Invitado pendiente" en español, así que el SR escucha ambos textos. Mejor fix sería traducir el aria-label del primitivo `Avatar`, pero está fuera de scope (modificaría un primitivo usado en toda la app). NO bloquea — documentado en spec §12.

## Riesgos para el smoke test manual del humano

- **R1 — Backfill mismatch (spec §14)**: el leader marcó manualmente `broujeteixeiru-5511@yopmail.com` como pending vía SQL post-mig. Cualquier OTRO usuario que estuviera invitado pre-mig y aún no haya confirmado quedó como 'accepted' por el backfill (10 de los 11 profiles totales son 'accepted'). Si el humano detecta uno así durante el smoke test, hay que marcarlo manualmente como pending también. Riesgo aceptado en spec §14 R3.

- **R2 — Sin revalidación cross-session**: cuando el invitado confirma email, el admin debe F5 manualmente `/admin/users`. La página es `dynamic = 'force-dynamic'` así que un refresh natural resuelve. No agregamos `revalidateTag` (decisión §6.1 del spec).

- **R3 — Smoke test paso 10 (asserción G)** requiere segundo admin para atacar la action via DevTools desde otro browser. Si no hay segundo admin, queda como deuda menor (documentado en spec §16).

- **R4 — `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`**: necesario para que `inviteUser` y `suspendUser`'s `admin.auth.admin.signOut` funcionen. Ya estaba seteado para `admin_user_directory`; verificar antes del smoke test.

## Estado en feature_list.json

La feature sigue en `status: blocked` (con `blocked_reason` del implementer documentando el bloqueo MCP que el leader ya resolvió). El reviewer NO modifica el status — eso lo hace el leader al cerrar la feature tras esta aprobación.

## Veredicto final

**APPROVED WITH NITS.** 0 bloqueantes. 3 NITs cosméticos. Lista para que el leader marque `done` y commitee, sujeto al smoke test manual del humano (§16 del spec).
