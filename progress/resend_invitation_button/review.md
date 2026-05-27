# Review — feature `resend_invitation_button`

**Veredicto:** APPROVED

**Fecha:** 2026-05-26
**Reviewer:** subagente reviewer (sesión leader)
**Migración 0025 aplicada por:** leader (vía MCP) — el implementer reportó `blocked` por no tener MCP disponible; el leader aplicó la versión compactada de la mig 0025, verificó backfill de `broujeteixeiru-5511@yopmail.com` (`last_invited_at` = `invited_at` original), regeneró tipos con paridad byte a byte vs edición manual, y corrió `get_advisors` sin nuevos WARN.

## Resumen ejecutivo

Feature lista para mergear. 0 bloqueantes, 1 NIT cosmético. El implementer respetó el spec aprobado (1144 líneas) sin desviaciones materiales: action `resendInvitation` con guards en orden (zod → requireAdminCaller → requirePendingTarget), helper paralelo a `requireAcceptedTarget` que devuelve `email`/`role` para evitar doble lookup, threshold `INVITE_RESEND_THRESHOLD_MS = 3_600_000` exportado, cálculo de `canResendInvitation` server-side en `queries.ts`, UI condicional en `UserDirectoryRow` con tres ramas (caller / pending+expirado / pending sin expirar / change-role). Feedback inline con `role="status"` / `role="alert"` y auto-clear a 4s. `init.sh full` verde (lint + type-check + build, 19 rutas, `/admin/users` sigue ƒ dynamic).

## Checklist

- Tokens y colores: [x] — `grep '\[#[0-9a-fA-F]' src/components/admin/ src/lib/admin/` → cero matches. `text-primary` y `text-danger` ya definidos en `globals.css:32,45`.
- Componentes y framework: [x] — `ResendInvitationButton.tsx` es `'use client'` justificadamente (useTransition + useState + onClick). Resto de archivos modificados son server-only. `actions.ts:1` `'use server'` correcto. `page.tsx` no se modifica (la flag viaja a través de `AdminUserRow` automáticamente, ver §spec 6.3).
- Supabase: [x] — sin `createClient` directo nuevo. `requirePendingTarget` usa `createClient()` de `@/lib/supabase/server`; la action `resendInvitation` usa `createAdminClient()` solo para `auth.admin.inviteUserByEmail` (service_role no cruza al cliente). Mig 0025 ya con RLS heredada de `profiles`. Mutaciones siempre via Server Action.
- Fidelidad visual: [x] — el mockup `admin_user_directory_cards` no contemplaba este botón (decisión designer §"Referencia visual" del spec: reusar slot de acciones). El botón hereda variant `secondary` + `leadingIcon="send"` igual que `InviteUserButton`. Layout responsive (`flex flex-col items-stretch gap-1.5 md:items-end`) matchea el patrón del directorio.
- Calidad: [x] — `./init.sh full` PASA (lint 0, type-check 0, build 19 rutas, `/admin/users` ƒ dynamic). Sin `console.log` de debug (los `console.error` de actions son intencionales para observabilidad). Textos en español.

## Acceptance ítem por ítem (feature_list.json)

1. **Migración 0025 agrega columna + backfill + actualiza handle_new_user** — ✅ `supabase/migrations/0025_profiles_last_invited_at.sql:27-29` (columna), `:34-39` (backfill desde `auth.users.invited_at`), `:55-90` (replace `handle_new_user` con `last_invited_at` en el INSERT).
2. **Server Action `resendInvitation(targetUserId)` con zod, requireAdminCaller, requirePendingTarget, inviteUserByEmail con service_role, UPDATE last_invited_at=now()** — ✅ `actions.ts:536-599`. Orden: parse zod (`:539`), requireAdminCaller (`:544`), requirePendingTarget (`:555`), `admin.auth.admin.inviteUserByEmail(target.email, { data: { initial_role: target.role } })` (`:559-561`), UPDATE last_invited_at (`:589-592`), revalidatePath (`:597`).
3. **Errores Supabase mapeados (429/rate_limited, user_not_found/not_found, 422/already_accepted, resto/server) con mensajes en español** — ✅ `actions.ts:563-583`. Mapping completo + 4to case `already_accepted` (mensaje "El usuario ya aceptó la invitación. Refresca la página." — coherente con el shape de error 422/email_exists de Supabase descripto en spec §1).
4. **Decisión final: usar inviteUserByEmail (no generateLink) — Supabase envía email vía SMTP hosted** — ✅ `actions.ts:559` `admin.auth.admin.inviteUserByEmail(...)`. Mismo método que `inviteUser` usa hoy (`actions.ts:460`). Decisión documentada en spec §1 + notes del feature_list. Plan B `generateLink` queda como deuda condicional al smoke test.
5. **Lógica de visibilidad: SERVER calcula `canResendInvitation`; UI solo lee la flag** — ✅ `queries.ts:212-218` calcula la flag en el `.map()` final de `listAdminUsers`; el componente cliente solo recibe boolean. No hay cálculo de `Date.now()` ni acceso a `last_invited_at` en código cliente. `UserDirectoryRow.tsx:112` lee `user.canResendInvitation` literal.
6. **Botón con loading state + auto-revalidate** — ✅ `ResendInvitationButton.tsx:61` `loading={isPending}`; `:62` `disabled={isPending || feedback.kind === 'success'}` evita doble clic durante window de 4s; `actions.ts:597` `revalidatePath(DIRECTORY_PATH)` refresca el server snapshot.
7. **UI sin botón si target.invitation_status='accepted'** — ✅ `UserDirectoryRow.tsx:111` la rama del `ResendInvitationButton` está anidada DENTRO de `status === 'pending'`. Para accepted se renderiza `ChangeRoleMenu` como antes.
8. **Smoke test manual documentado (invitar → 1h → reenviar → confirmar)** — ✅ Cubierto por spec §15 (16 pasos). El humano lo ejecuta tras esta aprobación.

## Migración 0025 — verificación SQL

- Archivo `supabase/migrations/0025_profiles_last_invited_at.sql` matchea funcionalmente el SQL del spec §2 (líneas 115-211 del design.md):
  - (1) `alter table public.profiles add column if not exists last_invited_at timestamptz null;` (`0025:27-29`) ✅
  - (2) Backfill: `update profiles p set last_invited_at = au.invited_at from auth.users au where p.id = au.id and au.invited_at is not null and p.last_invited_at is null;` (`0025:34-39`) — idempotente ✅
  - (3) Sin índice extra (justificado en comentarios `:41-49`: cardinalidad mínima, `profiles_pending_invitation_idx` ya cubre) ✅
  - (4) `create or replace function public.handle_new_user()` con SECURITY DEFINER + set search_path = public, devuelve trigger, incluye `last_invited_at, new.invited_at` en el INSERT (`0025:55-90`) ✅
- El leader confirmó (vía MCP) que `\sf+ public.handle_new_user` matchea byte a byte la versión aplicada en remoto.
- Backfill verificado por leader: `broujeteixeiru-5511@yopmail.com` tiene `last_invited_at = invited_at original` (age >1h al momento de la review, así `canResendInvitation=true` ya en runtime).
- RLS: columna sobre `profiles` (RLS ya activa desde mig 0002). No requiere policies nuevas — `select last_invited_at` queda cubierto por las policies existentes; el UPDATE `profiles.last_invited_at` desde la action corre con la sesión admin (que pasa la policy `update profiles for admins`).
- `get_advisors` post-mig: 0 WARN nuevos (confirmado por leader; el replace de `handle_new_user` mantiene el patrón ya hardened y no introduce funciones nuevas).

## Spec §13 — confirmaciones humanas reflejadas en código

A. **Mig=0025** — ✅ archivo `supabase/migrations/0025_profiles_last_invited_at.sql` con numeración correcta.
B. **Plan B (blocked si Supabase rechaza pending con 422)** — ✅ asumido como riesgo del smoke test. El mapeo `already_accepted` cubre el caso `email_exists`/422 con mensaje específico (`actions.ts:570-572,577-579`). Si en producción todos los reenvíos devuelven 422, hay que pivotear a `generateLink` — deuda condicional documentada en spec §13.B y en notes del feature_list.
C. **Texto "Invitación reenviada a {nombre}."** — ✅ `ResendInvitationButton.tsx:73` literal: `Invitación reenviada a <span className="font-medium">{userDisplayName}</span>.`
D. **Auto-clear a 4s** — ✅ `ResendInvitationButton.tsx:51` `setTimeout(() => setFeedback({ kind: 'idle' }), 4000);`
E. **No revertir UPDATE de `last_invited_at` si falla post-envío** — ✅ `actions.ts:585-595` solo loguea, no devuelve error; la action retorna `ok: true` aún si el UPDATE falla.
F. **NO mostrar timestamp en UI** — ✅ `UserDirectoryRow.tsx` y `ResendInvitationButton.tsx` no muestran `last_invited_at` como texto. El admin solo ve botón activo (>1h) o "Pendiente" disabled (<1h).

## Helper `requirePendingTarget` — auditoría dedicada

- Definido en `actions.ts:173-221`. Espejo lógico de `requireAcceptedTarget` (`actions.ts:124-162`):
  - `requireAcceptedTarget` rechaza si `invitation_status === 'pending'`.
  - `requirePendingTarget` rechaza si `invitation_status !== 'pending'`.
- Diferencias intencionales:
  - `requirePendingTarget` devuelve `{ ok: true, email, role }` (datos útiles para el siguiente RTT) vs `requireAcceptedTarget` que devuelve solo `{ ok: true }`.
  - `requirePendingTarget` trata `!data` como `not_found` (con shape de `ResendInvitationResult`) — `requireAcceptedTarget` deja pasar (`!data` → `{ ok: true }`) porque las actions que lo invocan hacen su propio lookup de `not_found` posterior. Asimetría correcta: en `resendInvitation` el lookup principal YA es este helper (necesita el email), así que el `not_found` se reporta acá.
- **Integración**: invocado SOLO desde `resendInvitation` (`actions.ts:555`). NO se invoca desde `inviteUser` (correcto: target no existe todavía), ni de `changeRole`/`suspendUser`/`reactivateUser` (esas tres usan `requireAcceptedTarget` que es el opuesto). ✅
- Test mental de seguridad: si un admin manipula DevTools y dispara `resendInvitation` con un `targetUserId` que apunta a un user `accepted`, la action devuelve `{ ok: false, error: { code: 'not_pending', message: '...' } }` antes de tocar Supabase. ✅

## Lógica de visibilidad — auditoría server-side

- `queries.ts:212-218`:
  ```ts
  const now = Date.now();
  const lastInvitedAt = p.last_invited_at;
  const canResendInvitation =
    p.invitation_status === 'pending' &&
    lastInvitedAt !== null &&
    now - new Date(lastInvitedAt).getTime() >= INVITE_RESEND_THRESHOLD_MS;
  ```
- Lógica correcta: `now - last_invited_at >= 1h` → flag `true`. Cualquier fila no-pending o sin `last_invited_at` → `false`.
- Verificación con el caso real (`broujeteixeiru-5511@yopmail.com`): `last_invited_at = 2026-05-26 23:14:14`, age >1h al momento de la review → flag `true` en runtime. Coincide.
- Cálculo en TS (no en SQL) — justificado en spec §4.2: threshold centralizado en una constante; SQL inalterado; cambiar el valor no requiere regenerar tipos.
- Seguridad: el cliente solo recibe el boolean. La action `resendInvitation` re-verifica server-side con `requirePendingTarget` antes de actuar (no confía en el flag pasado del cliente).

## Constante `INVITE_RESEND_THRESHOLD_MS`

- Exportada desde `queries.ts:27` con valor `60 * 60 * 1000` (3_600_000 ms = 1 hora).
- Usada en `queries.ts:218` (cálculo del flag).
- Documentada con JSDoc explicando el matching con TTL default de Supabase invite (`queries.ts:22-26`).
- Riesgo R6 del spec (TTL configurable en Supabase) aceptado: cambiarla acá impacta UI + servidor simultáneamente.

## Error handling — auditoría

`actions.ts:563-583`:

- 429 → `'rate_limited'` → "Demasiados reenvíos recientes. Espera unos minutos." ✅
- `user_not_found` / 404 → `'not_found'` → "Usuario no encontrado." ✅
- `email_exists` / 422 → `'already_accepted'` → "El usuario ya aceptó la invitación. Refresca la página." ✅
- Resto → `'server'` → "No se pudo reenviar la invitación." ✅
- Sin filtrar detalles internos: `inviteErr.message` solo se loguea (`actions.ts:581`), no llega al cliente.
- Códigos `unauthenticated` y `forbidden` viajan vía cast desde `requireAdminCaller` (`actions.ts:544-553`) — mismo patrón ya usado en `inviteUser` (`actions.ts:446-457`).

## A11y — auditoría

- `aria-label`: `ResendInvitationButton.tsx:63` → `Reenviar invitación a ${userEmail}`. Usa email (no displayName) — desambigua si dos users tienen el mismo nombre. ✅
- `aria-busy`: `:64` `aria-busy={isPending}`. El Button primitive (`Button.tsx:65`) además aplica `aria-busy={loading || undefined}` cuando `loading={isPending}`, así que doble cobertura. ✅
- `role="status"` en feedback success (`:72`): live region polite (lectores anuncian sin interrumpir). ✅
- `role="alert"` en feedback error (`:77`): live region assertive (anuncia inmediatamente). ✅
- Botón disabled "Pendiente" en `UserDirectoryRow.tsx:122-126`: `disabled aria-disabled="true"` + `title` con explicación actualizada. ✅

## NIT no bloqueante

1. **`useTransition` no abortable**: `ResendInvitationButton.tsx:42` el `startTransition` se inicia en cada `handleClick`. Si el admin clickea rápido dos veces antes de que arranque la transición, hay window de microsegundos donde se ejecutan dos requests. Mitigación parcial: `disabled={isPending || feedback.kind === 'success'}` (`:62`) cubre el caso una vez que la transición arrancó. Para mitigar el window inicial habría que agregar un `useRef<boolean>` guard, pero (a) la latencia humana es muy superior al RTT del state update, (b) Supabase rate-limita 429 si pasa, (c) el server-side guard `requirePendingTarget` ya bloquearía el segundo si la primera UPDATE de `last_invited_at` ya pasó. NO bloquea — aceptado como ruido teórico.

## Riesgos para el smoke test manual del humano

- **R1 — Comportamiento de `inviteUserByEmail` con user pending**: si Supabase responde `email_exists`/422 al reenviar (en lugar de regenerar el OTP), la feature queda funcionalmente rota: el admin ve "El usuario ya aceptó la invitación" pero el target sigue pending. Plan B documentado en spec §13.B (pivot a `generateLink` + custom SMTP, fuera de scope MVP). Asserción E del smoke test (§15 paso 10) detecta el caso: si el email NO llega a yopmail, hay que pivotear.

- **R2 — SUPABASE_SERVICE_ROLE_KEY en .env.local**: necesario para `createAdminClient()`. Ya estaba seteado para `inviteUser`/`suspendUser`. Verificar antes del smoke test.

- **R3 — Forzar el escenario expirado vía MCP**: para activar el botón sin esperar 1h, ejecutar `update profiles set last_invited_at = now() - interval '2 hours' where email = '...'`. Smoke test §15 paso 3 lo documenta.

- **R4 — Race sub-100ms entre guard y RTT**: si el target confirma email entre `requirePendingTarget` y `inviteUserByEmail`, Supabase responde `email_exists`/422 y la UI muestra `already_accepted`. Extremadamente improbable. Mensaje claro al admin: "El usuario ya aceptó la invitación. Refresca la página." ✅

## Estado en feature_list.json

La feature sigue en `status: in_progress` (el leader la cambió de `blocked` al destrabar). El reviewer NO modifica el status — eso lo hace el leader al cerrar la feature tras esta aprobación.

## Veredicto final

**APPROVED.** 0 bloqueantes. 1 NIT cosmético (window de microsegundos en doble clic, aceptado). Lista para que el leader marque `done` y commitee, sujeto al smoke test manual del humano (§15 del spec, asserciones A→F + opcionales G/H).
