# Design spec — invitation_status_indicator

> Status: `requires_approval = true`. Esta feature pasa por la puerta
> de aprobación humana antes del implementer. Las 2 decisiones C1/C2
> ya están cerradas (ver feature_list.json notes 2026-05-26) y se
> reflejan acá. Los puntos abiertos para confirmación final del humano
> están listados en §13.

## 0. Contexto + bug que se arregla

Smoke test manual de `admin_user_directory` (2026-05-26) detectó que el
indicador de estado en `/admin/users` muestra "Activo" desde el momento
en que el admin envía la invitación — antes incluso de que el invitado
abra el correo. Verificación vía MCP confirmó que el usuario invitado
`broujeteixeiru-5511@yopmail.com` tenía:

- `auth.users.invited_at`: 2026-05-26 23:14:14 (lleno).
- `auth.users.email_confirmed_at`: NULL (no confirmado).
- `auth.users.last_sign_in_at`: NULL (nunca login).
- `profiles.is_active`: `true` (porque `handle_new_user` setea ese valor
  por default desde el INSERT).

Causa raíz: `UserStatusIndicator.tsx` deriva solo de `profiles.is_active`,
que el trigger `handle_new_user` (mig 0002) inicializa en `true`. No hay
forma de distinguir "fui creado por invite y aún no acepté" de "fui
creado por signup directo y completé el flow".

Esta feature persiste el estado de invitación como columna autoritativa
en `profiles` (en vez de derivarlo en tiempo de query desde `auth.users`,
que requeriría service_role en cada request), agrega tabs filtradas en
el directorio, y bloquea las acciones admin sobre pending tanto en UI
como en server.

## Referencia visual

- Mockup: `docs/designs/admin_user_directory_cards/screen.png`
- HTML: `docs/designs/admin_user_directory_cards/code.html`
- Spec previa: `progress/admin_user_directory/design.md` (referencia base
  que esta spec extiende; sigue siendo fuente de verdad para todo lo que
  acá no se redefine).

El mockup original NO contempla un estado "Invitado pendiente". Decisión
del designer: introducir un estado visual nuevo que sigue el patrón ya
establecido para el status indicator (icono + texto), reutilizando
`Avatar status="away"` (color warning, mismo amarillo ya tokenizado).

## 1. Migración SQL — `0023_profiles_invitation_status.sql`

Una sola migración. Patrón: SECURITY DEFINER + `set search_path = public`
como mig 0017/0018/0020. La numeración siguiente es **0023** (la última
aplicada es 0022).

```sql
-- 0023_profiles_invitation_status.sql
--
-- Estado autoritativo de la invitación en profiles. Hasta ahora la UI
-- derivaba "Activo / Inactivo" solo de profiles.is_active, lo que hacía
-- que un usuario recién invitado (sin confirmar email) apareciera como
-- "Activo" desde el INSERT del profile (smoke test 2026-05-26).
--
-- Modelo:
--   profiles.invitation_status invitation_status_t not null default 'accepted'
--   - 'pending'  → invitado por admin, NO ha confirmado email todavía.
--   - 'accepted' → confirmó email O entró por signup directo O es seed.
--
-- Triggers:
--   1) handle_new_user (replace): al crear el profile, lee auth.users
--      del row recién insertado y decide pending vs accepted.
--   2) on_auth_user_confirmed (nuevo): AFTER UPDATE OF email_confirmed_at
--      en auth.users; flippea profiles.invitation_status a 'accepted'
--      cuando la transición es NULL → NOT NULL.
--
-- Backfill: TODOS los profiles existentes → 'accepted'. Justificación:
-- la columna no existía hasta ahora, y todos los profiles actuales han
-- estado funcionando como "Activo" en producción, así que pasar a
-- 'accepted' preserva el comportamiento visible. El advisor de UX
-- (humano) lo confirmó implícitamente al pedir el fix.

-- (1) Enum
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'invitation_status_t'
  ) then
    create type public.invitation_status_t as enum ('pending', 'accepted');
  end if;
end$$;

-- (2) Columna
alter table public.profiles
  add column if not exists invitation_status public.invitation_status_t
    not null default 'accepted';

-- (3) Backfill explícito por idempotencia (el default ya cubre filas
--     existentes, pero dejamos el UPDATE para que la intención sea
--     auditable en el ledger).
update public.profiles set invitation_status = 'accepted'
 where invitation_status is null
    or invitation_status not in ('pending', 'accepted');

-- (4) Índice parcial: las queries de la tab "Invitaciones" filtran por
--     pending, que será siempre una fracción mínima del total.
create index if not exists profiles_pending_invitation_idx
  on public.profiles (created_at desc)
  where invitation_status = 'pending';

-- (5) handle_new_user: reemplaza la implementación de mig 0002 para
--     incluir invitation_status. Mantiene el on conflict do nothing y
--     el resto de columnas idénticas. Lee auth.users del NEW row (el
--     trigger corre AFTER INSERT en auth.users) para inferir el estado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_status public.invitation_status_t;
begin
  -- Invited si: vino por invite (invited_at no nulo) Y todavía no
  -- confirmó email. El segundo check importa porque el evento de
  -- confirmación post-invite también puede disparar este trigger en
  -- algunos paths (defensivo).
  if new.invited_at is not null and new.email_confirmed_at is null then
    computed_status := 'pending';
  else
    computed_status := 'accepted';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, invitation_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    computed_status
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El trigger on_auth_user_created ya existe (mig 0002). NO se recrea;
-- la nueva definición de handle_new_user es picked up automáticamente.

-- (6) Trigger nuevo: cuando se confirma email, marca el profile como
--     accepted. Solo actúa en la transición NULL → NOT NULL para no
--     romper casos teóricos (re-confirmación, edición admin de la
--     columna por algún motivo futuro).
create or replace function public.on_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
       set invitation_status = 'accepted'
     where id = new.id
       and invitation_status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.on_auth_user_confirmed();

-- Nota: ambas funciones son SECURITY DEFINER pero NO se otorga EXECUTE
-- a authenticated/anon. Solo el motor de triggers las invoca. Esto
-- replica el patrón de mig 0017/0018/0020 (handle_new_user ya estaba
-- así desde mig 0011 + 0015).
```

### Validaciones post-migración (verificable vía MCP)

- `select pg_typeof(invitation_status) from public.profiles limit 1`
  → `invitation_status_t`.
- `select count(*) from public.profiles where invitation_status is null`
  → 0.
- `select count(*) from public.profiles where invitation_status = 'pending'`
  → debería ser 0 inicialmente (porque el backfill marcó todo como
  accepted; los pending vendrán de invites nuevos post-deploy).
- `get_advisors` no debe reportar nada crítico nuevo. El WARN
  `function_search_path_mutable` no aplica (ambas funciones lo fijan).

## 2. Regenerar tipos TS

Tras `apply_migration`, el implementer corre el MCP
`generate_typescript_types` y reemplaza `src/types/database.ts`. Esto
añade automáticamente:

- `Database['public']['Enums']['invitation_status_t']` = `'pending' | 'accepted'`.
- `profiles.Row.invitation_status: 'pending' | 'accepted'`.
- `profiles.Insert.invitation_status?: 'pending' | 'accepted' | null`.
- `profiles.Update.invitation_status?: 'pending' | 'accepted' | null`.

Sin cambios manuales al archivo de types.

## 3. Cambios en `src/lib/admin/queries.ts`

### 3.1. Nuevo tipo `DirectoryTab`

Reemplaza el uso interno de `DirectoryRoleFilter` como discriminator de
tabs por un tipo más expresivo. **`DirectoryRoleFilter` se mantiene
public-exportado** porque `UserDirectoryTabs` y los parsers ya lo usan;
agregamos uno nuevo para la tab pending. Decisión: la tab "Invitaciones"
NO se modela como `role='pending'` (no es un rol) sino como una tab
independiente.

```ts
// Tabs que la UI puede pedir. 'pending' es ortogonal al rol.
export type DirectoryTab = 'all' | 'user' | 'agent' | 'admin' | 'pending';

export function parseDirectoryTabParam(raw: string | string[] | undefined): DirectoryTab {
  if (typeof raw !== 'string') return 'all';
  if (raw === 'all' || raw === 'user' || raw === 'agent' || raw === 'admin' || raw === 'pending')
    return raw;
  return 'all';
}
```

**Decisión: extender `getDirectoryUsers` (renombrado interno) con `tab`
en vez de crear función separada.** Justificación:

- El 95% de la query es idéntico (paginación, search, count, enrichment
  de performance). Una función separada duplicaría todo.
- El branching es mínimo y bien localizado (where clause).
- La UI ya pasa un único parámetro (`role`); cambiarlo a `tab` es un
  rename + soporte de un valor extra. Diff mínimo en la page.

El parámetro `role` en `ListAdminUsersOptions` se renombra a `tab`. La
firma queda:

```ts
export interface ListAdminUsersOptions {
  q: string;
  tab: DirectoryTab; // antes: role: DirectoryRoleFilter
  page: number;
  pageSize: number;
}
```

`DirectoryRoleFilter` se mantiene exportado como alias hacia atrás:

```ts
/** @deprecated Usar `DirectoryTab`. Alias retenido para no romper imports. */
export type DirectoryRoleFilter = 'all' | 'user' | 'agent' | 'admin';
```

Y `parseDirectoryRoleParam` se mantiene como wrapper que llama a
`parseDirectoryTabParam` filtrando `'pending'` → `'all'`. Documentar
deprecation. **El implementer puede simplemente reemplazar todos los
call sites en un sólo paso si lo prefiere** (solo dos: `page.tsx` y
`UserDirectoryTabs.tsx`); el alias es un fallback por seguridad.

### 3.2. Lógica de filtrado por tab

Donde antes había:

```ts
if (role !== 'all') query = query.eq('role', role);
```

Ahora:

```ts
if (tab === 'pending') {
  query = query.eq('invitation_status', 'pending');
} else {
  // Tabs por rol (incluido 'all') EXCLUYEN pending — no contaminan
  // contadores de Usuarios/Agentes/Admins.
  query = query.eq('invitation_status', 'accepted');
  if (tab !== 'all') query = query.eq('role', tab);
}
```

### 3.3. Selección de la columna

```ts
.select('id, email, full_name, avatar_url, role, is_active, invitation_status, created_at', {
  count: 'exact',
})
```

### 3.4. Tipo `AdminUserRow` enriquecido

```ts
export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  invitation_status: 'pending' | 'accepted'; // ← nuevo
  created_at: string;
  properties_count: number | null;
  sales_ytd: number | null;
}
```

### 3.5. Función nueva `getPendingInvitationCount`

Para alimentar el badge de la tab Invitaciones sin requerir una query
adicional cuando ya se está listando otra tab.

```ts
export async function getPendingInvitationCount(supabase: SupabaseDb): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('invitation_status', 'pending');
  if (error) {
    console.warn('[getPendingInvitationCount] failed', error);
    return 0;
  }
  return count ?? 0;
}
```

`head: true` evita traer rows. Page la invoca una sola vez por render.
Si la tab activa es `pending`, el `total` ya devuelto por
`listAdminUsers` coincide; aún así llamamos a `getPendingInvitationCount`
por uniformidad del shape de la prop.

## 4. Cambios en `src/lib/admin/actions.ts`

### 4.1. Helper nuevo `requireAcceptedTarget`

**Decisión: SÍ centralizar** siguiendo el patrón `requireAdminCaller`.
Justificación:

- Las 3 actions afectadas (`changeRole`, `suspendUser`, `reactivateUser`)
  necesitan exactamente la misma lectura + check + shape de error.
- Sin helper, son ~10 líneas duplicadas × 3 = 30 líneas. Con helper, una
  llamada de una línea cada una.
- Mantiene el archivo legible y la lógica auditable en un solo lugar.

```ts
/**
 * Verifica que el target NO esté en estado de invitación pendiente.
 * Si lo está, devuelve un ActionResult `invalid` listo para retornar.
 * Devuelve `{ ok: true }` cuando puede proceder.
 *
 * Importante: este check se hace ADEMÁS del existente lookup que cada
 * action ya hace para validar `not_found` y `no_op`. Acá solo nos
 * importa el campo `invitation_status`.
 */
async function requireAcceptedTarget(
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; result: Extract<ActionResult, { ok: false }> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('invitation_status')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    console.error('[requireAcceptedTarget] lookup failed:', error);
    return {
      ok: false,
      result: {
        ok: false,
        error: { code: 'server', message: 'No se pudo validar el estado del usuario.' },
      },
    };
  }
  // Si no existe el row, dejamos pasar — el lookup de cada action
  // se encarga del 'not_found' con su mensaje propio.
  if (!data) return { ok: true };

  if (data.invitation_status === 'pending') {
    return {
      ok: false,
      result: {
        ok: false,
        error: {
          code: 'invalid',
          message: 'El usuario invitado todavía no aceptó la invitación.',
        },
      },
    };
  }
  return { ok: true };
}
```

### 4.2. Integración en `changeRole`, `suspendUser`, `reactivateUser`

El check se inserta DESPUÉS del `requireAdminCaller` y del self-target
guard, pero ANTES del lookup principal del target (que también revalida
`not_found` y `no_op`). Posición elegida porque:

1. El self-target debe ser primero (cubre el caso teórico
   admin-invitado-pendiente que se invita a sí mismo a otro rol —
   imposible con la UI actual pero defensivo).
2. El check de pending es barato (una sola row, una sola columna) y debe
   correr antes del UPDATE.
3. NO se hace en `inviteUser`: enviar otra invitación a un user pending
   no aplica (Supabase ya devuelve `invite_already_sent`).

Ejemplo, en `changeRole`:

```ts
const caller = await requireAdminCaller();
if (!caller.ok) return caller.result;

if (parsed.data.targetUserId === caller.callerId) {
  return { ok: false, error: { code: 'self_target', message: '...' } };
}

// NUEVO bloque, líneas insertadas tal cual:
const accepted = await requireAcceptedTarget(parsed.data.targetUserId);
if (!accepted.ok) return accepted.result;

// ... resto del flow (lookup, no-op, UPDATE) sin cambios.
```

Idéntico patrón en `suspendUser` y `reactivateUser`.

### 4.3. No tocar `inviteUser`

`inviteUser` ya delega en `auth.admin.inviteUserByEmail`, que tiene su
propia detección de `invite_already_sent` y `email_exists`. Si el admin
intenta re-invitar a un pending desde la UI (caso: cambió de opinión
sobre el rol inicial), Supabase responde `already_invited`. Acceptable
para MVP. **Funcionalidad de "reenviar invite" queda fuera de scope —
deuda documentada en §11.**

## 5. Cambios en UI

### 5.1. `UserStatusIndicator.tsx`

Refactor de la prop:

```ts
// Antes
interface UserStatusIndicatorProps {
  isActive: boolean;
  className?: string;
}

// Después
export type UserStatus = 'pending' | 'active' | 'inactive';

export interface UserStatusIndicatorProps {
  status: UserStatus;
  className?: string;
}
```

Mapeo completo:

| `status`     | Icon                    | Color icon     | Texto                |
| ------------ | ----------------------- | -------------- | -------------------- |
| `'pending'`  | `mail_outline`          | `text-warning` | "Invitado pendiente" |
| `'active'`   | `check_circle`          | `text-primary` | "Activo"             |
| `'inactive'` | `remove_circle_outline` | `text-muted`   | "Inactivo"           |

Texto del componente: `text-xs` y `text-muted` (consistente con la
versión actual). El color que cambia es solo el del icono.

Helper de mapeo en el mismo archivo (o `src/lib/admin/format.ts` —
designer recomienda el archivo del componente porque solo lo usa él):

```ts
export function deriveUserStatus(row: {
  invitation_status: 'pending' | 'accepted';
  is_active: boolean;
}): UserStatus {
  // Prioridad: pending > inactive > active.
  // Edge case (decisión §6): un user pending Y is_active=false se ve
  // como 'pending'. Justificación: si todavía no aceptó la invitación,
  // el estado "Inactivo" carece de sentido — nunca tuvo acceso a perder.
  if (row.invitation_status === 'pending') return 'pending';
  if (!row.is_active) return 'inactive';
  return 'active';
}
```

### 5.2. `UserDirectoryRow.tsx`

Tres cambios:

1. **Compute del status**: en lugar de pasar `isActive={user.is_active}`,
   pasar `status={deriveUserStatus(user)}`. El componente importa
   `deriveUserStatus` desde `UserStatusIndicator.tsx`.

2. **Avatar status**: cuando `status === 'pending'`, usar
   `<Avatar status="away" />` (que ya existe — color warning). Para
   `'active'`/`'inactive'` mantener `online`/`offline`. Helper inline:

   ```ts
   const avatarStatus: 'online' | 'away' | 'offline' =
     status === 'pending' ? 'away' : status === 'active' ? 'online' : 'offline';
   ```

3. **ActionsNode con tercer caso pending**: cuando `status === 'pending'`
   (independiente de `isCaller`), reemplazar `ChangeRoleMenu` por un
   botón disabled idéntico al patrón del caller (líneas 87-99 del
   archivo actual). Copy/title:
   - Texto del botón: "Pendiente"
   - `title="El usuario todavía no aceptó la invitación"`
   - `aria-disabled="true"`

   Estructura final del actionsNode:

   ```tsx
   const actionsNode = isCaller ? (
     <Button disabled aria-disabled="true" title="No puedes cambiar tu propio rol" ...>
       No editable
     </Button>
   ) : status === 'pending' ? (
     <Button disabled aria-disabled="true" title="El usuario todavía no aceptó la invitación" ...>
       Pendiente
     </Button>
   ) : (
     <ChangeRoleMenu ... />
   );
   ```

4. **No-highlight de fila para pending**: la fila pending NO se pinta
   con `bg-surface-soft` (eso queda reservado para el caller). Se
   diferencia visualmente con el icono `mail_outline` warning + Avatar
   `away` + botón "Pendiente". Decisión: usar dos canales visuales
   (icono + estado del botón) es suficiente; agregar background daría
   ruido visual con el caller que usa el mismo color family.

### 5.3. `UserDirectoryTabs.tsx`

Cinco tabs. **Decisión de ubicación: tab "Invitaciones" al FINAL**, tras
"Admins". Justificación:

- Las primeras 4 tabs son "el universo permanente" (categorías por rol
  que siempre existen). "Invitaciones" es transitoria (los pending
  eventualmente se aceptan o se borran). Ponerla al final replica el
  patrón de "Archivadas" en el dashboard de propiedades.
- El mockup `admin_user_directory_cards` no contempla esta tab, así que
  no hay precedente visual que respetar.
- Lectura natural izq→der: el admin entra y ve sus tabs ya conocidas;
  "Invitaciones" aparece como un anexo, no como protagonista.

Nuevo tipo y array:

```ts
import type { DirectoryTab } from '@/lib/admin/queries';

export interface UserDirectoryTabsProps {
  currentTab: DirectoryTab;
  currentQuery: string;
  pendingCount: number;
}

interface TabDef {
  value: DirectoryTab;
  label: string;
}

const TABS: ReadonlyArray<TabDef> = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuarios' },
  { value: 'agent', label: 'Agentes' },
  { value: 'admin', label: 'Admins' },
  { value: 'pending', label: 'Invitaciones' }, // ← nueva al final
];
```

#### Badge de count

Cuando `tab.value === 'pending' && pendingCount > 0`, renderizar a la
derecha del label un `<Badge variant="warning" size="sm">{count}</Badge>`.
Si `pendingCount === 0`, la tab sigue visible pero sin badge (no la
escondemos: el admin debe poder navegar a una tab vacía para confirmar
que no hay pending).

Layout del tab (ejemplo del item `pending`):

```tsx
<Link
  href={buildHref(tab.value, currentQuery)}
  aria-current={isActive ? 'page' : undefined}
  className={cn(
    'inline-flex items-center gap-2 pb-3 whitespace-nowrap transition-colors',
    isActive
      ? 'border-b-2 border-primary text-sm font-semibold text-primary'
      : 'text-sm font-medium text-muted hover:text-on-surface',
  )}
>
  {tab.label}
  {tab.value === 'pending' && pendingCount > 0 && (
    <Badge variant="warning" size="sm">
      {pendingCount}
    </Badge>
  )}
</Link>
```

A11y: cuando hay badge, agregar `aria-label="Invitaciones (${count}
pendientes)"` al Link para que screen readers lean el número aunque el
Badge sea decorativo.

#### `buildHref` actualizado

```ts
function buildHref(tab: DirectoryTab, query: string): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('tab', tab); // renombramos param a 'tab'
  if (query) params.set('q', query);
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : '/admin/users';
}
```

**Cambio de searchParam: `?role=` → `?tab=`.** Justificación:

- El nombre `role` ya no encaja porque `pending` no es un rol.
- Migración sin rompimiento externo: ningún link interno apunta
  hardcodeado a `?role=user|agent|admin` (verificable con grep:
  `grep -rn "role=" src/ | grep "/admin/users"`).
- Si un humano tiene un bookmark con `?role=user`, lo trataremos como
  desconocido y caerá en `'all'` — comportamiento defensivo aceptable.

### 5.4. `page.tsx`

Cambios:

1. **Parsear `tab` en lugar de `role`** y pasarlo a la query.
2. **Llamar `getPendingInvitationCount` en paralelo** con
   `listAdminUsers`.
3. **Pasar `pendingCount` a `UserDirectoryTabs`**.

Diff conceptual:

```tsx
// Antes
const role = parseDirectoryRoleParam(sp.role);
const { items, total } = await listAdminUsers(supabase, { q, role, page, pageSize: PAGE_SIZE });
// ...
<UserDirectoryTabs currentRole={role} currentQuery={q} />;

// Después
const tab = parseDirectoryTabParam(sp.tab);
const [{ items, total }, pendingCount] = await Promise.all([
  listAdminUsers(supabase, { q, tab, page, pageSize: PAGE_SIZE }),
  getPendingInvitationCount(supabase),
]);
// ...
<UserDirectoryTabs currentTab={tab} currentQuery={q} pendingCount={pendingCount} />;
```

El tipo `SearchParams` se actualiza para reemplazar `role?` por `tab?`.

### 5.5. `index.ts` barrel

Sin cambios — re-exporta los mismos componentes; los renames son
internos.

## 6. Casos edge — decisiones cerradas

Todos los casos del prompt del líder se aceptan con la decisión
propuesta:

1. **User pending confirma email → refresca solo**: SÍ. La página
   `/admin/users` es Server Component con `dynamic = 'force-dynamic'`
   (líneas 19 del page.tsx). Cada navegación re-fetcha. El user que
   confirma el invite navega al callback de Supabase, no a
   `/admin/users`, así que no necesita revalidación cross-session.
   El admin solo necesita F5 o navegar a la página para ver el cambio.
   **No agregar revalidateTag ni revalidatePath.**

2. **User pending Y is_active=false (admin manipuló SQL)**: render como
   `'pending'`. Codificado en `deriveUserStatus`. Justificación: si
   nunca aceptó, "Inactivo" es semánticamente erróneo.

3. **Seed users → 'accepted'**: cubierto por el backfill UPDATE de la
   migración. Los seed users entran por el script TS que usa
   `auth.admin.createUser` (no `inviteUserByEmail`), así que no tienen
   `invited_at`. Aunque sí pasa por `handle_new_user`, el nuevo trigger
   detecta `invited_at IS NULL` y los marca `'accepted'`. Doble
   seguridad: el default + el backfill.

4. **Forward-compat: signup directo con email_confirmed_at no nulo
   desde el insert** (Supabase teóricamente podría cambiar este
   comportamiento): `handle_new_user` revisa
   `invited_at IS NOT NULL AND email_confirmed_at IS NULL`. Si ambas
   condiciones no se cumplen → `'accepted'`. El trigger
   `on_auth_user_confirmed` solo actúa en la transición NULL → NOT NULL,
   así que no rompe el caso (la fila ya está `'accepted'`, el UPDATE
   `where invitation_status = 'pending'` no afecta nada).

5. **Re-invite teórico**: si en el futuro implementamos "reenviar
   invite", el flow re-llama `inviteUserByEmail` que (en teoría)
   regenera el token sin tocar `invited_at`. `handle_new_user` solo
   corre en INSERT, no en re-invite, así que no hay riesgo de revertir
   un `'accepted'` a `'pending'` accidentalmente. **Deuda futura:
   reenvío de invite. Out of scope.**

## 7. Componentes a reutilizar vs modificar

### Reutilizar tal cual

- `Avatar` con `status="away"` (color warning ya tokenizado).
- `Badge variant="warning" size="sm"` para el count de la tab.
- `Icon name="mail_outline"` (ya usado en `Input.tsx`, `AgentBadge.tsx`).
- `Button disabled aria-disabled` (mismo patrón que el caller).

### Modificar

- `UserStatusIndicator.tsx` — refactor de prop `isActive` → `status`.
- `UserDirectoryRow.tsx` — compute del status + 3er caso disabled.
- `UserDirectoryTabs.tsx` — 5ta tab + badge + rename param.
- `src/app/(admin)/admin/users/page.tsx` — parse `tab`, getter de count.
- `src/lib/admin/queries.ts` — rename + extensión + count function.
- `src/lib/admin/actions.ts` — helper + 3 inserts del check.

### Crear

- `supabase/migrations/0023_profiles_invitation_status.sql`.

### NO modificar

- `src/lib/admin/schemas.ts` (sin cambios — el shape de input no cambia).
- `src/components/admin/ChangeRoleMenu.tsx` (no se renderiza para
  pending; bloqueo está antes en `UserDirectoryRow`).
- `src/components/admin/ChangeRoleConfirmDialog.tsx` (no llega a
  abrirse para pending por UI; los actions tienen su propio guard).
- `src/components/admin/InviteUserButton.tsx` / `InviteUserDialog.tsx`
  (sin cambios — el invite sigue funcionando idéntico; lo que cambia es
  cómo se rinde el resultado en el listado).
- `src/lib/supabase/admin.ts`.
- Las migraciones aplicadas 0001-0022.

## 8. Tipografía

Sin cambios respecto a `progress/admin_user_directory/design.md` §11.
Los textos nuevos heredan:

- "Invitado pendiente" en `UserStatusIndicator`: `text-xs text-muted`.
- "Invitaciones" en tab: `text-sm font-medium text-muted` (inactivo) /
  `text-sm font-semibold text-primary` (activo).
- Badge count: `text-[11px] font-semibold` (default de `Badge size="sm"`).
- "Pendiente" en botón disabled: `text-xs font-medium` (default
  `Button size="sm"`).
- Texto "Tooltip": el `title` HTML nativo no usa tokens — sigue siendo
  decisión a11y aceptable hasta que migremos a un tooltip custom.

## 9. Datos

### Tablas consumidas

- `profiles` (read): + columna `invitation_status` nueva.
- `auth.users` (read indirecto vía trigger `on_auth_user_confirmed`).
- `profiles` (write): el trigger nuevo escribe `invitation_status`.

### Server vs Client

- `page.tsx`, `UserDirectoryTabs`, `UserDirectoryRow`,
  `UserStatusIndicator` — Server Components (sin cambios).
- `ChangeRoleMenu`, dialogs, search, invite — Client Components (sin
  cambios).

### Cache / revalidación

- Sigue `dynamic = 'force-dynamic'`.
- El `revalidatePath('/admin/users')` en `changeRole`/`suspendUser`/
  `reactivateUser`/`inviteUser` sigue activo. **No se agrega
  revalidación cross-session para la confirmación de email** (decisión
  §6.1: F5 manual del admin es suficiente).

## 10. Interactividad

| Elemento            | Tipo   | Cambio                                                 |
| ------------------- | ------ | ------------------------------------------------------ |
| Tabs                | static | Tab nueva al final; rename `?role=` → `?tab=`.         |
| Badge count         | static | Solo render condicional.                               |
| Botón "Pendiente"   | static | `disabled aria-disabled title=...`. NO interactivo.    |
| `changeRole` / etc. | server | Helper extra `requireAcceptedTarget` antes del UPDATE. |
| Status indicator    | static | Tres ramas en lugar de dos.                            |

Nada nuevo necesita `'use client'`.

## 11. Estados

### Loading

- `loading.tsx` actual no necesita cambios (skeleton genérico).

### Empty

- Tab `pending` con `pendingCount === 0`:
  `<UserDirectoryEmptyState reason="no_matches">` ya cubre este caso
  (filtro sin resultados). El copy "No encontramos usuarios con los
  filtros aplicados" es razonable. **NIT documentado: un copy
  específico tipo "No hay invitaciones pendientes" sería más amable.
  Deuda futura.**
- Tab `pending` con `pendingCount > 0` pero query `q` que no matchea:
  mismo empty state `no_matches`.

### Error

- Sin cambios. `error.tsx` existente cubre el caso.
- Si `requireAcceptedTarget` falla por error de DB, devuelve
  `{ code: 'server', message: 'No se pudo validar el estado del usuario.' }`.
  El dialog del `ChangeRoleConfirmDialog` ya pinta `error.message` sin
  cambios.

## 12. A11y — checklist concreto

- `Avatar status="away"` ya tiene `aria-label="Estado: away"` por
  default. NO es informativo — agregar wrapper en `UserDirectoryRow`
  o redefinir `aria-label` no es necesario porque el `UserStatusIndicator`
  al lado dice el texto en español. Documentado como deuda menor: el
  `aria-label` literal "Estado: away" se podría traducir, pero requeriría
  cambios al primitivo `Avatar` que están fuera de scope.
- Botón "Pendiente": `aria-disabled="true"` + `title` (idéntico al
  patrón ya validado para el caller).
- Tab "Invitaciones" con badge: el `aria-label="Invitaciones (N
pendientes)"` en el Link cubre el caso del screen reader.
- Contraste: `text-warning` sobre `bg-surface` (background blanco) tiene
  AA aprobado según `docs/design-system.md` (warning ya validado en
  `Badge variant="warning"`).

## 13. Puntos de confirmación humana antes de implementar

1. **Numeración de la migración**: confirma `0023`. Última aplicada en
   `supabase/migrations/`: `0022_properties_sync_sold_at_search_path.sql`.
2. **Ubicación de la tab**: confirma "al final" (después de Admins).
   Alternativas consideradas en §15.
3. **Rename del searchParam `role` → `tab`**: confirma que es OK romper
   bookmarks externos (improbable). Si NO está OK, propuesta de
   fallback: mantener `role` como alias en parseo y `?tab=` como nuevo
   canónico; el implementer agrega `parseDirectoryTabParam(sp.tab ?? sp.role)`.
4. **Botón disabled "Pendiente"**: confirma el texto literal. Alternativa
   "Invitación pendiente" es más explícito pero ocupa más ancho.
5. **No-highlight de fila pending**: confirma que el indicador visual
   (icono mail_outline + Avatar away + botón disabled) es suficiente
   sin pintar background. Si quieren bg, propuesta: `bg-warning-soft/40`
   (warning con alpha muy bajo) — agregar token nuevo a globals.css.

## 14. Riesgos

- **R1 — Race: invite + confirm en la misma transacción**. Teóricamente
  Supabase podría enviar el callback de confirm tan rápido que el INSERT
  en `auth.users` aún no haya disparado `handle_new_user`. En la
  práctica el trigger es síncrono al INSERT y el confirm vine como UPDATE
  posterior. Aceptable.

- **R2 — Trigger `on_auth_user_confirmed` no aplica si el row de
  profile no existe**. Caso: por algún motivo el trigger `handle_new_user`
  falló y no creó el profile, luego el user confirma. El UPDATE
  `where id = NEW.id AND invitation_status = 'pending'` no hace nada
  (0 rows). NO se rompe; queda como inconsistencia que se debería
  detectar via monitoring (out of scope MVP).

- **R3 — Backfill mismatch**: si en el momento de aplicar la migración
  hay un user invitado pero todavía no confirmado, el backfill lo
  marcará incorrectamente como `'accepted'`. Mitigación: el humano
  ejecuta el smoke test ANTES de invitar a un usuario nuevo, o accepta
  que el primer pending real sea el del smoke test (caso descripto en
  §16). Riesgo aceptado.

- **R4 — `auth.users.email_confirmed_at` puede ser NULL para users
  que NO vinieron por invite** (escenarios obscuros: usuarios creados
  via Admin API sin auto-confirm). `handle_new_user` los marca como
  `'accepted'` porque `invited_at IS NULL`. Es el comportamiento
  esperado: solo pending si vino explícitamente por invite.

## 15. Alternativas consideradas (obligatorio por `requires_approval`)

### Modelado del estado

- **Opción A — Columna persistente `invitation_status` + triggers
  (RECOMENDADA, elegida)**. Lectura O(1) en cada query, sin tocar
  service_role. Costo: una columna + dos triggers + una migración.
- **Opción B — Derivar en query desde `auth.users` cada vez**. Cada
  request al directorio joinearía `profiles` con `auth.users` vía
  service_role o RPC. Costo: latencia + complejidad de permisos.
- **Opción C — Solo `is_active=false` desde el insert de invite +
  flip a true al confirmar**. Reusa la columna existente. Costo:
  pierde la distinción semántica "pending vs suspended"; un suspendido
  manual sería indistinguible de un invitado.

**Recomendación**: Opción A. Persistencia explícita + zero-cost en read.

### Ubicación de la tab nueva

- **Opción A — Al final, después de Admins (RECOMENDADA, elegida)**.
- **Opción B — Después de "Todos"**. Pro: visibilidad. Contra: las
  invitaciones son transitorias y meterlas entre las tabs permanentes
  cambia el "mapa mental" del admin cada vez que hay nuevos pending.
- **Opción C — Al principio antes de "Todos"**. Pro: máxima visibilidad
  del badge. Contra: tabs por rol son el flujo principal; ponerlas
  segundas las degrada.

**Recomendación**: Opción A. La tab es excepción → al margen.

### Helper `requireAcceptedTarget`

- **Opción A — Helper centralizado, mismo patrón que `requireAdminCaller`
  (RECOMENDADA, elegida)**.
- **Opción B — Check inline en cada action**. Más código duplicado;
  más fácil olvidar uno cuando se agregue una action nueva.

**Recomendación**: Opción A.

### Background highlight de la fila pending

- **Opción A — Sin background; usar mail_outline + Avatar away + botón
  disabled (RECOMENDADA, elegida)**.
- **Opción B — `bg-warning-soft/40` o similar**. Más impacto visual.
  Riesgo: choque con el `bg-surface-soft` del caller (mismas
  proporciones de saturación). Si el admin se invita a sí mismo a otro
  rol (caso imposible con la UI actual pero teórico), las dos clases
  competirían.

**Recomendación**: Opción A.

## 16. Smoke test manual (humano lo ejecuta tras implementer)

Pre-requisitos:

- `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (ya seteado para
  `admin_user_directory`).
- 2 cuentas: una admin real, una invitada (email yopmail descartable).
- App corriendo con `pnpm dev`.

Pasos:

1. Login con cuenta admin → ir a `/admin/users`.
2. Verificar que la nueva tab "Invitaciones" aparece al final, sin badge
   (asumiendo 0 pending al inicio).
3. Click en "Invitar usuario" → invitar a `pending-test-<timestamp>@yopmail.com`
   con rol "Agente". Submit.
4. **Asserción A**: ver toast "Invitación enviada a ..." y la página
   revalida.
5. **Asserción B**: clickear la tab "Invitaciones" → debe aparecer el
   nuevo usuario con badge "Invitado pendiente", icon mail_outline color
   warning, Avatar con dot warning, botón "Pendiente" disabled.
6. **Asserción C**: tab "Todos" — el nuevo user NO aparece (porque
   pending se excluye de Todos según §3.2).
7. **Asserción D**: tab "Agentes" — el nuevo user NO aparece (mismo
   motivo).
8. **Asserción E**: badge en tab "Invitaciones" muestra `1`.
9. **Asserción F**: intentar abrir el `ChangeRoleMenu` en la fila pending
   — el botón está disabled, no abre dropdown. Hover muestra el tooltip
   "El usuario todavía no aceptó la invitación".
10. **Asserción G (server-side)**: en un navegador privado, login con un
    segundo admin (si existe) e intentar atacar la action `changeRole`
    via DevTools network — debe responder `{ ok: false, error: { code:
'invalid', message: 'El usuario invitado todavía no aceptó la
invitación.' } }`. Si no hay segundo admin, este test queda como
    deuda menor.
11. Abrir yopmail.com con el email invitado → click en el link de
    confirmación → completar password.
12. Volver al admin browser → F5 en `/admin/users`.
13. **Asserción H**: tab "Invitaciones" — el user desapareció (count
    badge desaparece).
14. **Asserción I**: tab "Agentes" — el user aparece con status "Activo"
    (icon check_circle color primary, Avatar online).
15. **Asserción J**: el botón "Cambiar rol" del user ahora SÍ está
    activo y funciona normalmente.

Si todos pasan: feature lista para mergear.

## 17. Resumen de archivos a crear/modificar

### Crear

- `supabase/migrations/0023_profiles_invitation_status.sql`

### Modificar

- `src/types/database.ts` (regenerado via MCP)
- `src/components/admin/UserStatusIndicator.tsx`
- `src/components/admin/UserDirectoryRow.tsx`
- `src/components/admin/UserDirectoryTabs.tsx`
- `src/app/(admin)/admin/users/page.tsx`
- `src/lib/admin/queries.ts`
- `src/lib/admin/actions.ts`

### NO modificar

- `src/lib/admin/schemas.ts`
- `src/components/admin/ChangeRoleMenu.tsx`
- `src/components/admin/ChangeRoleConfirmDialog.tsx`
- `src/components/admin/InviteUserButton.tsx`
- `src/components/admin/InviteUserDialog.tsx`
- `src/components/admin/UserRoleBadge.tsx`
- `src/components/admin/UserDirectorySearch.tsx`
- `src/components/admin/UserDirectoryEmptyState.tsx`
- `src/lib/supabase/admin.ts`
- Migraciones 0001-0022
- `CLAUDE.md`, `AGENTS.md`, `.claude/`

## 18. Criterios de aceptación verificables (gate de reviewer)

- [ ] Migración `0023_profiles_invitation_status.sql` aplicada via MCP.
- [ ] `select count(*) from public.profiles where invitation_status is null` → 0.
- [ ] Enum `invitation_status_t` existe con valores `pending`/`accepted`.
- [ ] `handle_new_user` (replace) usa `invited_at` + `email_confirmed_at`
      para decidir el estado inicial.
- [ ] Trigger `on_auth_user_confirmed` en `auth.users` flippea a
      `'accepted'` en la transición NULL → NOT NULL.
- [ ] `src/types/database.ts` regenerado incluye `invitation_status_t`.
- [ ] `UserStatusIndicator` acepta prop `status: 'pending' | 'active' |
    'inactive'` y NO `isActive` (build falla con la firma vieja en
      otros call sites — verificable con grep).
- [ ] Tab "Invitaciones" aparece como 5ta, al final.
- [ ] SearchParam canónico es `?tab=`, no `?role=`.
- [ ] Tab "Invitaciones" tiene badge `Badge variant="warning"` cuando
      `count > 0`, sin badge cuando 0.
- [ ] Tabs `all|user|agent|admin` filtran `invitation_status='accepted'`
      (los pending no contaminan contadores).
- [ ] Tab `pending` filtra `invitation_status='pending'`.
- [ ] Botón "Pendiente" en la fila pending es disabled, con title del
      tooltip y `aria-disabled="true"`.
- [ ] Helper `requireAcceptedTarget` existe en `actions.ts` y se invoca
      desde `changeRole`, `suspendUser`, `reactivateUser` (NO desde
      `inviteUser`).
- [ ] Atacando `changeRole` con target pending vía Server Action devuelve
      `{ ok: false, error: { code: 'invalid', message: 'El usuario
    invitado todavía no aceptó la invitación.' } }`.
- [ ] Smoke test §16: asserciones A→J pasan.
- [ ] `init.sh full` pasa (lint + type-check + build).
- [ ] Cero hex literales en JSX (grep limpio).
- [ ] `get_advisors` post-migración no reporta warnings críticos nuevos.
