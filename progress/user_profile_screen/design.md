# Design spec — user_profile_screen

## Resumen

Pantalla `/profile` (privada, ya cubierta por `protectedPaths` en
`src/lib/supabase/proxy.ts`) que reúne el centro personal del user:
header con avatar editable + identidad + stats, y 3 tabs:

- **Saved** — grid de favoritos (reusa pipeline de `favorites_list_screen`).
- **Visits** — visitas del user en 2 secciones (Próximas / Pasadas).
- **Settings** — email readonly + toggle placeholder de notificaciones.

Stack: Server Component principal + 4 islands client puntuales (tabs,
avatar editor, toggle). Server Action para upload de avatar.

## Referencia visual

- Mockup: `docs/designs/user_profile_screen/screen.png`
- HTML: `docs/designs/user_profile_screen/code.html`

El PNG manda en cualquier conflicto.

## Tokens a usar

Color (todos via `globals.css`):

- Fondo de página: `bg-background` (clear-day).
- Header del perfil: `bg-surface-soft` (hint-green), `rounded-2xl`, sombra
  `shadow-soft`, borde `border-divider-soft`.
- Stats card: `bg-surface` blanco + `border-divider-soft` + `shadow-card`.
- Texto principal: `text-on-surface`, `text-on-background`.
- Texto secundario: `text-muted`.
- Acento (stats "Visits", links, botones primarios): `text-primary`,
  `bg-primary`, `text-on-primary`.
- Hover de primary: `bg-primary-hover`.
- Botón secundario "Reagendar": `border-outline`, `text-on-surface`,
  hover `bg-surface-hover`.
- Border bottom de tabs: `border-divider`; tab activa: `border-primary`
  con `text-on-surface font-semibold`; tab inactiva:
  `text-muted border-transparent hover:text-on-surface`.
- Divider vertical entre stats: `bg-divider`.
- Cards de visita: `bg-surface`, `border-divider-soft`, `shadow-card`,
  hover sutil `hover:shadow-soft-hover`.
- Tab Settings — bloque "Account Preferences": `bg-surface rounded-2xl
border-divider-soft`, fields `bg-background` (clear-day) + `border-outline`.
- Avatar edit button (FAB sobre el avatar): `bg-primary text-on-primary`
  hover `bg-surface-inverse` (nordic).

Radios: `rounded-2xl` header, `rounded-xl` cards de visita y stats,
`rounded-lg` campos de settings, `rounded-full` avatar y FAB.

Sombras: `shadow-card` (cards listado), `shadow-soft` (header destacado),
`shadow-dropdown` (popovers internos si los hubiera).

## Layout propuesto

Mobile-first; el mockup ya está pensado a partir de ~390px.

### Estructura semántica

```
<main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
  <header aria-labelledby="profile-name">     {/* header de perfil */}
  <nav aria-label="Secciones del perfil">     {/* tabs */}
  <section aria-labelledby="tab-panel-...">   {/* contenido activo */}
</main>
```

### Header del perfil

- Card `bg-surface-soft rounded-2xl p-6 sm:p-8` con borde sutil.
- Mobile (<md): columna; row con avatar + identidad arriba, stats abajo.
- md+: row con justify-between (identidad ← → stats).
- Avatar:
  - 96px (`h-24 w-24`) mobile, 128px (`lg:h-32 lg:w-32`) lg+.
  - Borde blanco `border-4 border-surface shadow-card`.
  - FAB de edit superpuesto bottom-right (`absolute -bottom-1 -right-1`,
    `h-8 w-8 lg:h-10 lg:w-10`, `rounded-full`, icono `edit`/`photo_camera`).
- Identidad:
  - `<h1>` con `full_name` o fallback al local-part del email — `text-3xl
lg:text-4xl font-bold` (`headline-1`/`display-3`).
  - Sub-línea: ícono `location_on` + `profile.city` + bullet "·" + "Miembro
    desde 2024" (`profile.member_since` formateado a año en `es-MX`).
    Si `city` es null, se omite el bloque hasta el bullet.
- Stats card (`bg-surface rounded-xl px-6 py-4 shadow-card`):
  - 2 contadores (user) o 3 (agent+):
    - **Guardadas** (siempre) — count de `favorites` del user. Color
      `text-on-surface`.
    - **Visitas** (siempre) — count total de `visits` del user. Color
      `text-primary` (acento del mockup).
    - **Vendidas** (solo agent/broker/admin) — count de `properties`
      con `owner_id = user.id` y `listing_status = 'sold'`.
      Color `text-on-surface`.
  - Cada contador: número grande `text-2xl font-bold` arriba, label
    `text-xs uppercase tracking-wider text-muted font-medium` abajo.
  - Divider vertical `w-px bg-divider` entre contadores.
  - Mobile: stats en columna full-width dentro del header; md+:
    horizontal a la derecha.

### Tabs

- Tira horizontal `flex items-center gap-6 sm:gap-8 border-b border-divider
mb-8 overflow-x-auto hide-scroll`.
- 3 botones (en realidad `<Link>` para preservar SEO/back, ver §
  "Interactividad"):
  1. "Propiedades guardadas" → `?tab=saved` (default).
  2. "Visitas programadas" → `?tab=visits`.
  3. "Preferencias y ajustes" → `?tab=settings`.
- Estado activo: `pb-4 px-1 sm:px-2 font-semibold text-on-surface border-b-2
border-primary`.
- Inactivo: `text-muted border-b-2 border-transparent hover:text-on-surface
hover:border-divider`.

### Tab "Saved"

Grid idéntico al de `/favorites` (view=grid):

```
grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4
```

Cada item es `<PropertyCard variant="compact" orientation="vertical"
isFavorite isAuthenticated showBookingCTA />` — reutilizando exactamente
los mismos props que `favorites/page.tsx`.

Empty state: usar `<FavoritesEmptyState reason="never_favorited" />`
ya existente — copy "Aún no guardaste propiedades" + CTA "Explorar
propiedades" → `/`.

### Tab "Visits"

Lista vertical con header de sección `<h2>` por bloque. Cada bloque solo
se renderiza si tiene items (no mostrar header con "no hay" vacío):

```
<section aria-labelledby="visits-upcoming">
  <h2>Próximas visitas</h2>
  <ul className="space-y-4">{...}</ul>
</section>

<section aria-labelledby="visits-past" className="mt-12">
  <h2>Visitas pasadas</h2>
  <ul className="space-y-4">{...}</ul>
</section>
```

Header de cada sección (replica del HTML): pill verde + texto.

```
<h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-on-surface">
  <span className="h-7 w-1.5 rounded-full bg-primary" aria-hidden />
  Próximas visitas
</h2>
```

#### `VisitCard` (componente nuevo)

Layout:

- Mobile (<md): columna. Thumb arriba full-width `h-32`, contenido
  abajo. Botones full-width en row apilado al final.
- md+: row. Thumb 12rem (`md:w-48 md:h-24`), contenido flex-1, botones
  a la derecha.
- Container: `flex flex-col md:flex-row bg-surface p-2 rounded-xl
border border-divider-soft shadow-card`.
- Thumb: imagen main de la property via `getImageUrl(property_image.
storage_path)`, `next/image`, `rounded-lg overflow-hidden object-cover`.
- Contenido:
  - Línea superior: `<time dateTime={iso}>` con ícono `calendar_today`,
    texto `text-primary font-semibold text-sm uppercase tracking-wide`,
    formato `es-MX` en la **timezone de la propiedad** (`properties.
timezone`) usando `Intl.DateTimeFormat`. Ejemplo: "24 OCT, 14:00".
  - Título `<h3>` con `property.title` (`text-lg font-bold text-on-surface`).
  - Sub-línea: ícono `person` + "Agente: " + `agent_profile.full_name`
    (fallback al email si null) — `text-sm text-muted`.
  - Badge de estado (chip pequeña a la derecha del título cuando aplique):
    - `confirmed` → no se pinta (es el estado happy).
    - `pending` → `<Badge variant="soft" size="sm" uppercase>Pendiente`.
    - `rescheduled` → `<Badge variant="soft" size="sm" uppercase>Reagendada`.
    - `completed` → `<Badge variant="soft" size="sm" uppercase>Realizada`.
    - `cancelled` → `<Badge variant="soft" size="sm" uppercase
tone="danger">Cancelada` (si Badge no tiene tone, usar
      `bg-danger-soft text-danger`).
- Botones:
  - **Próximas** (status pending/confirmed/rescheduled y futura):
    - "Reagendar" — `<Link>` a `/property/[id]/schedule?reschedule=
<visit_id>`. Secundario (`border-outline text-on-surface`).
    - "Cómo llegar" — `<a>` externa
      `https://www.google.com/maps/search/?api=1&query=<encoded>`,
      `target="_blank" rel="noopener noreferrer"`. Primario
      (`bg-primary text-on-primary`).
  - **Pasadas**: solo "Cómo llegar" (full-width en mobile). No Reagendar
    en pasadas — para repetir visita el user vuelve a property
    details y agenda nueva.

### Tab "Settings"

Single section (replica del HTML):

```
<section className="rounded-2xl bg-surface p-6 sm:p-8 border border-divider-soft">
  <header>
    <h2>Preferencias de la cuenta</h2>
    <p>Gestiona tus ajustes y notificaciones</p>
  </header>

  <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
    <Field label="DIRECCIÓN DE CORREO">
      <Input readOnly value={profile.email} leftIcon="mail"
        rightSlot={
          <Button variant="ghost" size="sm" disabled
            title="Próximamente — el flujo de cambio de email se implementa en la feature change_email_flow"
            aria-label="Cambiar email (próximamente)">
            Cambiar
          </Button>
        }
      />
    </Field>
    <Field label="NOTIFICACIONES">
      <ToggleRow label="Alertas de nuevas propiedades" defaultChecked />
    </Field>
  </div>
</section>
```

- Labels: `text-xs font-bold uppercase tracking-wider text-muted`.
- Email input: readonly, `bg-background border-outline rounded-lg
px-3 py-2.5 text-sm`. Ícono `mail` a la izquierda en `text-muted`.
  Botón "Cambiar" a la derecha del input, **disabled** con tooltip
  "Próximamente". El flujo completo de change-email se implementa en
  la feature `change_email_flow` (ya agregada al backlog) — esta
  pantalla solo pinta el control deshabilitado para no romper el
  layout del mockup.
- Toggle: el ya disponible en `MobileNavDrawer`/inputs custom (no veo
  primitivo Toggle en `ui/`; ver "Componentes" abajo). Track
  `bg-neutral-200 peer-checked:bg-primary`, thumb blanco. `defaultChecked
= true`. No persiste. Tooltip o pequeño texto debajo: "(próximamente
  podrás guardar tus preferencias)" para honestar al user.
- "View all settings" del HTML: se omite — no hay página de detalle.

### Responsive resumen

- Container max-w-7xl, padding lateral 16/24/32px.
- Header: stack col en <md, row con stats a la derecha en md+.
- Tabs: scroll-x si no caben (con `hide-scroll`).
- Saved grid: 1→2→3→4 cols.
- Visits cards: col en <md, row en md+.
- Settings: 1 col en <md, 2 cols en md+.

## Componentes

### Existentes a reutilizar (sin tocar)

- `ui/Avatar` — para el avatar grande del header (size `xl` + override
  visual si hace falta tamaño extra) y para "Visit card" si se quisiera.
- `ui/Icon` — todos los iconos Material.
- `ui/Button` — variants `primary` / `secondary` / `ghost` para los CTAs
  de visit + tab Settings.
- `ui/Card` — opcional para wrap del header si encaja.
- `ui/Input` — para el email readonly.
- `ui/Badge` — chips de estado de visita.
- `property/PropertyCard` — exactamente como en `/favorites`.
- `favorites/FavoritesEmptyState` — empty del tab Saved.
- `lib/properties/queries.getUserFavorites` — exactamente como en
  `/favorites`. **Decisión:** la tab Saved llama directamente a
  `getUserFavorites(supabase, user.id, 'date_desc')` y mapea con
  `PropertyCard`. **No extraigo un componente `<FavoritesGrid>`
  compartido en este PR**: la duplicación es de 8 líneas JSX (grid +
  map), no justifica una nueva abstracción y permite divergir Saved del
  /favorites independiente (en la tab no hay sort, ni view toggle, ni
  `DiscoverMoreCard`). Si la divergencia se vuelve costosa, se
  refactoriza en una iteración posterior.

### Componentes nuevos

Todos bajo `src/components/profile/`:

| Archivo                   | Tipo             | Responsabilidad                                                                                |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `ProfileHeader.tsx`       | Server Component | Card hint-green con avatar + identidad + stats. Recibe `profile`, `stats`, `role`.             |
| `ProfileAvatarEditor.tsx` | Client Component | Avatar grande + FAB edit + modal/sheet con preview, upload, delete. Server Action para upload. |
| `ProfileStats.tsx`        | Server Component | Render del bloque blanco con 2 o 3 contadores según role. Recibe `stats` y `role`.             |
| `ProfileTabs.tsx`         | Client Component | Tabs (`<Link>` + estilo activo). Lee `searchParams.tab` y compara para `aria-selected`.        |
| `VisitsList.tsx`          | Server Component | Recibe `upcoming` y `past`, renderiza ambas secciones (omite vacías).                          |
| `VisitCard.tsx`           | Server Component | Card individual de visita. Botones son `<Link>` y `<a>` (sin estado).                          |
| `SettingsPanel.tsx`       | Server Component | Card con email readonly + toggle.                                                              |
| `NotificationsToggle.tsx` | Client Component | Toggle controlado con `useState`. Placeholder sin persistencia.                                |
| `index.ts`                | —                | Barrel export.                                                                                 |

Estructura de carpetas final esperada:

```
src/components/profile/
  ProfileHeader.tsx
  ProfileAvatarEditor.tsx
  ProfileStats.tsx
  ProfileTabs.tsx
  VisitsList.tsx
  VisitCard.tsx
  SettingsPanel.tsx
  NotificationsToggle.tsx
  index.ts

src/app/(app)/profile/
  page.tsx           (Server Component)
  loading.tsx        (skeleton del shell)

src/lib/profile/
  queries.ts         (getUserStats, getUserVisits)
  actions.ts         (uploadAvatar, removeAvatar)
  schemas.ts         (zod para upload)
```

### Estados visuales (componentes nuevos)

- `ProfileAvatarEditor`:
  - default: avatar con FAB visible.
  - hover sobre avatar (desktop): overlay sutil con ícono `photo_camera`
    centrado (`bg-surface-inverse/30`).
  - panel abierto: modal centrado en desktop, bottom-sheet en mobile
    con: preview del archivo seleccionado, botón "Eliminar foto"
    (rojo, ghost) si ya hay avatar, botón "Cancelar", botón "Guardar".
  - loading (upload): botón "Guardar" con spinner + disabled, FAB con
    `aria-busy`.
  - error: texto `text-danger text-sm` debajo del preview con mensaje
    devuelto por la Server Action (ej. "Archivo demasiado grande
    (máx 2 MB)").
- `ProfileTabs`: activo / inactivo (ya descritos).
- `VisitCard`: default, hover (`hover:shadow-soft-hover`), focus-visible
  ring en cada CTA.
- `NotificationsToggle`: on / off, focus-visible ring en el track.

## Tipografía

Inter en todos los pesos (300/400/500/600/700) ya cargados globalmente.

Mapeo por elemento:

- Nombre del user (`<h1>`): `text-3xl lg:text-4xl font-bold` →
  `headline-1` / `display-3`.
- Sub-línea identidad: `text-sm font-light text-muted` → `body-sm`.
- Stats número: `text-2xl font-bold` → `headline-2` ajustado.
- Stats label: `text-xs uppercase tracking-wider font-medium text-muted` →
  `overline`.
- Tabs: `text-sm font-medium` (inactivo) / `font-semibold` (activo) →
  `body`.
- Sección headers (`Próximas visitas`, `Preferencias…`): `text-xl
font-bold` → `headline-3`.
- Visit card título: `text-lg font-bold` → `title-1`.
- Visit card fecha: `text-sm font-semibold uppercase tracking-wide
text-primary` → `caption` con primary.
- Visit card agente: `text-sm text-muted` → `body`.
- Settings label: `text-xs font-bold uppercase tracking-wider text-muted`
  → `overline`.
- Settings field text: `text-sm text-on-surface` → `body`.

## Datos

### Tablas que consume

| Tabla                                          | Operación            | Filtros                                                                                                                                                           |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                     | select               | `id = auth.uid()` (vía `getSessionAndProfile`).                                                                                                                   |
| `favorites`                                    | count                | `user_id = auth.uid()` (para stat "Guardadas").                                                                                                                   |
| `favorites` + `properties` + `property_images` | select join          | igual que `getUserFavorites` (tab Saved).                                                                                                                         |
| `visits`                                       | select join          | `user_id = auth.uid()`, join a `properties` (title, address_line, city, state, country, timezone, property_images main) y `profiles!agent_id` (full_name, email). |
| `properties`                                   | count                | `owner_id = auth.uid()` AND `listing_status = 'sold'` — solo si role agent+ (para stat "Vendidas").                                                               |
| `storage.objects` (bucket `avatars`)           | insert/update/delete | desde Server Action. Path `{user_id}/avatar.<ext>`. RLS ya cubierto en migración 0010.                                                                            |

RLS:

- `profiles_select` ya permite leer el propio profile (mig 0002).
- `favorites_select_own` ya permite (mig 0006).
- `visits_select_participant_or_admin` ya permite leer visits propias
  (mig 0007).
- `properties` select: lectura propia + `is_active` + admin (mig 0003).
  El count de "Vendidas" del owner funciona porque el owner siempre ve
  sus propias propiedades.
- `avatars_storage_*` policies validan `split_part(name, '/', 1) =
auth.uid()::text` (mig 0010) — el path `<user_id>/avatar.<ext>`
  cumple naturalmente.

### Server vs Client

- `page.tsx`: **Server Component**. Hace 4-5 queries en paralelo
  (`Promise.all`): profile (ya viene de session), favoritesCount,
  favorites (si tab=saved), visits (si tab=visits), soldCount (si role
  agent+).
- `ProfileHeader`, `ProfileStats`, `VisitsList`, `VisitCard`,
  `SettingsPanel`: **Server**.
- `ProfileTabs`, `ProfileAvatarEditor`, `NotificationsToggle`: **Client**
  (necesitan estado y/o hooks).

### Queries nuevas (`src/lib/profile/queries.ts`)

```ts
export interface ProfileStats {
  favoritesCount: number;
  visitsCount: number;
  soldCount: number | null; // null si role=user → no se muestra
}

export async function getProfileStats(
  supabase: SupabaseDb,
  userId: string,
  role: UserRole,
): Promise<ProfileStats>;

export interface VisitForCard {
  id: string;
  scheduled_at: string; // UTC ISO
  status: VisitStatus;
  property: {
    id: string;
    title: string;
    address_line: string;
    city: string;
    state: string | null;
    country: string | null;
    timezone: string;
    main_image: { storage_path: string; alt_text: string | null } | null;
  };
  agent: { full_name: string | null; email: string };
}

export interface VisitsBuckets {
  upcoming: VisitForCard[];
  past: VisitForCard[];
}

/**
 * Trae todas las visits del user partidas en dos buckets:
 * - upcoming: status IN (pending, confirmed, rescheduled) AND scheduled_at > now()
 *   ordenadas ASC por scheduled_at.
 * - past: el resto. Ordenadas DESC.
 *
 * Se hace UNA sola query y se parte en código (menos round-trips y RLS
 * coherente). Si en el futuro hay paginación, se aplica `.limit(20)` a
 * `past` server-side.
 */
export async function getUserVisits(supabase: SupabaseDb, userId: string): Promise<VisitsBuckets>;
```

`getProfileStats` ejecuta:

- `supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', userId)`
- `supabase.from('visits').select('id', { count: 'exact', head: true }).eq('user_id', userId)`
- Si `role in ('agent','broker','admin')`:
  `supabase.from('properties').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('listing_status', 'sold')`.

## Interactividad

### Tabs

- Implementadas como `<Link href="/profile?tab=saved">` etc., no como
  `<button>`. Razón: preserva back/forward, deeplinking, y deja la
  página como Server Component que rehidrata solo el panel activo. El
  componente `ProfileTabs` es Client solo para leer `useSearchParams`
  y aplicar la clase `border-primary` activa con coherencia inmediata
  ante la navegación (mismo patrón que `NavLinks` del TopNav).
- `aria-selected` y `role="tab"` no aplican porque no es un patrón
  tablist puro (deeplinking + Server panels). Se usa `aria-current="page"`
  en el link activo, que cubre la semántica para AT.
- Default tab: `saved` si `?tab` ausente o inválido.

### Avatar upload

- Trigger: click en FAB abre un panel (`role="dialog" aria-modal="true"`).
- Input file controlado: `<input type="file" accept="image/jpeg,image/png,image/webp">`.
- Validación cliente antes de submit:
  - Tamaño `<= 2 * 1024 * 1024`.
  - MIME en whitelist.
  - Si falla: muestra error sin tocar Server Action.
- Preview con `URL.createObjectURL(file)` (revoke al desmontar).
- Submit:
  - `FormData` con el blob.
  - Llama a Server Action `uploadAvatar(formData)`.
  - Server Action revalida con zod (re-chequeo de tamaño/mime
    server-side), determina extensión real desde MIME (no del nombre
    del archivo — evita spoofing), sube a
    `avatars/<user.id>/avatar.<ext>` usando `supabase.storage.from
('avatars').upload(path, file, { upsert: true, cacheControl: '3600' })`,
    actualiza `profiles.avatar_url` con la URL pública resultante,
    invoca `revalidatePath('/profile')` y devuelve
    `{ ok: true, url }` o `{ ok: false, error }`.
- Server Action `removeAvatar()`:
  - Borra los blobs en `avatars/<user.id>/` cuyo nombre matchee
    `^avatar\.(jpg|jpeg|png|webp)$`.
  - Setea `profiles.avatar_url = null`.
  - Revalida `/profile`.
- Cache-busting: la URL pública guardada lleva `?v=<timestamp>` como
  querystring para invalidar el `<img>` y el dropdown del TopNav.

### Notifications toggle

- `useState(true)` inicial. Sin Server Action. Solo persiste durante
  la sesión local. Pequeño texto debajo "(próximamente podrás guardar
  tus preferencias)".
- Decisión documentada: el schema actual de `profiles` (verificado en
  `types/database.ts`) **no tiene** ninguna columna que pueda usarse
  como bandera de notificaciones (`bio`, `city`, `phone`, `avatar_url`,
  `is_active`, `role`, `member_since`). Para persistir trivialmente
  haría falta una migración nueva (`alter table profiles add column
notifications_enabled boolean default true`). Se queda como placeholder
  hasta que el flujo de notificaciones reales (`notifications_dropdown`,
  feature pendiente) lo justifique.

### Get Directions

- `<a>` simple, sin JS. URL:
  ```ts
  const q = encodeURIComponent(
    [property.address_line, property.city, property.state, property.country]
      .filter(Boolean)
      .join(', '),
  );
  const href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  ```
- `target="_blank" rel="noopener noreferrer"`.
- Texto botón: "Cómo llegar".

### Reschedule (contrato de query param)

- Botón "Reagendar" → `<Link href="/property/[id]/schedule?reschedule=
<visit_id>">`.
- Lo que esta feature define: **el query param `reschedule=<visit_id>` y
  el destino**. Nada más.
- Lo que `schedule_visit_screen` (feature done en iteración previa)
  **deberá** soportar en una iteración futura (ver "Dependencias y
  deuda"):
  1. Leer `searchParams.reschedule`, validar que el `visit_id` exista
     y pertenezca al user actual.
  2. Pre-seleccionar el slot actual de esa visita en el calendario.
  3. Sustituir el copy del CTA por "Confirmar nueva fecha".
  4. En el submit, ejecutar Server Action transaccional: marcar la
     visita vieja como `cancelled` Y crear la nueva visita con
     `status=confirmed` apuntando a la misma property/agent — en una
     RPC SECURITY DEFINER o en una transacción explícita.
- **Riesgo aceptado en este PR**: hasta que esa iteración exista, si el
  user hace click en "Reagendar", la pantalla destino ignora el query
  param y agendaría una **nueva** visita dejando la vieja intacta.
  Aceptable porque:
  - El user puede cancelar la vieja manualmente desde su perfil (cuando
    se agregue ese botón) o desde el flujo del agente.
  - No corrompe datos (es una visita duplicada, no inconsistente).
  - Es visible: el user verá ambas visitas en su tab "Próximas".

## Estados

### Loading

- `loading.tsx` muestra:
  - Header con avatar skeleton (`bg-neutral-100 rounded-full`), líneas
    de texto skeleton, stats card con 2 bloques skeleton.
  - Tabs estáticos (no requieren datos).
  - Bajo la tab activa según `?tab`: si saved → 6 `PropertyCardSkeleton`
    (ya existe), si visits → 2 `VisitCardSkeleton` (componente nuevo
    chiquito en `src/components/profile/`), si settings → 2 bloques
    skeleton.
- Avatar upload en progreso: spinner en el botón Guardar; FAB con
  `aria-busy="true"` y opacidad reducida; `<form>` deshabilita inputs.

### Empty

- Tab Saved: `<FavoritesEmptyState reason="never_favorited" />`.
- Tab Visits con **ambas** secciones vacías: card grande centrada con
  ícono `event_available`, copy "Aún no agendaste visitas", sub-copy
  "Explorá propiedades y reservá una visita para verlas en persona",
  CTA primario "Explorar propiedades" → `/`.
- Tab Visits con solo "Pasadas" vacías: no renderiza esa sección
  (decisión cerrada).
- Tab Visits con solo "Próximas" vacías: no renderiza esa sección.
  Renderiza solo "Pasadas". Esto cubre el caso "ya hice visitas pero
  ninguna pendiente".

### Error

- Errores de queries server-side: la página loguea (`console.warn`) y
  pinta secciones vacías con copy genérico ("No pudimos cargar tus
  visitas, intentá recargar"). No bloquear toda la pantalla por un
  fallo de un bloque.
- Server Action `uploadAvatar`: devuelve `{ ok: false, error: 'mensaje
en español' }`. La Client Component pinta el mensaje en
  `text-danger text-sm` bajo el preview, sin cerrar el modal.

## Acceptance mapping

Mapeo 1:1 contra los `acceptance` items de la entry `user_profile_screen`
en `feature_list.json`:

| #   | Acceptance item                                                                                                   | Cómo se cumple                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/app/(app)/profile/page.tsx` Server Component                                                                 | Sí. Server Component que orquesta queries y renderiza tabs.                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | Header con bg hint-green, avatar grande con botón edit (upload a Storage bucket avatars)                          | `ProfileHeader` (`bg-surface-soft`) + `ProfileAvatarEditor` (FAB + Server Action a bucket `avatars`).                                                                                                                                                                                                                                                                                                                       |
| 3   | Stats counters: favorites.count, visits.count (futuras y completadas separadas), sold = 0 por ahora               | `ProfileStats` muestra Guardadas + Visitas (count total). **Desviación documentada del acceptance literal**: el contador "Visits" del header muestra el total (no "futuras y completadas separadas"). La separación futuras/pasadas se materializa en la **tab Visitas** mediante las 2 secciones (decisión humana). "Sold" se reemplaza por count real desde `properties` para agent+, oculto para user (decisión humana). |
| 4   | Tabs implementadas con searchParam ?tab=saved\|visits\|settings (default saved)                                   | `ProfileTabs` con `<Link>` + parsing en `page.tsx`.                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | Tab Saved: reutiliza componente de favorites_list_screen                                                          | Reutiliza `getUserFavorites` + `PropertyCard` (mismo pipeline). Justificación de no extraer un `<FavoritesGrid>` compartido en § "Componentes".                                                                                                                                                                                                                                                                             |
| 6   | Tab Visits: lista de visits con thumbnail + fecha + agente + 2 botones (Reschedule + Get Directions)              | `VisitCard` cumple. Reschedule navega con `?reschedule=<id>`. Directions abre Google Maps en nueva pestaña.                                                                                                                                                                                                                                                                                                                 |
| 7   | Tab Settings: input email (readonly por ahora), toggle 'Alertas de nuevas propiedades' (placeholder, sin lógica)  | `SettingsPanel` + `NotificationsToggle`.                                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | Upload de avatar: Server Action sube a Storage bucket avatars/{user_id}/avatar.jpg y actualiza profile.avatar_url | `uploadAvatar` en `src/lib/profile/actions.ts`. Path es `avatars/{user_id}/avatar.<ext>` con extensión derivada del MIME (jpg/png/webp), no fija a `.jpg` — aceptable porque la convención del bucket es por user_id, y el cleanup borra cualquier extensión.                                                                                                                                                               |

## Riesgos

1. **Múltiples avatares quedan huérfanos en Storage si el user cambia
   de extensión.** Mitigación: la Server Action borra cualquier
   `^avatar\.(jpg|jpeg|png|webp)$` del directorio del user antes de
   subir el nuevo. Si falla el delete, loguea pero no aborta el upload
   (mejor un archivo huérfano que un upload roto).
2. **Reschedule navega a una pantalla que aún no soporta el modo
   reschedule.** Documentado como deuda. Riesgo: visita duplicada.
   Aceptado por humano.
3. **Stats `Vendidas` para agent+** puede ser confuso si el agent
   recién se registra y no tiene propiedades — mostrará `0`. Aceptable.
4. **Timezone en VisitCard**: si una propiedad tiene `timezone = null`
   (no debería tras mig 0016, pero defensivamente), caemos a
   `'America/Mexico_City'`.
5. **Costo de queries en cada navegación entre tabs**: dado que `page.tsx`
   es Server Component, cambiar de tab refetchea. Mitigación: cada
   query se condiciona al tab activo (no fetch de visits si tab=saved),
   y favoritesCount es lightweight (HEAD count). Suficiente para MVP.
6. **Cache del avatar en el TopNav**: tras subir un nuevo avatar, el
   `<Avatar src=...>` del TopNav puede mostrar la versión vieja
   cacheada. Mitigación: la Server Action revalida `/` y `/profile` y
   la URL guardada lleva `?v=<timestamp>`.

## Dependencias y deuda

### Dependencias inmediatas (esta feature las consume)

- `app_shell` (done) — TopNav + layouts ya enrutan a `/profile`.
- `favorites_list_screen` (done) — `getUserFavorites`, `PropertyCard`,
  `FavoritesEmptyState`.
- Migración 0010 (done) — policies del bucket `avatars`.
- Migración 0016 (done) — `properties.timezone` para formatear fechas
  de visitas en su huso local.

### Deuda nueva que esta feature deja abierta

1. **`schedule_visit_screen` necesita soporte de `?reschedule=<id>`**
   (iteración futura). Cuando se haga:
   - Leer el query param, validar ownership.
   - Pre-seleccionar el slot actual.
   - Server Action transaccional que cancela la vieja y crea la nueva
     atómicamente (recomendación: RPC `reschedule_visit(old_id,
new_scheduled_at)` SECURITY DEFINER, similar al patrón de la mig
     0017).
   - Mientras tanto: el query param se ignora y se crea visita
     duplicada. Riesgo aceptado.
2. **Cancelar visita desde el perfil**: el mockup no lo muestra y los
   acceptance no lo piden. Si se agrega, va con un botón ghost rojo
   "Cancelar" en `VisitCard` para visitas Próximas, con confirm.
3. **Persistencia del toggle de notificaciones**: requiere migración
   para agregar `profiles.notifications_enabled boolean default true`.
   Se diferirá a la feature `notifications_dropdown`.
4. **Change email**: el botón "Cambiar" se pinta disabled en este PR.
   El flujo completo (re-auth con password + supabase.auth.updateUser
   - route handler /auth/email-change) se implementa en la feature
     nueva `change_email_flow` agregada al backlog (2026-05-25).
5. **Bio / phone**: el schema tiene esas columnas. No las exponemos
   ahora — la feature actual se ciñe al mockup. Quedan para una
   eventual sección "Información personal".

### Cambios al harness

- **No** hace falta tocar `protectedPaths` en `src/lib/supabase/proxy.ts`
  — `/profile` ya está cubierto.
- **No** hace falta migración nueva — todo el schema necesario existe.
- `feature_list.json`: el implementer cambia `status` a `in_progress`
  cuando arranca y `blocked` si se atora. El leader marca `done` al
  cierre.

## Abiertas para humano

Ninguna que bloquee. Estas son decisiones tomadas yo que dejo
explicitadas por si querés revertir antes de implementar:

1. **Botón "Cambiar email"** del bloque Settings: revisión humana
   (2026-05-25) decidió pintarlo **disabled** con tooltip "Próximamente",
   no omitirlo. Se agregó la feature `change_email_flow` al backlog
   para materializar el flujo de cambio de email (re-auth con password
   - supabase.auth.updateUser + route handler de confirmación). Esta
     pantalla deja el control deshabilitado.
2. **Stat "Visitas" muestra count total**, no `Próximas / Pasadas`
   separadas en el header. La separación vive en la tab. Si querés que
   el número grande del header sea solo "Próximas", se cambia a una
   query con filtro de status y fecha futura.
3. **Pasadas no muestran "Reagendar"**, solo "Cómo llegar". Si querés
   que sí muestren reagendar (re-agendar una visita ya pasada), avisame.
4. **"Cancelar visita" no se agrega en este PR**. No estaba en el
   mockup ni en los acceptance.
5. **Bio y phone** del profile no se exponen en esta pantalla. Si querés
   un bloque "Información personal" editable, es feature aparte.

## Notas

- **A11y**:
  - `<main>` único en la página.
  - `<h1>` único (nombre del user).
  - Cada `<section>` tiene `aria-labelledby` apuntando a su `<h2>`.
  - Tabs: `aria-current="page"` en el link activo.
  - FAB del avatar: `aria-label="Editar foto de perfil"`.
  - Modal del editor: `role="dialog" aria-modal="true"
aria-labelledby="avatar-editor-title"`, focus trap, Escape cierra,
    focus inicial en el botón close, focus restaurado al FAB al cerrar.
  - Toggle: `<input type="checkbox">` real bajo `sr-only`, label
    asociado con `<label>`. Soporta teclado.
  - Cada CTA tiene texto visible (no solo iconos).
  - Iconos puramente decorativos llevan `aria-hidden="true"`.
- **Formato de fechas** (`Intl.DateTimeFormat('es-MX', { timeZone:
property.timezone, day: '2-digit', month: 'short', hour: '2-digit',
minute: '2-digit', hour12: false })`).
- **`next/image`**: usar para thumbs de visit (Supabase + Unsplash ya
  están en `remotePatterns`). Para el avatar grande, también `next/image`
  con `unoptimized={false}` y `priority={false}`.
- **`use client` solo donde corresponde**: ProfileTabs, AvatarEditor,
  NotificationsToggle. Resto Server.
- **Sin dependencias nuevas**. Todo con primitivas del repo + React +
  Next + Supabase.
