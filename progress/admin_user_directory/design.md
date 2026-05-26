# Design spec — admin_user_directory

> Status: `requires_approval = true` — este spec pasó la puerta de
> aprobación humana el 2026-05-26. Las cuestiones abiertas C1-C4 + R2
> están resueltas. Listo para el implementer.

## 0. Decisiones tomadas — 2026-05-26 (resumen)

Cierre de las cuestiones abiertas planteadas en la versión previa:

- **C1 (Add User)**: SE IMPLEMENTA. Flow completo de invitación via
  `supabase.auth.admin.inviteUserByEmail`. Detalle en §8b.
- **C2 (Tabs)**: tabs finales = `Todos / Usuarios / Agentes / Admins`
  (4 tabs, sin "Brokers"). Decisión simplificada: el rol `broker` queda
  fuera de la UI para el MVP del directorio. El enum SQL sigue
  soportándolo pero el dropdown de invitación y los tabs solo manejan
  `user / agent / admin`. Detalle en §5.
- **C3 (Highlight fila del caller)**: SE IMPLEMENTA con token
  `bg-surface-soft` (= hint-green, ya documentado en design-system).
  Botón "Cambiar rol" deshabilitado con `aria-disabled` + tooltip.
  Detalle en §4 y §10.
- **C4 (`sales_ytd` con `updated_at`)**: SE RESUELVE con columna nueva
  `properties.sold_at` + trigger + backfill. Migración
  `0021_properties_sold_at.sql`. Detalle en §6 y §9.
- **R2 (Sesión activa al suspender)**: SE REVOCA. El server action
  llama `supabase.auth.admin.signOut(targetUserId, 'global')` con
  cliente service_role tras `is_active=false`. Detalle en §8.

Las decisiones sobre cliente service_role y nuevas variables de entorno
están en §17 ("Cliente admin con service_role") y §18 ("Decisiones
arquitectónicas a registrar").

## 1. Resumen + ruta

Página **`/admin/users`** que solo el rol `admin` puede ver. Lista los
usuarios (`profiles`) de la plataforma con búsqueda, filtro de rol,
indicadores de actividad, contadores de performance (properties + sales
YTD), un dropdown "Cambiar rol" para mutar `profiles.role` o suspender
(`is_active=false`), y un botón "Invitar usuario" que dispara el flow
de Supabase Admin Invites.

- **Segmento físico**: `src/app/(admin)/users/page.tsx`. El segmento
  `(admin)` es route group (no aporta URL) y ya existe con su layout
  guard. La carpeta `users/` se crea ahora.
- **`protectedPaths` (middleware)**: el prefijo `/admin` **ya está**
  en `src/lib/supabase/proxy.ts` (línea 60). No requiere modificación
  para esta feature. El implementer NO necesita tocar el proxy.
- **TopNav**: el layout `(admin)/layout.tsx` ya monta `<TopNav
variant="admin" session={session} />`. No tocar nav.

## 2. Guard estricto

### Capa middleware (ya existe)

`src/lib/supabase/proxy.ts` redirige a `/login?next=/admin/users` si
`!user`. No tocamos.

### Capa layout (ya existe)

`src/app/(admin)/layout.tsx`:

```ts
if (!session?.user) redirect('/login?next=/admin');
const role = session.profile?.role ?? 'user';
if (role !== 'admin') notFound();
```

El layout devuelve **`notFound()`** (404) y NO redirect a `/` para los
roles no-admin. Justificación:

- **No anunciar rutas administrativas.** Un user/agent que tipea
  `/admin/users` debe ver el mismo "404" que vería en cualquier ruta
  inexistente. Un `redirect('/')` filtraría la existencia de la sección.
- **Consistencia con detalles privados** (`property_details_screen`).
- **Defensa en profundidad** — la layout-guard se replica en la página.

### Capa page (NUEVA — agregar en esta feature)

`src/app/(admin)/users/page.tsx`:

```ts
const session = await getSessionAndProfile();
if (!session?.user) notFound();
if (session.profile?.role !== 'admin') notFound();
```

### Capa Server Action

Ver §8. Las actions `changeRole`, `suspendUser`, `inviteUser`
reverifican `is_admin()` server-side.

### Capa RLS

Última línea. `profiles_update_own_or_admin` permite UPDATE solo si
`is_admin()`. Ver §9.

## 3. Estructura de la página

```
src/app/(admin)/users/
├── page.tsx                    # Server Component — fetch + render
├── loading.tsx                 # Skeleton de la tabla
└── error.tsx                   # Boundary de errores

src/components/admin/
├── index.ts                    # barrel
├── UserDirectorySearch.tsx     # Client — search input con submit
├── UserDirectoryTabs.tsx       # Server — tabs "Todos / Usuarios / Agentes / Admins"
├── UserDirectoryRow.tsx        # Server — fila/card de un user
├── UserStatusIndicator.tsx     # Server — dot verde/gris (MVP)
├── UserRoleBadge.tsx           # Server — badge del rol actual
├── ChangeRoleMenu.tsx          # Client — dropdown del botón "Cambiar rol"
├── ChangeRoleConfirmDialog.tsx # Client — confirm modal antes de aplicar
├── InviteUserButton.tsx        # Client — trigger del modal de invitación
├── InviteUserDialog.tsx        # Client — modal con form (email + rol inicial)
└── UserDirectoryEmptyState.tsx # Server — empty/filtros sin resultados

src/lib/admin/
├── queries.ts                  # listAdminUsers, getUserCounts
├── actions.ts                  # changeRole, suspendUser, reactivateUser, inviteUser
├── schemas.ts                  # zod schemas
└── format.ts                   # formatSalesShort

src/lib/supabase/
└── admin.ts                    # cliente service_role (server-only) — NUEVO
```

### Reparto Server vs Client

| Archivo                       | Tipo   | Por qué                                                                                             |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `page.tsx`                    | Server | Fetch directo con Supabase server client, sin estado.                                               |
| `UserDirectorySearch.tsx`     | Client | `useRouter` para empujar `?q=` al URL on submit.                                                    |
| `UserDirectoryTabs.tsx`       | Server | Solo renderiza `<Link>` con `?role=`. Estado activo se deriva del searchParam que la página recibe. |
| `UserDirectoryRow.tsx`        | Server | Renderiza datos del user; los hijos interactivos son Client.                                        |
| `UserStatusIndicator.tsx`     | Server | Static.                                                                                             |
| `UserRoleBadge.tsx`           | Server | Static.                                                                                             |
| `ChangeRoleMenu.tsx`          | Client | Dropdown con estado open/closed + focus trap + Escape + click-outside.                              |
| `ChangeRoleConfirmDialog.tsx` | Client | `useTransition` + modal con focus trap.                                                             |
| `InviteUserButton.tsx`        | Client | Abre el dialog (estado local).                                                                      |
| `InviteUserDialog.tsx`        | Client | Form controlado (input email + select rol) + `useTransition`.                                       |
| `UserDirectoryEmptyState.tsx` | Server | Static + `<Link>` para limpiar filtros.                                                             |
| `loading.tsx`                 | Server | Skeleton CSS.                                                                                       |
| `error.tsx`                   | Client | Next obliga `'use client'` para el boundary.                                                        |

## 4. Layout responsive

Mobile-first. Container padded `px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto`
y `py-6 md:py-10`, mismo patrón que el dashboard.

### Estructura semántica

```html
<main>
  <header>
    <!-- Header section -->
    <div>
      <h1>Directorio de usuarios</h1>
      <p>Gestiona el acceso y los roles de la plataforma.</p>
    </div>
    <div>
      <InviteUserButton />
      <!-- desktop: junto al título -->
      <div role="search">
        <UserDirectorySearch />
      </div>
    </div>
  </header>

  <nav aria-label="Filtrar por rol">
    <UserDirectoryTabs />
    <!-- Todos / Usuarios / Agentes / Admins -->
  </nav>

  <section aria-label="Listado de usuarios">
    <div role="region" aria-live="polite">
      <ul role="list">
        <!-- mobile: cards stacked -->
        <UserDirectoryRow />
        x N
        <!-- md+: filas tipo tabla -->
      </ul>
      <footer>
        <DashboardPagination />
        <!-- reutilizado del dashboard -->
      </footer>
    </div>
  </section>
</main>
```

### Header section

- **Mobile (`<md`)**: título + sublabel arriba; debajo, en una fila
  horizontal, `<InviteUserButton variant="primary" size="md">` y
  `<UserDirectorySearch>` (search ocupa el espacio restante,
  `flex-1`). En `<sm` muy ajustado se permite que el botón quede
  full-width arriba del search (`flex-col sm:flex-row`).
- **`md+`**: dos columnas: izquierda título + sublabel; derecha
  `<InviteUserButton>` + search en horizontal,
  `flex items-center justify-between gap-4`. Search con `w-full md:w-80`.

### Tabs ("Todos / Usuarios / Agentes / Admins")

4 tabs finales (decisión C2). Layout: `flex gap-6 border-b border-divider
overflow-x-auto`. Cada tab es `<Link>` que preserva `?q=` pero resetea
`?page=1`.

- "Todos" → `?role=all` (default, también si el param se omite).
- "Usuarios" → `?role=user`.
- "Agentes" → `?role=agent`.
- "Admins" → `?role=admin`.

Estado activo del tab: `pb-3 text-sm font-semibold text-primary
border-b-2 border-primary`. Inactivo: `pb-3 text-sm font-medium
text-muted hover:text-on-surface transition-colors`.

### Tabla (md+) / Cards stacked (<md)

Container: `bg-surface rounded-xl border border-divider shadow-card
overflow-hidden`.

#### md+ — grid 12-col

Header row decorativo:
`hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-neutral-50 border-b
border-divider-soft text-xs font-semibold text-muted uppercase
tracking-wider`.

Columnas:

- `col-span-5` — **DATOS DEL USUARIO** (avatar + nombre + email + ID).
- `col-span-3` — **ROL Y ESTADO** (badge de rol + status indicator
  texto).
- `col-span-2` — **DESEMPEÑO** (properties count + sales YTD).
- `col-span-2 text-right` — **ACCIONES** (botón "Cambiar rol").

Fila default:
`group grid grid-cols-12 gap-4 px-6 py-5 border-b border-divider-soft
last:border-b-0 hover:bg-surface-hover transition-colors items-center`.

**Fila del caller (highlight, decisión C3)**: cuando `row.id === callerId`,
agregar `bg-surface-soft` (hint-green del design-system) a la fila. La
clase total queda: `group grid grid-cols-12 gap-4 px-6 py-5
border-b border-divider-soft last:border-b-0 transition-colors items-center
bg-surface-soft` (sin hover override; el highlight es el indicador
permanente). El contraste de `text-on-surface` sobre `bg-surface-soft`
(hint-green) ya está validado en `docs/design-system.md` (mismo par usado
en headers de profile).

#### <md — cards stacked

- Cada fila card vertical: `flex flex-col gap-3 p-4 border-b
border-divider-soft last:border-b-0`.
- Row 1: avatar `lg` (48px) + nombre/email/ID en columna a la derecha.
- Row 2: chips horizontales con [badge rol] + [status indicator].
- Row 3: dos pares label/valor para performance.
- Row 4: botón "Cambiar rol" full-width (o "No editable" disabled si
  es la fila del caller).
- Para la card del caller: mismo `bg-surface-soft` aplicado a la card.

### Tokens exactos

| Elemento                  | Tokens                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Fondo de página           | `bg-background` (heredado del body)                                                                          |
| Título h1                 | `text-3xl font-bold text-on-surface tracking-tight`                                                          |
| Sublabel header           | `text-sm text-muted mt-1`                                                                                    |
| Search input              | `bg-surface rounded-lg border border-divider shadow-soft placeholder-muted` (reutilizar primitivo `<Input>`) |
| Container tabla           | `bg-surface rounded-xl border border-divider shadow-card overflow-hidden`                                    |
| Tabla header (col labels) | `bg-neutral-50 text-xs font-semibold text-muted uppercase tracking-wider`                                    |
| Fila hover                | `hover:bg-surface-hover`                                                                                     |
| Fila del caller           | `bg-surface-soft` (hint-green; sin hover override)                                                           |
| Border row                | `border-b border-divider-soft`                                                                               |
| Footer paginación         | `bg-neutral-50 border-t border-divider-soft`                                                                 |
| Avatar status dot online  | `bg-success ring-2 ring-surface`                                                                             |
| Avatar status dot offline | `bg-neutral-400 ring-2 ring-surface`                                                                         |
| Badge rol Admin           | `Badge variant="inverse"` → `bg-surface-inverse text-on-surface-inverse`                                     |
| Badge rol Agent           | `Badge variant="success"` → `bg-surface-soft text-primary`                                                   |
| Badge rol User            | `Badge variant="neutral"` → `bg-neutral-100 text-muted`                                                      |
| Botón "Cambiar rol"       | `Button variant="secondary" size="sm"` con `trailingIcon="expand_more"`                                      |
| Botón "Invitar usuario"   | `Button variant="primary" size="md"` con `leadingIcon="person_add"`                                          |
| Dropdown abierto          | `bg-primary text-on-primary rounded-lg shadow-dropdown`                                                      |
| Empty state               | `bg-neutral-50 text-muted` con icono `group` o `person_search`                                               |

## 5. Search + filtro + paginación

### Contract de searchParams

```ts
type SearchParams = Promise<{
  q?: string; // free text
  role?: 'all' | 'user' | 'agent' | 'admin';
  page?: string; // 1-based
}>;
```

- `q` por defecto vacío. Trim + `ilike '%q%'` sobre `full_name` y `email`.
- `role` por defecto `'all'`. Filtro server-side via `.eq('role', role)`
  sobre `profiles`. Si el param viene con un valor fuera del set
  permitido (incluido `'broker'` que la UI no expone), se trata como
  `'all'`.
- `page` por defecto `1`. PageSize fijo en `PAGE_SIZE = 20`.

**Nota sobre `broker`**: el enum SQL `user_role` sigue incluyendo
`broker` (mig 0001). La UI del directorio decide no exponer ese rol en
tabs ni en el dropdown de invite/change-role. Si en la DB existe algún
profile con `role='broker'`, aparecerá únicamente bajo "Todos" y el
badge se renderiza con un fallback neutral (label "Broker", variant
`neutral`). No se rompe nada.

### Query (`src/lib/admin/queries.ts`)

```ts
export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'agent' | 'broker' | 'admin';
  is_active: boolean;
  created_at: string;
  properties_count: number | null; // null cuando role === 'user'
  sales_ytd: number | null; // null cuando role === 'user'
}

export interface ListAdminUsersOptions {
  q: string;
  role: 'all' | 'user' | 'agent' | 'admin';
  page: number;
  pageSize: number;
}

export interface ListAdminUsersResult {
  items: AdminUserRow[];
  total: number;
}

export async function listAdminUsers(
  supabase: SupabaseServerClient,
  opts: ListAdminUsersOptions,
): Promise<ListAdminUsersResult>;
```

### Implementación

**Una query principal a `profiles` con `count: 'exact'`, seguida de DOS
queries agregadas a `properties`** para enriquecer performance columns.
Por qué no joins: Supabase JS no expone `lateral`/`sum() group by` con
tipos lindos; una query agregada de máximo 20 ownerIds es barata.

```ts
// Paso 1: query principal con count.
let q = supabase
  .from('profiles')
  .select('id, email, full_name, avatar_url, role, is_active, created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range((page - 1) * pageSize, page * pageSize - 1);

if (role !== 'all') q = q.eq('role', role);
if (term !== '') q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

// Paso 2: enriquecer performance.
const ownerIds = profiles.filter((p) => p.role !== 'user').map((p) => p.id);

if (ownerIds.length > 0) {
  // 2a: count de properties por owner (excluye archivadas).
  const { data: counts } = await supabase
    .from('properties')
    .select('owner_id, id')
    .in('owner_id', ownerIds)
    .neq('listing_status', 'archived');

  // 2b: sum de price de properties vendidas en el año actual.
  //     USA properties.sold_at (nueva columna — mig 0021). Decisión C4.
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
  const { data: sales } = await supabase
    .from('properties')
    .select('owner_id, price')
    .in('owner_id', ownerIds)
    .eq('listing_status', 'sold')
    .gte('sold_at', yearStart);
  // Agregamos en JS: Map<ownerId, { count, salesYtd }>.
}
```

### Decisiones de la query

- **D1 — Orden default `created_at desc`**: muestra primero los usuarios
  más recientes.
- **D2 — properties_count NO incluye archivadas**: refleja "portafolio
  activo". Users → `null` (UI pinta `—`).
- **D3 — sales_ytd usa `properties.sold_at`** (decisión C4): columna
  nueva con backfill desde `updated_at` para registros legacy. Fuente
  de verdad para reporting. Detalle de la migración en §9.
- **D4 — `count: 'exact'`** para el paginador.
- **D5 — `ilike` case-insensitive nativo**.
- **D6 — Sanitización del query `q`**: escapar `%`, `_`, `\` antes de
  pasar a `ilike`. Helper en `src/lib/admin/queries.ts`:
  ```ts
  function escapeIlike(s: string): string {
    return s.replace(/[\\%_]/g, '\\$&');
  }
  ```

### Paginación

- PageSize = **20**.
- Reutilizar `<DashboardPagination>` de `src/components/dashboard/` con
  `baseHref="/admin/users"`.
- No personalizar copy ("resultados" es genérico y aceptable).

## 6. Columnas Performance

### `properties_count` por owner

- **role=user** → `null` (UI muestra `—`).
- **role=agent|broker|admin** → count de `properties` con
  `owner_id = profile.id` AND `listing_status != 'archived'`.

UI:

```tsx
<div className="text-[10px] uppercase tracking-wider text-muted">Propiedades</div>
<div className="text-sm font-semibold text-on-surface">
  {row.properties_count ?? '—'}
</div>
```

### `sales_ytd`

- **role=user** → `null` (`—`).
- **role=agent|broker|admin** → SUM(`price`) de properties con
  `listing_status='sold'` AND `sold_at >= date_trunc('year', now())`.

Formato (helper `formatSalesShort` en `src/lib/admin/format.ts`):

```ts
export function formatSalesShort(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${m.toFixed(m % 1 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${amount.toLocaleString('es-MX')}`;
}
```

UI:

```tsx
<div className="text-[10px] uppercase tracking-wider text-muted">Ventas (año)</div>
<div className="text-sm font-semibold text-on-surface">
  {row.sales_ytd != null ? formatSalesShort(row.sales_ytd) : '—'}
</div>
```

### Casos edge del mockup (NO se replican)

El mockup muestra "Access Level: Level 5" y "Last Login: 2mo ago" en
filas específicas. Esta spec NO los implementa (Access Level no existe
en el modelo; Last Login requiere query a `auth.users.last_sign_in_at`
con service_role). Todas las filas no-user muestran
`Propiedades + Ventas (año)`. Consistencia > fidelidad literal al
mockup. Riesgo aceptado, ver §13 R1.

## 7. Status indicator

MVP simple:

| `is_active` | Dot color        | Texto al lado | Icon          |
| ----------- | ---------------- | ------------- | ------------- |
| `true`      | `bg-success`     | "Activo"      | check_circle  |
| `false`     | `bg-neutral-400` | "Inactivo"    | remove_circle |

NO "Away" / "Online tracking" real en MVP (requiere
`auth.users.last_sign_in_at` con service_role). Documentado como deuda.

Componente `UserStatusIndicator.tsx`:

```tsx
interface Props {
  isActive: boolean;
}
```

Avatar status dot: `status="online"` cuando `is_active=true`, `status="offline"` cuando `false`.

## 8. Server Actions `changeRole` / `suspendUser` / `reactivateUser`

### Ubicación

`src/lib/admin/actions.ts`.

### Schemas (`src/lib/admin/schemas.ts`)

```ts
import { z } from 'zod';

// Roles que la UI puede setear desde el directorio (excluye 'broker').
export const assignableRoleSchema = z.enum(['user', 'agent', 'admin']);

export const changeRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  nextRole: assignableRoleSchema,
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const suspendUserSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const reactivateUserSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type ReactivateUserInput = z.infer<typeof reactivateUserSchema>;
```

Decisión: **separar `suspendUser` / `reactivateUser` de `changeRole`**.
Razón: `suspendUser` tiene side-effect adicional (revocar sesión via
admin client). Mantenerlos separados deja la lógica de cada action
focalizada y el blast radius del service_role acotado.

### Action `changeRole`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { changeRoleSchema, type ChangeRoleInput } from './schemas';

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code:
          | 'unauthenticated'
          | 'forbidden'
          | 'invalid'
          | 'not_found'
          | 'self_target'
          | 'no_op'
          | 'server';
        message: string;
      };
    };

export async function changeRole(input: ChangeRoleInput): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'invalid', message: 'Datos inválidos.' } };

  const supabase = await createClient();

  // 1) auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: { code: 'unauthenticated', message: 'Sesión expirada.' } };

  // 2) admin check (defensa en profundidad — RLS también bloquea)
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (caller?.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'No autorizado.' } };
  }

  // 3) self-protection
  if (parsed.data.targetUserId === user.id) {
    return {
      ok: false,
      error: { code: 'self_target', message: 'No puedes cambiar tu propio rol.' },
    };
  }

  // 4) target existe
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', parsed.data.targetUserId)
    .maybeSingle();
  if (!target)
    return { ok: false, error: { code: 'not_found', message: 'Usuario no encontrado.' } };

  // 5) no-op
  if (target.role === parsed.data.nextRole) {
    return { ok: false, error: { code: 'no_op', message: 'El usuario ya tiene ese rol.' } };
  }

  // 6) UPDATE
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.nextRole })
    .eq('id', parsed.data.targetUserId);
  if (error) return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };

  // 7) Notification se inserta vía trigger DB (mig 0020).
  revalidatePath('/admin/users');
  return { ok: true };
}
```

### Action `suspendUser` (R2 — revoca sesión)

```ts
'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
// ... boilerplate auth+admin check idéntico a changeRole

export async function suspendUser(input: SuspendUserInput): Promise<ActionResult> {
  // ... parse + auth + admin check + self_target + not_found + no_op
  //     (no_op si target.is_active === false ya)

  // UPDATE is_active = false
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', target.id);
  if (updErr) return { ok: false, error: { code: 'server', message: 'No se pudo suspender.' } };

  // R2: revocar todas las sesiones activas del target via admin API.
  // Usar SIEMPRE service_role (la admin API no acepta el JWT del caller).
  const admin = createAdminClient();
  const { error: signOutErr } = await admin.auth.admin.signOut(target.id, 'global');
  // Si signOut falla, NO revertimos el suspend: el suspend lógico ya está aplicado,
  // y la sesión activa expirará dentro de ~1h. Logueamos el error pero retornamos ok.
  // (El advisor SQL no lo detecta; el implementer debe loguear con console.error en
  // el server, que en Vercel queda en logs.)
  if (signOutErr) console.error('[suspendUser] signOut admin falló:', signOutErr);

  revalidatePath('/admin/users');
  return { ok: true };
}
```

### Action `reactivateUser`

Análoga a `suspendUser` pero `is_active=true` y sin llamar a `signOut`.

### Action `inviteUser` (C1)

Ver §8b detallado debajo.

### Copy del confirm dialog (suspend)

Decisión R2: el copy ahora dice **"Se cerrará su sesión inmediatamente"**
(reemplaza el viejo "Su sesión actual seguirá válida hasta expirar").

## 8b. Server Action `inviteUser` (decisión C1)

### Flow funcional

1. Admin abre dialog "Invitar usuario", completa:
   - `email` (input)
   - `initialRole` (select: Usuario / Agente / Administrador)
2. Submit → `inviteUser({ email, initialRole })` server action.
3. Action valida, hace admin check, llama
   `supabase.auth.admin.inviteUserByEmail(email, { data: { initial_role: initialRole } })`.
4. Supabase manda email al user con magic link. El user completa
   contraseña en el flow de Supabase (URL de redirect ya configurada).
5. Cuando el user acepta y `auth.users` recibe el INSERT, el trigger
   `handle_new_user` (mig 0002) crea el profile con `role='user'`
   (default). **Esto NO respeta el rol del invite** — verificado en
   mig 0002 líneas 67-83: el trigger ignora cualquier `raw_user_meta_data`
   relacionado con role.
6. Por eso, **tras llamar `inviteUserByEmail`, la action `inviteUser`
   debe hacer un UPDATE inmediato del profile** para fijar el rol
   inicial deseado. Hay dos momentos posibles:
   - **Opción elegida (A): UPDATE inmediato post-invite, dentro de la
     misma action**. El invite crea la fila `auth.users` (con
     `email_confirmed_at = null`), y el trigger `handle_new_user`
     dispara y crea el profile. La action espera el resultado de
     `inviteUserByEmail` (que devuelve el `user.id`), y a continuación
     hace `update profiles set role = $nextRole where id = $userId`.
     Esto se hace con el cliente service_role para evitar que la RLS
     `profiles_update_own_or_admin` deniegue por estar fuera de un
     contexto auth normal.
   - Opción B (descartada): otro trigger DB sobre `auth.users` AFTER
     INSERT que lee `raw_user_meta_data->>'initial_role'`. Funciona
     pero agrega lógica de roles en SQL que es difícil de auditar.
     Mantenemos la decisión en TS.

### Schema (`src/lib/admin/schemas.ts`)

```ts
export const inviteUserSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  initialRole: assignableRoleSchema, // 'user' | 'agent' | 'admin'
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
```

### Action signature

```ts
export type InviteUserResult =
  | { ok: true; email: string }
  | {
      ok: false;
      error: {
        code:
          | 'unauthenticated'
          | 'forbidden'
          | 'invalid'
          | 'already_invited' // email tiene invite pendiente
          | 'already_exists' // email ya es user activo
          | 'rate_limited' // Supabase rate limit
          | 'server';
        message: string;
      };
    };

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult>;
```

### Implementación (pseudocódigo)

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteUserSchema, type InviteUserInput } from './schemas';

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'invalid', message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
    };
  }

  // 1) Auth del caller (con cliente normal).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: { code: 'unauthenticated', message: 'Sesión expirada.' } };

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (caller?.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'No autorizado.' } };
  }

  // 2) Invite con cliente admin (service_role). Self-protection no aplica:
  //    el admin invita a un email distinto al suyo, y aunque coincidiera,
  //    Supabase rechaza si el email ya está registrado.
  const admin = createAdminClient();
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { initial_role: parsed.data.initialRole }, // metadata para auditoría
      // redirectTo opcional: deeplink al login después de aceptar.
    },
  );

  if (inviteErr) {
    // Supabase Admin API devuelve diferentes mensajes/códigos. Mapear:
    // - "User already registered" / status 422 + code 'email_exists' → already_exists
    // - "A user with this email address has already been invited" → already_invited
    // - rate limits → 429 → rate_limited
    // El implementer debe inspeccionar inviteErr.code o inviteErr.status y mappear.
    const code =
      inviteErr.code === 'email_exists' || inviteErr.status === 422
        ? 'already_exists'
        : inviteErr.code === 'invite_already_sent'
          ? 'already_invited'
          : inviteErr.status === 429
            ? 'rate_limited'
            : 'server';
    const messageEs =
      code === 'already_exists'
        ? 'Este email ya está registrado como usuario.'
        : code === 'already_invited'
          ? 'Ya hay una invitación pendiente para este email.'
          : code === 'rate_limited'
            ? 'Demasiadas invitaciones recientes. Intenta más tarde.'
            : 'No se pudo enviar la invitación.';
    return { ok: false, error: { code, message: messageEs } };
  }

  const newUserId = inviteData?.user?.id;
  if (!newUserId) {
    return { ok: false, error: { code: 'server', message: 'Respuesta inesperada del servidor.' } };
  }

  // 3) Forzar el rol inicial. El trigger handle_new_user (mig 0002) crea
  //    el profile con role='user' por default, ignorando raw_user_meta_data.
  //    UPDATE con service_role para no depender del JWT del caller.
  if (parsed.data.initialRole !== 'user') {
    const { error: updErr } = await admin
      .from('profiles')
      .update({ role: parsed.data.initialRole })
      .eq('id', newUserId);

    if (updErr) {
      // El invite ya se envió. Logueamos y devolvemos ok parcial: el admin
      // puede ajustar el rol manualmente desde la tabla después de que el
      // user acepte. NO bloqueamos el flow.
      console.error('[inviteUser] no se pudo fijar initial_role:', updErr);
    }
  }

  revalidatePath('/admin/users');
  return { ok: true, email: parsed.data.email };
}
```

### Notas para el implementer sobre la Admin API

- **Verificar la firma exacta de `inviteUserByEmail`** en la versión
  instalada de `@supabase/supabase-js` antes de codear (la API evoluciona).
  Hoy: `inviteUserByEmail(email: string, options?: { data?: object; redirectTo?: string })`.
- El email plantilla viene de la configuración de Supabase Auth
  (Dashboard → Authentication → Email Templates → Invite user). Asumimos
  que ya está configurado en español; si no, el implementer debe pedirlo
  al humano (no es bloqueante para mergear código).
- `redirectTo`: el implementer puede incluir `${SITE_URL}/login?invited=1`
  para deep-link al login. Opcional.

## 9. Migraciones SQL

### Verificación de policies existentes

(Sin cambios respecto a la versión anterior del spec.)

`profiles_select_authenticated` permite SELECT a cualquier authenticated;
`profiles_update_own_or_admin` permite UPDATE a admins. Para
`properties`, `properties_select_public_or_own` incluye `is_admin()`.
**No requiere policies nuevas.**

### Migración 0020 — trigger de notificación (sin cambios)

`supabase/migrations/0020_profiles_notify_role_change.sql`:

Cuando un admin actualiza `profiles.role` o `profiles.is_active` de OTRO
usuario, se inserta una notification al user afectado (patrón mig
0017/0018, SECURITY DEFINER).

```sql
-- 0020_profiles_notify_role_change.sql

create or replace function public.notify_profile_role_or_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_label_es text;
  notif_title text;
  notif_body text;
begin
  if auth.uid() is null or auth.uid() = new.id then
    return new;
  end if;

  if new.role is distinct from old.role then
    role_label_es := case new.role
      when 'user' then 'Usuario'
      when 'agent' then 'Agente'
      when 'broker' then 'Broker'
      when 'admin' then 'Administrador'
      else new.role::text
    end;
    notif_title := 'Tu rol fue actualizado';
    notif_body := 'Un administrador cambió tu rol a ' || role_label_es || '.';

    insert into public.notifications (
      recipient_id, type, title, body, read_at, created_at
    ) values (
      new.id, 'system', notif_title, notif_body, null, now()
    );
  end if;

  if new.is_active is distinct from old.is_active then
    if new.is_active = false then
      notif_title := 'Tu cuenta fue suspendida';
      notif_body := 'Un administrador suspendió tu cuenta. Contacta soporte si tienes preguntas.';
    else
      notif_title := 'Tu cuenta fue reactivada';
      notif_body := 'Un administrador reactivó tu cuenta.';
    end if;

    insert into public.notifications (
      recipient_id, type, title, body, read_at, created_at
    ) values (
      new.id, 'system', notif_title, notif_body, null, now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_notify_role_or_status_change on public.profiles;
create trigger profiles_notify_role_or_status_change
  after update on public.profiles
  for each row execute function public.notify_profile_role_or_status_change();
```

### Migración 0021 — `properties.sold_at` (decisión C4)

`supabase/migrations/0021_properties_sold_at.sql`:

```sql
-- 0021_properties_sold_at.sql
-- Columna autoritativa para la fecha en que una property se vendió.
-- Reemplaza el uso de updated_at como proxy en queries de sales YTD.

alter table public.properties
  add column if not exists sold_at timestamptz;

create index if not exists properties_sold_at_idx
  on public.properties(sold_at)
  where sold_at is not null;

-- Trigger: mantiene sold_at sincronizado con listing_status.
-- - Transición a 'sold'   → sold_at := now()
-- - Transición desde 'sold' a cualquier otro → sold_at := null
-- - Cambios de listing_status que no involucran 'sold' → no toca sold_at
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

-- Backfill: para registros legacy ya marcados sold, usar updated_at como
-- mejor aproximación disponible. Solo se aplica a filas sold sin sold_at.
update public.properties
   set sold_at = updated_at
 where listing_status = 'sold'
   and sold_at is null;
```

**Nota para el implementer**: tras aplicar 0021, agregar al documento
`docs/data-model.md` (solo agregar, no modificar nada existente) un
párrafo: "`properties.sold_at` es la fuente de verdad para reporting
de ventas (sales YTD, dashboards de admin). Mantenida automáticamente
por el trigger `properties_sync_sold_at` al cambiar `listing_status`."

### Orden de aplicación de migraciones

1. `0020_profiles_notify_role_change.sql`
2. `0021_properties_sold_at.sql`

Ambas con `apply_migration` via MCP. Verificar `get_advisors` después
de cada una.

## 10. Componentes UI a reutilizar vs crear

### Reutilizar tal cual

- **`<Avatar>`** — `size="lg"`, `status="online"|"offline"`.
- **`<Badge>`** — variants `inverse` (Admin), `success` (Agent),
  `neutral` (User, Broker fallback).
- **`<Button>`** — `primary` (Invitar usuario, Confirmar),
  `secondary` (Cambiar rol), `danger` (Suspender), `ghost` (Cancelar).
- **`<Input>`** — search box + email del invite dialog.
- **`<Icon>`** — `search`, `expand_more`, `expand_less`, `check_circle`,
  `remove_circle_outline`, `person_search`, `shield`, `support_agent`,
  `person`, `block`, `restart_alt`, `person_add`, `mail_outline`.
- **`<DashboardPagination>`**.

### Componentes nuevos en `src/components/admin/`

#### 1. `UserDirectorySearch.tsx` (Client)

```ts
interface Props {
  initialQuery: string;
}
```

- Form que en submit (Enter o blur) hace
  `router.replace('/admin/users?q=' + encodeURIComponent(value))`.
- Sin debounce automático.
- Botón "limpiar" cuando hay query.

#### 2. `UserDirectoryTabs.tsx` (Server)

```ts
interface Props {
  currentRole: 'all' | 'user' | 'agent' | 'admin';
  currentQuery: string;
}
```

- 4 tabs. Preserva `?q=`; resetea `?page=1`.
- `<nav>` envuelve; cada tab `<Link aria-current="page" ...>` cuando activo.

#### 3. `UserDirectoryRow.tsx` (Server)

```ts
interface Props {
  user: AdminUserRow;
  callerId: string;
}
```

- Si `user.id === callerId`:
  - Aplicar clase `bg-surface-soft` a la fila/card.
  - Reemplazar `<ChangeRoleMenu>` por
    `<Button disabled aria-disabled="true" variant="secondary" size="sm"
title="No puedes cambiar tu propio rol">No editable</Button>`.

#### 4. `UserStatusIndicator.tsx` (Server) — ver §7.

#### 5. `UserRoleBadge.tsx` (Server)

```ts
interface Props {
  role: 'user' | 'agent' | 'broker' | 'admin';
}
```

Labels: "Usuario", "Agente", "Broker" (fallback), "Administrador".

#### 6. `ChangeRoleMenu.tsx` (Client)

```ts
interface Props {
  userId: string;
  currentRole: 'user' | 'agent' | 'broker' | 'admin';
  currentIsActive: boolean;
  userDisplayName: string;
}
```

**Items del menú (UI solo expone roles asignables — sin `broker`)**:

- "Administrador" (icon `shield`)
- "Agente" (icon `support_agent`)
- "Usuario" (icon `person`)
- separador `border-t border-on-primary/10`
- Si `currentIsActive`: "Suspender usuario" (icon `block`,
  `text-warning` sobre `bg-warning-soft/20` al hover)
- Si NO `currentIsActive`: "Reactivar usuario" (icon `restart_alt`,
  `text-success` sobre `bg-success-soft/20` al hover)

El item correspondiente al `currentRole` se muestra con
`bg-on-primary/15 font-medium`. Si `currentRole === 'broker'` (fila
legacy), ningún item aparece resaltado y elegir uno cambia el rol
(saliendo de "broker" para siempre desde la UI).

WAI-ARIA Menu pattern: trigger `aria-haspopup="menu"`, panel
`role="menu"`, items `role="menuitem"`, flechas ↑↓, Home/End, Escape.

Click en un role item → cierra menu → abre `<ChangeRoleConfirmDialog>`
con `action={ kind: 'set_role', nextRole, currentRole }`.

Click en "Suspender" / "Reactivar" → abre dialog con `action={ kind:
'suspend' }` o `{ kind: 'reactivate' }`.

#### 7. `ChangeRoleConfirmDialog.tsx` (Client)

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName: string;
  action:
    | {
        kind: 'set_role';
        nextRole: 'user' | 'agent' | 'admin';
        currentRole: 'user' | 'agent' | 'broker' | 'admin';
      }
    | { kind: 'suspend' }
    | { kind: 'reactivate' };
}
```

- Modal centrado (patrón propio, sin Radix).
- Título según `action.kind`:
  - `set_role`: "Cambiar rol de {displayName}"
  - `suspend`: "Suspender a {displayName}"
  - `reactivate`: "Reactivar a {displayName}"
- Copy:
  - `set_role`: "El rol pasará de **{currentLabel}** a **{nextLabel}**.
    El usuario recibirá una notificación."
  - `suspend`: "El usuario no podrá realizar acciones (subir
    propiedades, agendar visitas). **Se cerrará su sesión inmediatamente.**"
  - `reactivate`: "El usuario recuperará el acceso completo de su
    rol actual ({currentRoleLabel})."
- Botones por kind:
  - `set_role` → "Cancelar" (ghost) + "Confirmar cambio" (primary)
  - `suspend` → "Cancelar" (ghost) + "Suspender" (danger)
  - `reactivate` → "Cancelar" (ghost) + "Reactivar" (primary)
- `useTransition` envuelve la action correspondiente
  (`changeRole` / `suspendUser` / `reactivateUser`).
- Error → alert inline (`text-danger text-sm`).
- En éxito: `onClose()` + revalidación automática vía `revalidatePath`.

#### 8. `InviteUserButton.tsx` (Client)

```ts
interface Props {} // simplemente abre el dialog
```

- Botón `<Button variant="primary" size="md" leadingIcon="person_add">
Invitar usuario</Button>`.
- Estado local `open` que pasa a `<InviteUserDialog>`.

#### 9. `InviteUserDialog.tsx` (Client)

```ts
interface Props {
  open: boolean;
  onClose: () => void;
}
```

Form controlado:

- Campo `<Input type="email" name="email" required placeholder="email@dominio.com">`.
  Label "Email del usuario".
- Campo `<select name="initialRole">` con 3 opciones: Usuario / Agente /
  Administrador. Label "Rol inicial".
- Botones: "Cancelar" (ghost) + "Enviar invitación" (primary, loading
  state via `useTransition`).
- Mensajes de error inline mapeando `error.code`:
  - `invalid` → muestra `error.message` (típicamente "Email inválido").
  - `already_exists` → "Este email ya está registrado como usuario."
  - `already_invited` → "Ya hay una invitación pendiente para este email."
  - `rate_limited` → "Demasiadas invitaciones recientes. Intenta más tarde."
  - `forbidden` / `unauthenticated` → "No autorizado." (caso teórico, la UI no debería verlo).
  - `server` → "No se pudo enviar la invitación. Intenta de nuevo."
- En éxito: mostrar mensaje "Invitación enviada a {email}." durante
  ~1.5s, cerrar dialog, la página revalida y aparece el nuevo profile
  (cuando el user acepta y se crea el row en `auth.users`).

A11y: `role="dialog"`, `aria-labelledby` → id del título, `aria-modal="true"`,
focus inicial en el input de email, Escape cierra, click fuera cierra,
focus trap dentro del dialog.

#### 10. `UserDirectoryEmptyState.tsx` (Server)

- `reason="no_users"`: "Aún no hay usuarios registrados."
- `reason="no_matches"`: "No encontramos usuarios con los filtros
  aplicados." + `<Link href="/admin/users">Limpiar filtros</Link>`.

### Index / barrel

`src/components/admin/index.ts` re-exporta los nuevos componentes.

## 11. Tipografía

Inter en todos los pesos. Mapeo a la escala documentada en
`docs/design-system.md`:

| Elemento                           | Clases                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| Título h1 "Directorio de usuarios" | `text-3xl font-bold text-on-surface tracking-tight`                 |
| Sublabel header                    | `text-sm text-muted mt-1`                                           |
| Search input                       | `text-sm`                                                           |
| Tabs (texto)                       | `text-sm font-semibold` (activo) / `text-sm font-medium text-muted` |
| Tabla header (uppercase)           | `text-xs font-semibold text-muted uppercase tracking-wider`         |
| Nombre del user (fila)             | `text-sm font-bold text-on-surface truncate`                        |
| Email del user                     | `text-xs text-muted truncate`                                       |
| ID del user (chip)                 | `text-[10px] px-2 py-0.5 bg-neutral-100 text-muted rounded`         |
| Badge de rol                       | `text-xs font-medium`                                               |
| Status indicator texto             | `text-xs text-muted`                                                |
| Performance label (uppercase)      | `text-[10px] uppercase tracking-wider text-muted`                   |
| Performance value                  | `text-sm font-semibold text-on-surface`                             |
| Botón "Cambiar rol"                | `text-xs font-medium`                                               |
| Botón "Invitar usuario"            | `text-sm font-semibold`                                             |
| Dropdown menu item                 | `text-xs text-on-primary/80 hover:text-on-primary`                  |
| Dialog título                      | `text-lg font-bold text-on-surface`                                 |
| Dialog body                        | `text-sm text-on-surface leading-relaxed`                           |
| Form label (invite dialog)         | `text-xs font-medium text-muted uppercase tracking-wider`           |
| Empty state título                 | `text-base font-semibold text-on-surface`                           |
| Empty state copy                   | `text-sm text-muted`                                                |

## 12. Datos

### Tablas consumidas

- **`profiles`** (read + update)
  - Lee: `id, email, full_name, avatar_url, role, is_active, created_at`.
  - Escribe (vía action + service_role para invite): `role`, `is_active`.
- **`properties`** (read-only)
  - Lee: `owner_id, id, price, listing_status, sold_at` (sold_at nueva
    en mig 0021).
- **`notifications`** (write-only vía trigger 0020).
- **`auth.users`** (read+invite indirecto via admin API; no se consulta
  por SQL directo).

### Server Component vs Client

- **`/admin/users/page.tsx`**: Server. `await searchParams`, `await
getSessionAndProfile()`, llama `listAdminUsers(...)`.
- **Componentes Client**: detallados en §10.

### Cache / revalidación

- Página `dynamic` (lee cookies).
- `revalidatePath('/admin/users')` en `changeRole`, `suspendUser`,
  `reactivateUser`, `inviteUser`.

## 13. Notas, riesgos y a11y

### Riesgos (R-1..n)

- **R1 — Divergencia visual con el mockup en performance columns**: el
  mockup muestra "Access Level: Level 5" y "Last Login: 2mo ago" en
  filas específicas. Esta spec NO los implementa. Riesgo aceptado:
  consistencia > fidelidad literal.

- **R2 (RESUELTO) — Sesión activa al suspender**: el server action
  `suspendUser` ahora invoca `admin.auth.admin.signOut(target.id,
'global')` tras el UPDATE de `is_active`. La sesión activa del target
  se revoca inmediatamente. Si `signOut` falla, se loguea pero el
  suspend lógico queda aplicado (la sesión expira en ~1h en el peor
  caso).

- **R3 — Cambiar a un admin a otro rol puede dejar la plataforma sin
  admins**: la self-protection impide que el admin se cambie a sí
  mismo (cubre el caso "único admin se degrada"). Riesgo residual: dos
  admins, uno degrada al otro. Aceptable; el admin que queda puede
  revertir.

- **R4 — Race condition entre listado y action**: aceptamos last-write-wins.

- **R5 — Invite races**: dos admins invitan al mismo email
  simultáneamente. Supabase responde `email_exists` o `invite_already_sent`
  al segundo y nuestra action mapea a `already_invited` /
  `already_exists`. Sin daño.

### Criterios de aceptación verificables (gate de reviewer)

- [ ] La ruta `/admin/users` redirige a `/login?next=/admin/users` para anon (middleware).
- [ ] La ruta `/admin/users` devuelve **404** para roles `user` y `agent`.
- [ ] La ruta carga normalmente para `admin` y muestra al menos 1 usuario.
- [ ] Search `?q=` filtra por nombre o email (ilike case-insensitive).
- [ ] Los 4 tabs filtran por rol (`?role=all|user|agent|admin`). Activo se resalta.
- [ ] Paginación con `PAGE_SIZE=20` aparece cuando hay > 20 usuarios.
- [ ] Columna "Propiedades" muestra `—` para users y count correcto para agents/admins.
- [ ] Columna "Ventas (año)" muestra `—` para users y `$X.XM` para agents con sales.
- [ ] La query de `sales_ytd` usa `properties.sold_at` (no `updated_at`).
- [ ] El trigger `properties_sync_sold_at` setea `sold_at` al pasar a `sold` y lo limpia al revertir.
- [ ] El backfill llenó `sold_at` para registros legacy con `listing_status='sold'`.
- [ ] El status indicator pinta verde para `is_active=true` y gris para `false`.
- [ ] La fila del caller tiene `bg-surface-soft` y el botón "No editable" deshabilitado con `aria-disabled` y tooltip.
- [ ] El dropdown "Cambiar rol" expone solo 3 roles (Admin / Agente / Usuario), sin Broker.
- [ ] Click en una opción del dropdown abre el `<ConfirmDialog>` con copy correcto.
- [ ] Submit del dialog ejecuta la action correspondiente, muestra loading, en éxito cierra y la fila se actualiza.
- [ ] La self-protection server-side rechaza con `code: 'self_target'` si `targetUserId === caller.id`.
- [ ] El no-op detection devuelve `code: 'no_op'` cuando se pide el rol actual.
- [ ] **`suspendUser` revoca la sesión del target**: tras suspend, el target con sesión abierta es desconectado en su próxima request (verificable abriendo dos navegadores).
- [ ] El copy del confirm de suspend dice "Se cerrará su sesión inmediatamente".
- [ ] **Botón "Invitar usuario"** abre el dialog. Submit con email válido + rol envía invitación (verificable revisando inbox o `auth.users`).
- [ ] El profile del invitado, tras aceptar, tiene `role = initialRole` (no el default 'user').
- [ ] Email ya registrado devuelve `already_exists` con copy correcto.
- [ ] Email ya invitado devuelve `already_invited` con copy correcto.
- [ ] La migración `0020_profiles_notify_role_change.sql` está aplicada y `get_advisors` no reporta warnings nuevos críticos.
- [ ] La migración `0021_properties_sold_at.sql` está aplicada; columna + trigger + index existen.
- [ ] Después de un `changeRole` / `suspend` / `reactivate` exitoso, el target ve una notification en `notifications` con copy en español.
- [ ] Mobile (<md): la tabla colapsa a cards stacked; el botón "Cambiar rol" es full-width.
- [ ] Cero hex literales en JSX (verificable con grep).
- [ ] El cliente admin (`src/lib/supabase/admin.ts`) tiene `import "server-only"` y rompe el build si lo importa un Client Component.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está documentado en `.env.example` (ya está) y el implementer le confirmó al humano que está seteado en `.env.local`.
- [ ] `init.sh full` pasa (lint + type-check + build).

### A11y — checklist concreto

- `<main id="main-content" tabIndex={-1}>` ya viene del layout.
- `<h1>` único en la página, `<p>` como sublabel.
- `<nav aria-label="Filtrar por rol">` envuelve los tabs.
  `aria-current="page"` en el tab activo.
- Search wrap en `<div role="search">`.
- `<ul role="list">` para los rows. Cada `<li>` con `aria-labelledby`
  apuntando al ID del nombre del user.
- ID chip (`#a1b2c3d4`) con `aria-label="ID de usuario"`.
- Botón "Cambiar rol": `aria-label="Cambiar rol de {full_name}"`.
- Botón "No editable" (caller): `aria-disabled="true"` + `title="No puedes
cambiar tu propio rol"`.
- Dropdown menu: WAI-ARIA Menu pattern.
- Dialogs: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`,
  focus trap, focus initial en "Cancelar" (no en destructivo) para los
  confirm dialogs; focus initial en input de email para el invite dialog.
- Contraste validado en `docs/design-system.md`.

### Estados

#### Loading

- `loading.tsx` con skeleton (header + tabs + 10 filas + footer).
- Loading de actions: `useTransition` dentro de cada dialog.

#### Empty

- 0 usuarios: `<UserDirectoryEmptyState reason="no_users">`.
- Filtros sin resultados: `<UserDirectoryEmptyState reason="no_matches">` + link limpiar.

#### Error

- `error.tsx` (Client boundary).
- Action devuelve `{ ok, error }`; dialog pinta `error.message`.

## 14. Alternativas consideradas (obligatorio por `requires_approval`)

### Estructura HTML semántica: `<ul>` vs `<table>`

- **Opción A — `<ul role="list">` con cards stacked en mobile (recomendada)**.
- **Opción B — `<table>` real con `<th scope>`**.

**Recomendación**: Opción A. Consistencia con `PropertyManagementRow`;
tradeoff de a11y aceptable porque cada `<li>` lleva `aria-labelledby`.

### Patrón del dropdown "Cambiar rol"

- **Opción A — Custom WAI-ARIA Menu (recomendada)**.
- **Opción B — Radix dropdown-menu** (rompe regla "no nuevas deps").
- **Opción C — Reusar `DashboardFilters`** (semánticamente incorrecto).

**Recomendación**: Opción A.

### Inserción de la notification al user afectado

- **Opción A — Trigger DB SECURITY DEFINER (recomendada)**.
- **Opción B — service_role desde la action** (rompe consistencia con
  mig 0017/0018).
- **Opción C — Sin notification** (no cumple acceptance).

**Recomendación**: Opción A.

### Forzado del rol inicial en `inviteUser` (decisión C1)

- **Opción A — UPDATE inmediato post-invite en la action, con service_role
  (recomendada y elegida)**. Lógica de roles vive en TS, auditable.
- **Opción B — Trigger sobre `auth.users` AFTER INSERT que lee
  `raw_user_meta_data->>'initial_role'`**. Funciona, pero esparce
  reglas de autorización en SQL.

**Recomendación**: Opción A.

### Suspend con o sin revocar sesión (decisión R2)

- **Opción A — Revocar sesión con `admin.auth.admin.signOut(targetId,
'global')` (recomendada y elegida)**. Confina el uso de service_role
  a esta action. UX consistente con copy del dialog.
- **Opción B — Solo flip `is_active=false`, no tocar sesión** (versión
  vieja del spec). Riesgo: target sigue navegando hasta ~1h.

**Recomendación**: Opción A.

### Búsqueda con debounce vs submit explícito

- **Opción A — Submit explícito (Enter/blur) (recomendada)**.
- **Opción B — Debounce 300ms** (router.replace ensucia history).

**Recomendación**: Opción A.

## 15. Resumen de archivos a crear/modificar

### Crear

- `src/app/(admin)/users/page.tsx`
- `src/app/(admin)/users/loading.tsx`
- `src/app/(admin)/users/error.tsx`
- `src/components/admin/index.ts`
- `src/components/admin/UserDirectorySearch.tsx`
- `src/components/admin/UserDirectoryTabs.tsx`
- `src/components/admin/UserDirectoryRow.tsx`
- `src/components/admin/UserStatusIndicator.tsx`
- `src/components/admin/UserRoleBadge.tsx`
- `src/components/admin/ChangeRoleMenu.tsx`
- `src/components/admin/ChangeRoleConfirmDialog.tsx`
- `src/components/admin/InviteUserButton.tsx`
- `src/components/admin/InviteUserDialog.tsx`
- `src/components/admin/UserDirectoryEmptyState.tsx`
- `src/lib/admin/queries.ts`
- `src/lib/admin/actions.ts`
- `src/lib/admin/schemas.ts`
- `src/lib/admin/format.ts`
- `src/lib/supabase/admin.ts` (cliente service_role, server-only)
- `supabase/migrations/0020_profiles_notify_role_change.sql`
- `supabase/migrations/0021_properties_sold_at.sql`

### NO modificar

- `src/app/(admin)/layout.tsx` — guard ya correcto.
- `src/lib/supabase/proxy.ts` — `/admin` ya está en `protectedPaths`.
- `src/components/nav/TopNav.tsx` — variant admin ya monta los links.
- `src/components/dashboard/DashboardPagination.tsx` — reutilizar.
- `.env.example` — `SUPABASE_SERVICE_ROLE_KEY` ya está declarada
  (línea 19). NO requiere cambios.

### Documentación a actualizar (solo agregar)

- `docs/data-model.md` — agregar párrafo sobre `properties.sold_at` (ver §9).
- `CLAUDE.md` — el leader agrega una decisión arquitectónica nueva sobre
  el cliente service_role (ver §18).

## 16. Migraciones a aplicar (resumen ejecutivo)

Dos migraciones, en orden:

1. **`0020_profiles_notify_role_change.sql`** — trigger AFTER UPDATE
   sobre `profiles` que inserta notification al user cuando un admin
   cambia su `role` o `is_active`. Patrón mig 0017/0018.
2. **`0021_properties_sold_at.sql`** — agrega columna `sold_at` a
   `properties`, trigger BEFORE UPDATE que la mantiene sincronizada con
   `listing_status`, index parcial, y backfill desde `updated_at` para
   filas legacy con `listing_status='sold'`.

Aplicar con `apply_migration` via MCP. Verificar `get_advisors` después
de cada una. **No aplicar antes de que el implementer haya creado los
archivos correspondientes y confirmado en seco que el flujo cierra.**

## 17. Cliente admin con service_role

### Archivo

`src/lib/supabase/admin.ts` (decisión: este path, alineado con el resto
de helpers de Supabase en `src/lib/supabase/`).

### Contenido (referencia para el implementer)

```ts
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

/**
 * Cliente Supabase con service_role. SOLO server-side.
 * - Bypasea RLS (úsalo con cuidado).
 * - Necesario para Admin API (auth.admin.*) y para escrituras que deben
 *   evadir policies (ej. forzar role inicial post-invite cuando no hay
 *   sesión del target).
 *
 * El marcador `import "server-only"` hace que Next falle el build si
 * un Client Component intenta importar este módulo.
 */
export function createAdminClient(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  }

  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
```

### Variable de entorno

- **`SUPABASE_SERVICE_ROLE_KEY`** — ya declarada en `.env.example`
  (verificado, línea 19). **El implementer debe pedirle al humano que la
  rellene en `.env.local` antes de probar el invite o el suspend**. Sin
  esa variable, ambas actions (`inviteUser`, `suspendUser`) fallarán con
  el error explícito del `throw` de arriba.
- **`NEXT_PUBLIC_SUPABASE_URL`** — también ya declarada.

### Reglas de uso (que el implementer debe respetar y el reviewer fiscalizar)

1. **Solo** se importa desde `src/lib/admin/actions.ts` (las acciones
   `inviteUser`, `suspendUser`). Cualquier otro import requiere
   justificación explícita en el PR.
2. **Nunca** se exporta su SupabaseClient ni se pasa por props a
   componentes.
3. **Nunca** se usa para reads en flujos públicos donde RLS protege
   privacidad.
4. **Siempre** marca `import 'server-only'` arriba del archivo.

## 18. Decisiones arquitectónicas a registrar (acción del leader)

Tras aprobar este spec, el leader debe agregar a `CLAUDE.md` (sección
"Decisiones arquitectónicas tomadas", solo append, sin modificar
existentes) un párrafo con sustancia equivalente a:

> ### Cliente Supabase service_role confinado en `src/lib/supabase/admin.ts`
>
> - **Por qué**: la feature `admin_user_directory` necesita la Admin API
>   de Supabase para enviar invitaciones (`auth.admin.inviteUserByEmail`)
>   y para revocar sesiones al suspender (`auth.admin.signOut(userId,
'global')`). Ambas requieren `service_role`.
> - **Cómo**: helper `createAdminClient()` en `src/lib/supabase/admin.ts`,
>   marcado con `import 'server-only'` para que Next falle el build si
>   se importa desde un Client Component. La key vive en
>   `SUPABASE_SERVICE_ROLE_KEY` (ya en `.env.example`).
> - **Restricción**: solo se importa desde Server Actions de features
>   que explícitamente requieran Admin API. Hoy: `src/lib/admin/actions.ts`
>   (admin_user_directory). Cualquier nueva feature que lo necesite debe
>   justificarse en review y mencionarse acá.
> - **Trade-off**: bypasea RLS — la disciplina de uso es la única
>   barrera. La separación física + el marcador server-only minimizan
>   el riesgo de exposición accidental al cliente.

El leader es responsable de redactarlo con su voz; este texto es solo
guía de contenido.
