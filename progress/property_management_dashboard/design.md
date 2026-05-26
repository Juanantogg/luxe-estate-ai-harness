# Design spec — property_management_dashboard

> Status: requires_approval = true — el humano cerró las 6 decisiones
> pendientes el 2026-05-25. Ver sección "Decisiones cerradas".

## Decisiones cerradas (2026-05-25)

Cierres tomados por el humano sobre los riesgos abiertos de la v1 del
spec. Cada decisión documenta el por qué para que el implementer no
revierta nada sin motivo.

1. **R1 — Stat "Total" INCLUYE archivadas.** Consistente con que el
   delete es soft: el agent debe ver el histórico completo. El label
   visible en la card es **"Total"** (en español, ya que todo el resto
   de la UI está en español). El conteo NO baja al archivar; solo baja
   si admin hace `DELETE` real (fuera de scope MVP).
2. **R2 — Orden default `updated_at desc`.** Útil mientras el agent
   itera precios/descripciones. `properties.updated_at` existe (mig
   0003, con trigger `properties_set_updated_at`) — verificación local
   confirmada. Si en runtime la columna estuviera ausente, fallback
   automático a `created_at desc` (ver "Datos > Implementación").
3. **R3 — Toggle "Ver archivadas" + botón Restaurar.** Amplía scope.
   Por qué: dejar al agent revertir un archivo erróneo sin tocar la DB
   manualmente cierra la deuda que la v1 declaraba. La UI vive en el
   header de la tabla y la Server Action `restoreProperty` setea
   `listing_status='active'` (decisión simple: no guardamos el status
   previo; aceptamos la pérdida porque "active" es el estado útil al
   restaurar).
4. **R4 — Título clickeable a `/property/[id]` en pestaña nueva.** Por
   qué: el agent quiere previsualizar cómo ve el público la propiedad
   sin perder su contexto del dashboard. Solo el título es link (no la
   fila entera) para no robarle el foco a Edit/Archivar. Las archivadas
   NO llevan link (404 al público).
5. **R5 — Admin ve TODAS las properties.** Por qué: admin es vista
   global; un admin que también es agent puede crear sus propias
   properties, pero su modo principal de uso del dashboard es
   moderación de toda la plataforma. Se documenta como deuda que NO
   tenemos vista "solo mías" para admin; si se necesita después, se
   agrega un toggle "Solo mías" al header.
6. **R7 — Bloquear archivar con visits pendientes; cancelación
   individual.** Por qué: cancelar visits en cascada sin que el agent
   se entere puede dejar usuarios con expectativas rotas. Forzar al
   agent a cancelar cada visita individual asegura que se entera de
   cuántos clientes afecta antes de archivar. Cada cancelación
   notifica al user afectado vía notification.

## Referencia visual

- Mockup: `docs/designs/property_management_dashboard/screen.png`
- HTML: `docs/designs/property_management_dashboard/code.html`
- Normalizaciones obligatorias respecto al HTML (decisiones Fase 2 ya
  documentadas en `docs/design-system.md` §"Desviaciones documentadas"):
  - Marca **"Haven" → "LuxeEstate"** (el TopNav del proyecto ya pinta la
    marca correcta; el spec no toca el nav).
  - Tipografía Material Icons + Inter (ya cargadas globalmente).
  - El HTML mete colores ad-hoc (`bg-orange-100`, `text-orange-600`,
    `bg-gray-50/50`, etc.) — se reemplazan por tokens de globals.css.
  - Dark mode fuera de scope MVP (`docs/design-system.md` §"Dark mode").

## Tokens a usar

Solo se mencionan los necesarios para esta pantalla. Todos viven en
`src/app/globals.css` (`@theme`).

### Superficies y texto

- `bg-background` — fondo general (clear-day).
- `bg-surface` — contenedor de tabla, stat cards, dropdowns.
- `bg-surface-hover` — hover de filas de la tabla (4% nordic, ya existe
  como `--color-surface-hover`).
- `text-on-surface` — título "Mis propiedades", nombres de propiedad,
  precios.
- `text-muted` — sublabel "Gestiona tu portafolio…", direcciones, meta
  (beds/baths/sqm), copy de paginación, "Mostrando…", uppercase header.
- `border-divider-soft` — separadores entre filas.
- `border-divider` — borde exterior de la tabla y borde del footer.
- `bg-neutral-50` — fondo del header de tabla (uppercase) y del footer
  de paginación (sutil sobre `surface`).

### Primary / acentos

- `bg-primary` / `text-on-primary` — botón "+ Agregar propiedad",
  botón "Restaurar".
- `bg-primary-soft` / `text-primary` — fondo del avatar-icono de "Total"
  (icon container 40×40 rounded-full).
- `bg-surface-soft` / `text-primary` — fondo del icono "Activas" (verde
  claro hint-green) y badge `Active`.
- `text-primary` / `text-primary-hover` — hover de iconos de acción
  (Edit, Restaurar).

### Estado de badges (status pill)

| status            | Badge variant existente | Notas                                                |
| ----------------- | ----------------------- | ---------------------------------------------------- |
| `active`          | `success` + `withDot`   | hint-green bg + mosque text + dot mosque             |
| `pending`         | `warning` + `withDot`   | warning-soft bg + warning text                       |
| `sold` / `rented` | `neutral` + `withDot`   | neutral-100 bg + muted text + dot muted              |
| `draft`           | `neutral` + `withDot`   | mismo neutral, label "Borrador"                      |
| `archived`        | `neutral` + `withDot`   | mismo neutral, label "Archivada" (solo si toggle ON) |

El `Badge` primitivo (`src/components/ui/Badge.tsx`) ya cubre estas
variantes. Mapeo concentrado en helper `getStatusBadgeProps(status)` en
`src/lib/properties/format.ts` para no duplicar.

### Iconos de stats

- "Total" → `apartment` sobre `bg-primary-soft text-primary`.
- "Activas" → `check_circle` sobre `bg-surface-soft text-primary`.
- "Pendientes" → `pending` sobre `bg-warning-soft text-warning`.

### Acciones (iconos)

- Edit → `edit`, hover `text-primary` + bg `bg-surface-soft`.
- Delete (archivar) → `delete_outline`, hover `text-danger` + bg
  `bg-danger-soft`.
- Restaurar (solo archivadas con toggle ON) → `restore_from_trash` o
  `unarchive`, hover `text-primary` + bg `bg-primary-soft`. Decisión:
  usar `unarchive` (más explícito visualmente).
- Cancelar visita (en dialog) → `event_busy`, color `text-danger`.
- "Abrir en pestaña nueva" (junto al título, opcional) → `open_in_new`,
  `text-muted` size xs, no clickeable individualmente (ornamento visual
  del link). **Decisión**: incluirlo. Aparece a la derecha del título
  con `aria-hidden="true"` para que el screen reader no lo anuncie dos
  veces; el `<a>` ya lleva `aria-label` con sufijo "(se abre en otra
  pestaña)".

## Layout propuesto

Mobile-first. El layout sigue el mockup pero colapsa la tabla a cards
stacked en `<md`. Container del dashboard padded `px-4 sm:px-6 lg:px-8`
y `max-w-7xl mx-auto` (consistente con `(app)/layout.tsx` y con el
mockup). Vertical padding `py-6 md:py-10`.

### Estructura semántica

```
<main>
  <header>                      <!-- Header section -->
    <h1>Mis propiedades</h1>
    <p>Gestiona tu portafolio y revisa rendimiento.</p>
    <div role="toolbar">
      [Filter button] [+ Agregar propiedad]
    </div>
  </header>

  <section aria-label="Resumen">  <!-- 3 stat cards -->
    <DashboardStatCard /> x3
  </section>

  <section aria-label="Propiedades">
    <div role="region" aria-labelledby="..." aria-live="polite">
      <header>                      <!-- Sub-toolbar de la tabla -->
        [Toggle "Ver archivadas"]
        [Header de columnas md+]
      </header>
      <ul role="list">
        <PropertyManagementRow /> x N
      </ul>
      <footer>...</footer>          <!-- Pagination -->
    </div>
  </section>
</main>
```

Usamos `<ul role="list"><li>` en vez de `<table>` real porque:

1. en mobile la cosa se transforma en stack de cards (no es tabla
   tabular semánticamente coherente);
2. simplifica el flexbox/grid y el a11y se cubre con `aria-label`.

Se DOCUMENTA esta decisión en el componente. (Alternativa con `<table>`
en sección "Alternativas consideradas".)

### Header section

- Mobile (`<sm`): título + sublabel arriba, debajo un row con `[Filter]
[+ Agregar]` en `flex gap-2`. Ambos botones `flex-1` para que llenen
  el ancho y "+ Agregar" sea el dominante visual (filled primary).
- `sm+`: título a la izquierda, toolbar `[Filter] [+ Agregar]` a la
  derecha en `flex items-center gap-3`.
- Margin bottom: `mb-6 md:mb-8`.

### Stats overview (3 stat cards)

- Mobile: `grid grid-cols-1 gap-4`.
- `sm+`: `grid grid-cols-3 gap-4 md:gap-6`.
- Cada card: `bg-surface rounded-xl border border-divider-soft shadow-card
p-5`, `flex items-center justify-between`. Label en `text-sm
text-muted font-medium`, número en `text-2xl font-bold text-on-surface
mt-1`. Icon container `h-10 w-10 rounded-full flex items-center
justify-center`.

### Sub-toolbar de la tabla (toggle "Ver archivadas")

Nueva sección entre el header de la página y la tabla. Vive dentro del
contenedor `bg-surface rounded-xl` para que sea visualmente parte de la
tabla.

- Layout: `flex items-center justify-between px-4 sm:px-6 py-3 border-b
border-divider-soft`.
- Izquierda: copy `text-sm text-muted` con el contexto ("Mostrando
  {modo}", donde modo = "propiedades activas" o "incluyendo archivadas").
- Derecha: `<Switch>` propio (Client Component) con label "Ver
  archivadas". Estado refleja el searchParam `?archived=1`. Al togglear,
  `router.replace('/dashboard?...&archived=1|0&page=1')` (reset page).
- A11y: el switch es `<button role="switch" aria-checked>` con label
  asociado.

**Por qué un toggle separado y no parte del dropdown de filtros (R3)**:

1. Es una decisión binaria visualmente importante (afecta toda la
   tabla); merece estar siempre visible, no escondida en un popover.
2. Cuando está ON, la columna "Acciones" cambia para mostrar
   "Restaurar" en filas archivadas — el efecto del toggle es global
   sobre la tabla, no un filtro más.
3. UX más limpia: el dropdown de filtros sigue siendo "qué tipo de
   listing/qué estado", el toggle es "ámbito" (active vs archived).

### Tabla (md+) / Cards stacked (<md)

Contenedor: `bg-surface rounded-xl border border-divider shadow-card
overflow-hidden`.

#### md+ (tabla 12-col)

- Header row sticky-like (no sticky en scroll, solo "label visual"):
  `hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-neutral-50
border-b border-divider-soft text-xs font-semibold text-muted
uppercase tracking-wider`.
- Columnas (modo agent/broker, viewer NO admin):
  - `col-span-6` — "Propiedad" (thumbnail 80×112 + título-link +
    dirección + meta beds/baths/sqm).
  - `col-span-2` — "Precio" (precio + sublabel "Mensual: $X" o
    "Vendida: <fecha>" o vacío).
  - `col-span-2` — "Estado" (Badge).
  - `col-span-2 text-right` — "Acciones" (Edit + Delete o Restaurar).
- Columnas (modo admin, ver R5 abajo):
  - `col-span-4` — "Propiedad".
  - `col-span-2` — "Propietario" (avatar 24×24 + nombre del owner,
    `flex items-center gap-2`, fallback "Sin nombre" si profile sin
    full_name).
  - `col-span-2` — "Precio".
  - `col-span-2` — "Estado".
  - `col-span-2 text-right` — "Acciones".
- Cada fila: `group grid grid-cols-12 gap-4 px-6 py-5 border-b
border-divider-soft hover:bg-surface-hover transition-colors
items-center`. La última fila NO lleva `border-b`.
- Thumbnail: `next/image` `fill` dentro de `relative h-20 w-28
rounded-lg overflow-hidden bg-neutral-100 shrink-0`. Si la property
  no tiene main image, fallback `bg-surface-soft` + `<Icon name="apartment">`.

#### <md (cards stacked)

- Mismo contenedor, sin header de tabla, sin grid de 12 col.
- Cada fila renderiza como **card vertical** dentro del contenedor:
  - `flex flex-col gap-3 p-4 border-b border-divider-soft`.
  - Row 1: thumbnail 80×112 a la izquierda + bloque título/dirección a
    la derecha (`flex gap-4 items-start`). En modo admin, debajo del
    título aparece el chip "por {owner_name}" `text-xs text-muted`.
  - Row 2: meta (beds/baths/sqm) en `flex gap-3 text-xs text-muted`.
  - Row 3: `flex items-center justify-between` con
    `[precio + sublabel]` a la izquierda y `[Badge]` a la derecha.
  - Row 4 (footer del card): acciones alineadas a la derecha
    `flex justify-end gap-2`. En móvil queremos targets táctiles
    cómodos → `IconButton size="md"` (40px).

#### Pagination footer

- `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between
px-4 sm:px-6 py-4 bg-neutral-50 border-t border-divider-soft`.
- Izquierda: copy "Mostrando **X** a **Y** de **Z** resultados"
  (los números en `font-medium text-on-surface`, resto `text-sm
text-muted`).
- Derecha: dos `Button variant="secondary" size="sm"` ("Anterior",
  "Siguiente"). Disabled cuando aplicable (page=1 ⇒ Anterior disabled;
  Y >= Z ⇒ Siguiente disabled).
- Es un `<nav aria-label="Paginación">` semánticamente.

## Componentes

### Reutilizar tal cual

- `src/components/nav/TopNav.tsx` con `variant="dashboard"` — ya pintado
  por `(dashboard)/layout.tsx`. No tocar.
- `src/components/ui/Button.tsx` — usar `primary` (Agregar, Restaurar,
  Cancelar visita), `secondary` (Filter, Anterior/Siguiente),
  `ghost`/`danger` para acciones del dialog.
- `src/components/ui/IconButton.tsx` — para acciones Edit/Delete/
  Restaurar con `variant="ghost"` y `size="md"`. Cambiar color via
  `className` con tokens (hover-text variant ya soportado).
- `src/components/ui/Badge.tsx` — variantes ya cubren los estados.
- `src/components/ui/Icon.tsx` — `apartment`, `check_circle`, `pending`,
  `filter_list`, `add`, `edit`, `delete_outline`, `unarchive`,
  `event_busy`, `open_in_new`, `chevron_left`, `chevron_right`,
  `home_work` (empty state).
- `src/lib/images/get-image-url.ts` — para resolver thumbnails.
- `src/lib/properties/format.ts` — `formatPrice`, `formatArea`. Añadir
  helpers nuevos (ver sección Datos).
- `src/lib/visits/timezone-label.ts` — formateo de `scheduled_at` en
  zona local de la property para `PendingVisitRow`.

### Nuevos componentes

1. **`src/components/dashboard/DashboardStatCard.tsx`** (Server Component).
   Props:

   ```ts
   interface DashboardStatCardProps {
     label: string; // "Total"
     value: number;
     icon: string; // material icon name
     tone: 'primary' | 'success' | 'warning';
   }
   ```

   Renderiza la card del mockup. `tone` mapea a clases token:
   - `primary` → `bg-primary-soft text-primary`
   - `success` → `bg-surface-soft text-primary`
   - `warning` → `bg-warning-soft text-warning`

2. **`src/components/dashboard/PropertyManagementRow.tsx`** (Server
   Component, NO interactivo internamente — los botones son children).
   Props:

   ```ts
   interface PropertyManagementRowProps {
     property: PropertyForManagement; // ver Datos
     viewerMode: 'agent' | 'admin'; // controla columna "Propietario"
   }
   ```

   Renderiza la fila/card según breakpoint (tailwind clases responsive,
   no JS). Internamente compone:
   - thumbnail + título (con link condicional según `linkToPublic`) +
     dirección + meta
   - chip "por {owner_name}" si `viewerMode === 'admin'`
   - precio + sublabel condicional
   - `<Badge>` derivado de `getStatusBadgeProps(status)`
   - acciones condicionales:
     - **Si `listing_status !== 'archived'`**: `<EditPropertyLink>` +
       `<DeletePropertyButton>`.
     - **Si `listing_status === 'archived'`** (toggle ON): solo
       `<RestorePropertyButton>` (sin Edit; editar una archivada
       requiere restaurarla primero — decisión de simplicidad).
   - El título es link a `/property/[id]` (`target="_blank"
rel="noopener noreferrer"`) **solo si**
     `listing_status IN ('active','pending','sold','rented')` — esos
     son los status visibles a anon (mig 0013). Para `draft` y
     `archived`, el título es texto plano (`<span>`) con tooltip
     `title="No disponible públicamente"`.
   - `aria-label` del link incluye sufijo "(se abre en otra pestaña)"
     y el icono `open_in_new` lleva `aria-hidden="true"`.

3. **`src/components/dashboard/DashboardFilters.tsx`** (Client Component
   `'use client'`). Dropdown con:
   - status: All | Active | Pending | Sold | Rented | Draft
   - listing_type: All | Sale | Rent
   - NO incluye `archived` (eso lo controla el toggle separado).
     Trigger: `<Button variant="secondary" leadingIcon="filter_list">
Filtros {activeCount > 0 ? `(${activeCount})` : ''}</Button>`.
     Panel: popover (`absolute right-0 top-full mt-2 w-72 bg-surface
rounded-lg shadow-dropdown border border-divider z-30`) con dos
     bloques de radio buttons + botones "Limpiar" + "Aplicar".
     Comportamiento: al confirmar, usa `useRouter().replace()` con
     `searchParams` `?status=&type=&page=1` (reset page, preserva
     `archived`).
     Cerrar al click outside + Escape.

   **No reutilizamos `FiltersModal` de search** porque:
   - Solo necesitamos 2 filtros muy chicos (no precio/amenities/etc.).
   - Es dropdown anclado al trigger, no modal full-screen.
   - El a11y/focus-trap es más simple aquí.
     Documentado en "Alternativas".

4. **`src/components/dashboard/ArchivedToggle.tsx`** (Client Component
   `'use client'`). Switch que sincroniza el searchParam `?archived=1`.
   Props: `{ initial: boolean }` (deriva el initial desde el server
   search param para evitar hydration mismatch). Al togglear,
   `router.replace(...)` reset `?page=1`. UI: `role="switch"` con
   label "Ver archivadas" + tooltip explicativo ("Incluye propiedades
   archivadas. Las archivadas no son visibles al público.").

5. **`src/components/dashboard/DeletePropertyButton.tsx`** (Client
   Component). Renderiza el IconButton de delete y, al click, abre un
   `DeleteConfirmDialog` controlado. Props:

   ```ts
   interface DeletePropertyButtonProps {
     propertyId: string;
     propertyTitle: string;
   }
   ```

   Estado interno: `isOpen`, `isPending` (de `useTransition`),
   `pendingVisits` (lista refrescable). Flujo:
   1. Al abrir, hace `fetch` o llama a Server Action lightweight
      `getPendingVisitsForProperty({ propertyId })` que devuelve la
      lista de visits con `status IN ('pending','confirmed',
'rescheduled')` y `scheduled_at > now()` (decisión: server
      action, no rest endpoint nuevo, así reutilizamos la cookie de
      sesión y RLS).
   2. Si la lista viene vacía → muestra el flujo "simple" (mensaje +
      botón Archivar).
   3. Si la lista trae visits → muestra el flujo "bloqueado" (lista
      de visits con botón "Cancelar" individual + nota explicativa).
      El botón principal "Archivar" NO aparece (se renderiza
      deshabilitado con tooltip o directamente oculto). Decisión:
      **oculto**; aparece tan pronto como `pendingVisits.length === 0`.
   4. Cada `cancelVisit({ visitId })` actualiza el estado optimista
      (saca la visit del array). Si la action falla, re-añadimos la
      visit con error inline.

6. **`src/components/dashboard/DeleteConfirmDialog.tsx`** (Client).
   Diálogo modal accesible (sin Radix; mismo patrón div + focus trap
   propio que `FiltersModal`). Dos modos:
   - **Modo "bloqueado"** (`pendingVisits.length > 0`):
     - Título: "No podés archivar todavía"
     - Copy: "Hay {N} visita(s) pendiente(s) para "{title}". Cancela
       cada una para poder archivar la propiedad."
     - Lista de `<PendingVisitRow>` (ver componente 7).
     - Footer: solo botón "Cerrar" (ghost).
   - **Modo "simple"** (`pendingVisits.length === 0`):
     - Título: "Archivar "{title}""
     - Copy: "La propiedad dejará de listarse y desaparecerá del
       público. Puedes restaurarla más tarde desde el dashboard
       activando "Ver archivadas"."
     - Footer: `Cancelar` (ghost) + `Archivar` (danger, loading
       state).
   - Cuando el usuario cancela visits en modo "bloqueado" hasta llegar
     a 0, el dialog **transiciona automáticamente** a modo "simple"
     (el componente decide por la longitud de `pendingVisits`).

7. **`src/components/dashboard/PendingVisitRow.tsx`** (Client). Fila
   dentro del dialog en modo "bloqueado". Props:

   ```ts
   interface PendingVisitRowProps {
     visit: {
       id: string;
       scheduledAt: string; // ISO
       propertyTimezone: string; // 'America/Mexico_City' default
       userDisplayName: string;
     };
     onCancelled: (visitId: string) => void; // callback al parent
   }
   ```

   Layout: `flex items-center justify-between gap-3 py-3 border-b
border-divider-soft last:border-b-0`.
   - Izquierda: `<Icon name="event">` + texto "{fecha} · {hora}"
     formateado con `Intl.DateTimeFormat` en `propertyTimezone` +
     subtexto "Agendada por {userDisplayName}" (text-xs muted).
   - Derecha: `<Button variant="danger" size="sm"
leadingIcon="event_busy">Cancelar</Button>` con `loading` state
     de su propio `useTransition`. Al éxito, llama a `onCancelled(id)`
     para que el parent saque la visit de la lista.
   - Errores: alert inline (text-danger text-xs) si la action falla.

8. **`src/components/dashboard/RestorePropertyButton.tsx`** (Client).
   IconButton + confirm dialog mini (más simple que delete: no hay
   guard de visits aquí porque la propiedad estaba archivada y sus
   visits ya están canceladas — son condición previa al archivado).
   Props: `{ propertyId: string; propertyTitle: string }`.
   Confirm dialog:
   - Título: "Restaurar "{title}""
   - Copy: "Volverá a publicarse como Activa. Si quieres dejarla en
     borrador, edítala después de restaurar."
   - Botones: `Cancelar` (ghost) + `Restaurar` (primary, loading).
   - Llama a `restoreProperty({ id })`.

9. **`src/components/dashboard/DashboardEmptyState.tsx`** (Server). Para
   cuando el agent no tiene properties. Card grande dentro del
   contenedor de tabla con icono `home_work`, título "Aún no tienes
   propiedades" + copy + CTA `<Link href="/dashboard/properties/new">
   <Button leadingIcon="add">Agregar tu primera propiedad</Button>
   </Link>`.

10. **`src/components/dashboard/DashboardPagination.tsx`** (Server
    Component que renderiza dos `<Link>` o un Client mínimo). Recibe
    `{ page, pageSize, total, baseHref, currentSearchParams }`.
    Renderiza `Mostrando X a Y de Z` + dos botones. Implementación más
    simple: Server Component que renderiza `<Link>` envolviendo los
    Buttons, pasándole los searchParams actuales con `?page=N`
    reemplazado. Cuando un extremo no aplica, renderiza un
    `<Button disabled>` sin `<Link>`.

### Index / barrel

Agregar `src/components/dashboard/index.ts` re-exportando los nuevos
componentes.

## Tipografía

Inter en todos los pesos requeridos. Mapeo a la escala documentada
(`docs/design-system.md` §"Tipografía"):

- Título "Mis propiedades" → `headline-1` ⇒ `text-3xl font-bold
text-on-surface tracking-tight`.
- Sublabel "Gestiona tu portafolio…" → `body` ⇒ `text-sm text-muted
mt-1`.
- Stats label → `text-sm font-medium text-muted`.
- Stats número → `text-2xl font-bold text-on-surface mt-1`.
- Table header columns → `text-xs font-semibold text-muted uppercase
tracking-wider` (overline-ish).
- Property title (fila) → `text-base md:text-lg font-bold
text-on-surface group-hover:text-primary transition-colors`.
- Property address → `text-sm text-muted`.
- Property meta (beds/baths/sqm) → `text-xs text-muted` con
  iconos `size="xs"` (14px).
- Owner chip (modo admin) → `text-xs text-muted` con prefijo "por ".
- Precio → `text-base font-semibold text-on-surface`.
- Sublabel precio ("Mensual: $X" / "Vendida: <fecha>") → `text-xs
text-muted`.
- Paginación copy → `text-sm text-muted`, énfasis con
  `font-medium text-on-surface`.
- PendingVisit row fecha → `text-sm font-medium text-on-surface`.
- PendingVisit row sublabel → `text-xs text-muted`.

## Datos

### Queries

Decisión: **crear `src/lib/dashboard/queries.ts`** en lugar de mezclar
con `src/lib/properties/queries.ts`. Razón:

- `properties/queries.ts` está pensado para listings públicos (cards,
  filtros active). Aquí necesitamos listar **todos los status de un
  owner** (incluido draft/archived). El shape difiere.
- Reutilizamos los enums y `getImageUrl` desde donde ya viven.

Tipo del row management:

```ts
export interface PropertyForManagement {
  id: string;
  title: string;
  address_line: string;
  city: string;
  price: number;
  listing_type: ListingType;
  listing_status: ListingStatus;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  published_at: string | null;
  updated_at: string;
  main_image: { storage_path: string; alt_text: string | null } | null;
  owner_id: string;
  // Solo poblado cuando viewer es admin. NULL en modo agent.
  owner_profile: { full_name: string | null; avatar_url: string | null } | null;
}
```

Funciones:

```ts
// Lista paginada del agent (o todas si es admin).
export interface DashboardListOptions {
  page: number;                       // 1-based
  pageSize: number;                   // 10
  status: ListingStatus | null;       // null = todas (excepto archived, controlado por includeArchived)
  listingType: ListingType | null;    // null = todas
  scope: 'mine' | 'all';              // 'all' solo si role === 'admin'
  userId: string;                     // owner_id si scope='mine'
  includeArchived: boolean;           // del toggle "Ver archivadas"
}
export interface DashboardListResult {
  items: PropertyForManagement[];
  total: number;
}
export async function listManagementProperties(
  supabase, opts
): Promise<DashboardListResult> { ... }

// Counts agregados para los 3 stat cards. NO dependen del toggle ni de
// los filtros (los stats son globales del scope).
export interface DashboardStats {
  total: number;        // INCLUYE archivadas (decisión R1)
  active: number;
  pendingSale: number;  // listing_status='pending'
}
export async function getDashboardStats(
  supabase, scope: { kind: 'mine' | 'all'; userId: string }
): Promise<DashboardStats> { ... }

// Para el delete dialog: lee visits pendientes futuras de una property.
// Server Action en src/lib/visits/queries.ts (no actions porque solo lee).
export interface PendingVisitForDialog {
  id: string;
  scheduled_at: string;
  property_timezone: string;
  user_display_name: string;
}
export async function getPendingVisitsForProperty(
  supabase, propertyId: string
): Promise<PendingVisitForDialog[]> { ... }
```

### Implementación

- `listManagementProperties` usa `.select(..., { count: 'exact' })` con
  filtros en server. Joins:
  - `properties` ⟕ `property_images` (left, sin inner — un agent puede
    tener un draft sin imágenes). Elegir main en JS, igual que en
    `toPropertyForCard`.
  - **Si `scope === 'all'`** (admin): join con `profiles` para traer
    `owner_profile` (`profiles!properties_owner_id_fkey(full_name,
avatar_url)`). En modo `'mine'`, omitir el join (NULL en el campo).
  - Filtro de archived:
    - Si `includeArchived === false`: `.neq('listing_status',
'archived')`.
    - Si `includeArchived === true`: **no** filtramos por status
      directamente; los archived aparecen mezclados con el resto.
  - Filtro de status del dropdown: si `status !== null`, agregar
    `.eq('listing_status', status)` AFTER del filtro de archived.
    Edge case: si el dropdown elige "active" pero `includeArchived`
    es true, prevalece el filtro del dropdown (no aparece archived).
- `getDashboardStats` hace **tres** queries en paralelo con
  `count: 'exact', head: true`:
  - total: `from('properties').eq('owner_id', userId)` (o sin filtro
    para admin) — **INCLUYE archived** (decisión R1).
  - active: `+ .eq('listing_status', 'active')`.
  - pending: `+ .eq('listing_status', 'pending')`.

- **Orden por defecto: `updated_at desc nulls last`** (decisión R2).
  Verificación: `properties.updated_at` existe (mig 0003) con default
  `now()` y trigger `properties_set_updated_at` que lo actualiza en
  cada UPDATE. NO se necesita fallback en runtime. Si por algún motivo
  futuro la columna se elimina (no esperado), el implementer cambia el
  `.order('updated_at', ...)` por `.order('created_at', ...)` —
  documentado aquí.

- Pagination: `range((page-1)*pageSize, page*pageSize-1)`.

- `getPendingVisitsForProperty`:
  - SELECT `id, scheduled_at, properties.timezone, profiles.full_name`
    (join inner a profiles via `user_id`).
  - WHERE `property_id = ?` AND `status IN ('pending', 'confirmed',
'rescheduled')` AND `scheduled_at > now()`.
  - ORDER BY `scheduled_at asc`.
  - RLS: la policy `visits_select_participant_or_admin` deja al agent
    (owner de la property → es `agent_id` vía trigger
    `validate_visit_agent`) leer sus visits — no se necesita policy
    nueva.

### Page contract (Server Component)

`src/app/(dashboard)/dashboard/page.tsx` (corrección post-spec):
el route group `(dashboard)` no aporta segmento URL, así que ubicar el
archivo en `(dashboard)/page.tsx` resolvería a `/` y colisionaría con
`(app)/page.tsx`. La URL pedida es `/dashboard`, por lo que el archivo
debe vivir bajo un segmento físico `dashboard/`. Mismo razonamiento
para `loading.tsx` y `error.tsx`.

```ts
type SearchParams = Promise<{
  page?: string;
  status?: 'active' | 'pending' | 'sold' | 'rented' | 'draft';
  type?: 'sale' | 'rent';
  archived?: '0' | '1';
}>;
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const includeArchived = sp.archived === '1';
  // ... parse status/type defensivamente
  const session = await getSessionAndProfile();
  const isAdmin = session.profile.role === 'admin';
  const scope = isAdmin ? 'all' : 'mine';
  // queries en paralelo (stats + list)
  // render
}
```

`await searchParams` y `await params` son obligatorios en Next 16
(documentado en AGENTS.md "Reglas duras").

## Interactividad

- **Server por defecto**: la página `(dashboard)/dashboard/page.tsx`, el row, las
  stat cards, el empty state y la pagination son Server Components.
- **Client** (`'use client'`):
  - `DashboardFilters` — necesita estado local del popover y
    `useRouter`.
  - `ArchivedToggle` — switch sincronizado con URL.
  - `DeletePropertyButton` — abre dialog + `useTransition`.
  - `DeleteConfirmDialog` — focus trap + tecla Escape + estado de
    `pendingVisits`.
  - `PendingVisitRow` — `useTransition` para cancelar.
  - `RestorePropertyButton` — confirm dialog + `useTransition`.

### Server Actions

Todas en `src/lib/properties/actions.ts` excepto `cancelVisit` que va
en `src/lib/visits/actions.ts` (donde ya vive `scheduleVisit`).

#### `archiveProperty(input: { id })`

```ts
export type ArchivePropertyResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code:
          | 'unauthenticated'
          | 'forbidden'
          | 'not_found'
          | 'invalid'
          | 'pending_visits'
          | 'server';
        message: string;
      };
    };
```

Flujo:

1. zod: `{ id: z.string().uuid() }`.
2. `supabase.auth.getUser()` → `unauthenticated` si null.
3. SELECT `owner_id, listing_status` FROM properties WHERE id =
   → `not_found` si null.
4. Role check: `profile.role === 'admin'` OR `owner_id === user.id`
   → `forbidden` si no.
5. **Guard server-side de visits pendientes**: COUNT visits con
   `property_id = ?` AND `status IN ('pending','confirmed',
'rescheduled')` AND `scheduled_at > now()` → si > 0, devolver
   `pending_visits` con mensaje "Cancela las visitas pendientes antes
   de archivar." Esto es defensa en profundidad — el UI ya impide
   llegar acá, pero un cliente saltándose el dialog debe ser
   rechazado.
6. UPDATE properties SET listing_status = 'archived' WHERE id = ?
   (RLS también protege; check explícito es defensa en profundidad).
7. `revalidatePath('/dashboard')`, `revalidatePath('/')`,
   `revalidatePath('/property/${id}')`.

#### `restoreProperty(input: { id })` (NUEVA)

```ts
export type RestorePropertyResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'not_archived' | 'server';
        message: string;
      };
    };
```

Flujo:

1. zod: `{ id: z.string().uuid() }`.
2. `getUser()` → `unauthenticated`.
3. SELECT `owner_id, listing_status` → `not_found`.
4. Role check: admin OR owner → `forbidden`.
5. Si `listing_status !== 'archived'` → `not_archived` ("La propiedad
   no está archivada.") — defensa contra clicks duplicados.
6. UPDATE properties SET `listing_status = 'active'` WHERE id = ?.
   Decisión: NO guardamos el status previo. Si el agent quiere
   dejarla en `draft`, edita después.
7. `revalidatePath('/dashboard')`, `revalidatePath('/')`,
   `revalidatePath('/property/${id}')`.

#### `cancelVisit(input: { visitId })` (NUEVA, en visits/actions.ts)

```ts
export type CancelVisitResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code:
          | 'unauthenticated'
          | 'forbidden'
          | 'not_found'
          | 'invalid'
          | 'already_cancelled'
          | 'past_visit'
          | 'server';
        message: string;
      };
    };
```

Flujo:

1. zod: `{ visitId: z.string().uuid() }`.
2. `getUser()` → `unauthenticated`.
3. SELECT `id, agent_id, user_id, property_id, status, scheduled_at`
   FROM visits WHERE id = ? → `not_found` si null.
4. Role check: admin OR `agent_id === user.id` → `forbidden`.
   (`agent_id` siempre es el owner de la property por el trigger
   `validate_visit_agent` de mig 0007.)
5. Si `status NOT IN ('pending','confirmed','rescheduled')` →
   `already_cancelled`.
6. Si `scheduled_at <= now()` → `past_visit` ("No se pueden cancelar
   visitas pasadas.").
7. UPDATE visits SET `status = 'cancelled'` WHERE id = ?.
   **Decisión sobre status**: el enum `visit_status` (mig 0001) NO
   incluye `cancelled_by_agent`. Solo `cancelled`. Para no agregar un
   valor al enum (cambio invasivo del schema), usamos `cancelled` y
   distinguimos quién canceló mediante una notification con copy
   específico. Si en el futuro se requiere granularidad, se agrega el
   valor al enum en migración aparte.
8. **Notificación al user**: ver "Migraciones requeridas" — usamos un
   trigger AFTER UPDATE sobre `visits` que se dispara cuando
   `status` cambia a `cancelled` AND el caller no es el `user_id` (=
   fue cancelada por el agent o admin), e inserta una notification
   al `user_id` con copy "Tu visita a "{property_title}" del {date}
   fue cancelada por el agente.". Esto es análogo al trigger de mig
   0017 que notifica al agent en INSERT.
9. `revalidatePath('/dashboard')`, `revalidatePath('/profile')`,
   `revalidatePath('/visits')`.

#### `getPendingVisitsForProperty(input: { propertyId })`

Query helper, **no es una mutación**, pero la implementamos como
Server Action (`'use server'`) para invocarla desde el Client en
on-open del dialog sin necesidad de un endpoint REST. Devuelve la
lista o un error tipado `{ code: 'forbidden' | 'server' }`.

Vive en `src/lib/visits/queries.ts` re-exportada con `'use server'`
en una wrapper en `src/lib/dashboard/server-fetch.ts` (patrón seguido
en otras pantallas) **o** directamente como server action en
`src/lib/properties/actions.ts`. Decisión: ponerla como server action
en `src/lib/visits/actions.ts` (un solo archivo, junto a las otras
mutaciones de visits). El nombre formal:

```ts
export async function getPendingVisitsForArchive(input: {
  propertyId: string;
}): Promise<
  | { ok: true; visits: PendingVisitForDialog[] }
  | { ok: false; error: { code: 'unauthenticated' | 'forbidden' | 'server'; message: string } }
>;
```

Mismos checks de owner que `archiveProperty`.

## Estados

### Loading

Como la página es Server Component sin streaming opcional, el browser
ya ve el HTML completo cuando llega. Aún así:

- Añadir `src/app/(dashboard)/loading.tsx` que renderiza un **skeleton**
  con la misma estructura: header pintado, 3 skeleton stat cards
  (`h-24 rounded-xl bg-neutral-100 animate-pulse`), 10 filas skeleton
  (`h-24 ... animate-pulse`), footer skeleton.
- Loading de la Server Action (delete/restore): controlado en los
  Client Components con `useTransition`. El botón pasa a
  `loading={isPending}` (el Button primitivo ya soporta).
- Loading inicial del dialog (mientras `getPendingVisitsForArchive`
  responde): mostrar 2 filas skeleton dentro del dialog.

### Empty

- **Sin properties en total**: renderizar `<DashboardEmptyState>`
  ocupando el contenedor de tabla. NO pintar el header de columnas ni
  la paginación. La sub-toolbar (toggle "Ver archivadas") tampoco
  aparece. Las stat cards siguen visibles (con 0).
- **Con properties pero filtro devuelve 0**: en lugar de empty state
  full, pintar dentro del contenedor un mensaje compacto: "No se
  encontraron propiedades con los filtros aplicados. [Limpiar filtros]"
  con botón ghost que limpia `?status=&type=` vía `<Link href="
/dashboard">`. Stats siguen reflejando totales globales (no del
  filtro), para que el agent sepa cuántas tiene en total.
- **Toggle ON, sin archivadas**: dentro del contenedor, mensaje
  compacto "No tienes propiedades archivadas. [Volver a activas]"
  (link que setea `?archived=0`).

### Error

- Si `listManagementProperties` o `getDashboardStats` lanzan, el
  Server Component deja propagar y Next renderiza el `error.tsx`.
- Añadir `src/app/(dashboard)/error.tsx` que muestra una card con
  título "No pudimos cargar tu dashboard" + descripción + botón "Reintentar"
  (`reset` prop).
- Server Actions devuelven siempre el shape `{ ok, error }` — los
  dialogs pintan `error.message` (en español) sin exponer detalles.

## Acciones

| Acción          | Trigger                                        | Comportamiento                                                                                  |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Agregar         | Botón "+ Agregar propiedad"                    | `<Link href="/dashboard/properties/new">` — esa ruta NO existe aún; aceptamos 404 transitorio.  |
| Abrir preview   | Click sobre el título de una property visible  | `<a href="/property/[id]" target="_blank" rel="noopener noreferrer">` — solo si status público. |
| Editar          | IconButton fila (no archivadas)                | `<Link href="/dashboard/properties/[id]/edit">` — 404 aún esperado.                             |
| Archivar        | IconButton fila → Dialog (con guard de visits) | `archiveProperty({ id })` Server Action; revalidatePath dashboard + home + detalle.             |
| Restaurar       | IconButton fila (solo archivadas, toggle ON)   | `restoreProperty({ id })` Server Action; revalidatePath dashboard + home + detalle.             |
| Cancelar visita | Botón en `PendingVisitRow` del delete dialog   | `cancelVisit({ visitId })` Server Action; trigger DB notifica al user; row sale de la lista.    |
| Filtrar         | Botón "Filtros" → popover → "Aplicar"          | `router.replace(/dashboard?status=&type=&page=1)` (preserva `archived`).                        |
| Ver archivadas  | Switch en sub-toolbar                          | `router.replace(/dashboard?archived=1&page=1)` (preserva `status`, `type`).                     |
| Paginar         | "Anterior" / "Siguiente"                       | `<Link>` con `?page=N` (preserva otros searchParams).                                           |

Notas explícitas:

- Las 2 primeras acciones (Add/Edit) apuntan a rutas que todavía no
  existen. Deuda esperada y documentada en `feature_list.json` →
  `add_edit_property_form`.
- El link "Abrir preview" del título **no** aparece para `draft` ni
  `archived`. Para esos status, el título se renderiza como `<span>`
  con `title="No disponible públicamente"`.

## Pagination

- Tamaño de página: **10** (acceptance del feature_list).
- searchParam: `?page=N` (1-based). Default 1.
- Copy: "Mostrando **{X}** a **{Y}** de **{Z}** resultados", con `X =
(page-1)*pageSize + 1`, `Y = min(page*pageSize, total)`, `Z = total`.
  Si total = 0, no se renderiza el footer.
- Anterior disabled si `page === 1`. Siguiente disabled si
  `page * pageSize >= total`.
- El componente `DashboardPagination` lee `currentSearchParams` (que
  vienen del page) para preservar `status`, `type` y `archived` al
  cambiar `page`.

## Filter button

- Componente: `DashboardFilters` (Client).
- searchParams sincronizados:
  - `?status=active|pending|sold|rented|draft` (omitir = todas; NO
    incluye `archived` aquí).
  - `?type=sale|rent` (omitir = todas).
- Al aplicar, reset `?page=1`. Preserva `?archived`.
- "Limpiar" elimina ambos params y `page` (NO toca `archived`).
- Cuenta `activeCount = (status ? 1 : 0) + (type ? 1 : 0)`; el trigger
  muestra `"Filtros (N)"` cuando `activeCount > 0`.

A11y:

- Trigger: `<button aria-haspopup="dialog" aria-expanded>` y label.
- Popover: `role="dialog"` con `aria-label="Filtros del dashboard"`.
- Focus al primer radio cuando abre. Restore focus al trigger al
  cerrar. Cerrar con Escape y click outside.

## Guards y RLS

### Guard de capa

- `src/app/(dashboard)/layout.tsx` (ya existente, leído en este
  análisis) redirige a `/login?next=/dashboard` si no hay sesión y a
  `/` si role ∉ {agent, broker, admin}. **No tocar.**
- `src/lib/supabase/proxy.ts` ya tiene `/dashboard` en `protectedPaths`.
  **No tocar.** Esto se confirma en `CLAUDE.md` §"Shell público +
  protección por middleware" y se relee al iniciar implementación.

### RLS efectivo

**properties** (mig 0003):

```
properties_select_public_or_own: authenticated puede ver
  listing_status in ('active','pending','sold','rented')
  OR owner_id = auth.uid()
  OR is_admin()
```

- Para `agent`/`broker`: la query agrega filtro explícito
  `.eq('owner_id', userId)` (`scope: 'mine'`).
- Para `admin`: `is_admin()` permite ver todo (`scope: 'all'`, sin
  filtro owner_id).
- Update: `properties_update_own_or_admin` permite archive/restore.

**visits** (mig 0007):

```
visits_select_participant_or_admin: user_id = auth.uid()
  OR agent_id = auth.uid()
  OR is_admin()
visits_update_participant_or_admin: same conditions
```

- Para cancelar visit como agent: `agent_id = auth.uid()` cubre el
  caso (el `agent_id` siempre = `properties.owner_id` por el trigger
  `validate_visit_agent`). **No se necesita policy nueva.**
- Para que el trigger AFTER UPDATE inserte la notification: la función
  debe ser SECURITY DEFINER (como `notify_agent_on_visit_insert` en
  mig 0017). Ver "Migraciones requeridas".

**notifications** (mig 0009):

- INSERT no tiene policy → bloqueado a clientes. Solo los triggers
  SECURITY DEFINER pueden insertar.
- Por eso `cancelVisit` NO inserta notifications desde el código de
  la Server Action; lo delega al trigger DB.

### Helpers a verificar

- `is_admin()` debe ser EXECUTE-able por `authenticated` (lo es desde
  la migración 0015, documentado en CLAUDE.md). Sin esto, la query
  fallaría con 42501 al pegar contra cualquier tabla que use
  `is_admin()` en su policy.

## Migraciones requeridas

**El implementer debe crear y aplicar esta migración nueva. NO se
aplica ahora.**

### `0018_visits_notify_user_on_cancel.sql`

Propósito: cuando un agent (o admin) cancela una visita, notificar al
user que la había agendado. Análogo al trigger
`notify_agent_on_visit_insert` de mig 0017.

```sql
-- 0018_visits_notify_user_on_cancel.sql
-- Notifica al user cuando su visita es cancelada por alguien que no es
-- él mismo (agent o admin). Análogo a notify_agent_on_visit_insert
-- (mig 0017). Necesaria para que cancelVisit() pueda informar al user
-- afectado sin exponer service_role.

create or replace function public.notify_user_on_visit_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prop_title text;
  prop_tz text;
  formatted_local text;
begin
  -- Solo dispara cuando status pasa a 'cancelled' y NO fue el propio
  -- user quien canceló (lo cancela el agent o admin).
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;
  if auth.uid() = new.user_id then
    -- El user canceló su propia visita; no notificamos.
    return new;
  end if;

  select p.title, p.timezone into prop_title, prop_tz
  from public.properties p
  where p.id = new.property_id;

  formatted_local := to_char(
    new.scheduled_at at time zone coalesce(prop_tz, 'America/Mexico_City'),
    'DD/MM/YYYY HH24:MI'
  );

  insert into public.notifications (
    recipient_id, type, title, body,
    property_id, visit_id, read_at, created_at
  ) values (
    new.user_id,
    'system',
    'Tu visita fue cancelada',
    coalesce(
      'Tu visita a "' || prop_title || '" del '
      || formatted_local || ' fue cancelada por el agente.',
      'Tu visita fue cancelada por el agente.'
    ),
    new.property_id,
    new.id,
    null,
    now()
  );
  return new;
end;
$$;

drop trigger if exists visits_notify_user_on_cancel on public.visits;
create trigger visits_notify_user_on_cancel
  after update on public.visits
  for each row execute function public.notify_user_on_visit_cancel();
```

**Notas para el implementer**:

- No se otorga EXECUTE a `authenticated`/`anon` (solo el motor de
  triggers la invoca). Mismo patrón que `notify_agent_on_visit_insert`.
- El `notification_type` usado es `'system'` porque el enum (mig 0001)
  NO tiene `visit_cancelled`. Si después se quiere granularidad, se
  agrega el valor al enum en otra migración.
- Verificar con `get_advisors` que no aparezcan warnings nuevos tras
  aplicar.

**NO se requiere migración** para:

- Policies de visits — la policy `visits_update_participant_or_admin`
  ya permite al agent cancelar (agent_id = auth.uid()).
- Enum visit_status — usamos `'cancelled'` que ya existe.
- Tabla properties — `updated_at` ya existe (mig 0003).

## Notas

- **A11y**:
  - `<main>` ya está en el layout dashboard con `tabIndex={-1}` e
    `id="main-content"`.
  - Stat cards en `<section aria-label="Resumen">` con `<dl><dt><dd>`
    para que screen readers lean "Total: 24" como par término/valor.
  - Tabla mobile: cada card lleva `aria-labelledby` apuntando al título
    de la propiedad.
  - IconButtons llevan `aria-label` dinámicos: "Editar {title}",
    "Archivar {title}", "Restaurar {title}".
  - Link del título (cuando público): `aria-label="Ver "{title}" en
pestaña nueva"`.
  - Switch "Ver archivadas": `role="switch"` con `aria-checked` y
    `<label>` asociado.
  - Focus visible: ya viene de las primitivas.
  - Contraste: todos los pares token cumplen 4.5:1 (mosque sobre
    blanco, nordic sobre clear-day, muted sobre surface — verificados
    en `docs/design-system.md`).
- **i18n** (interno al MVP, español únicamente): textos directos en
  JSX. Lista mínima:
  - "Mis propiedades", "Gestiona tu portafolio y revisa rendimiento."
  - "Filtros", "Agregar propiedad", "Ver archivadas"
  - "Total", "Activas", "Pendientes"
  - "Propiedad", "Propietario", "Precio", "Estado", "Acciones"
  - "{N} habs", "{N} baños", "{X} m²"
  - "Mensual: {price}", "Vendida: {date}", "Rentada: {date}"
  - "Activa", "Pendiente", "Vendida", "Rentada", "Borrador",
    "Archivada"
  - "Editar {title}", "Archivar {title}", "Restaurar {title}"
  - "por {owner_name}"
  - "Anterior", "Siguiente"
  - "Mostrando {X} a {Y} de {Z} resultados"
  - "Aún no tienes propiedades", "Agregar tu primera propiedad"
  - "No se encontraron propiedades con los filtros aplicados.",
    "Limpiar filtros"
  - "No tienes propiedades archivadas.", "Volver a activas"
  - Dialog archivar (modo simple): "Archivar "{title}"", copy y
    "Cancelar"/"Archivar".
  - Dialog archivar (modo bloqueado): "No podés archivar todavía",
    "Hay {N} visita(s) pendiente(s) para "{title}". Cancela cada una
    para poder archivar la propiedad.", "Cerrar".
  - Dialog restaurar: "Restaurar "{title}"", "Volverá a publicarse
    como Activa. Si quieres dejarla en borrador, edítala después de
    restaurar.", "Cancelar"/"Restaurar".
  - PendingVisitRow: "Agendada por {nombre}", "Cancelar visita".
  - Notification copy (en trigger SQL): "Tu visita fue cancelada",
    "Tu visita a "{title}" del {fecha} fue cancelada por el agente."
  - Tooltip "No disponible públicamente".

## Alternativas consideradas

### A. `<table>` semántico real vs `<ul role="list">`

- **A.1** `<table>`: gana en a11y de escritorio (screen reader navega
  con shortcuts de tabla), pero rompe en mobile cuando la cosa se
  transforma en cards stacked y pierde la grilla. Requiere CSS dual
  (`display: table` en md+, `display: block` en mobile) y los `<td>`
  reflowed se vuelven raros.
- **A.2** `<ul role="list">` con `aria-label`: el screen reader anuncia
  "lista, N elementos" y cada `<li>` se lee como entidad coherente en
  mobile y desktop. Pierde shortcuts de tabla, pero gana consistencia.
- **Recomendación**: **A.2**. La pantalla no es tabular en el sentido
  estricto (cada fila es una entidad rica con thumbnail + meta + CTAs);
  la grilla 12-col es presentacional. A.2 simplifica el código y a11y
  resulta clara en ambos breakpoints.

### B. Filtros: dropdown propio vs reutilizar `FiltersModal`

- **B.1** Reutilizar `FiltersModal`: ya existe, ya hace focus-trap, ya
  sincroniza searchParams. Contra: tiene UI/UX de búsqueda full
  (price slider, amenities, beds counter) que no aplica acá; aparece
  como bottom-sheet en mobile, lo cual rompe el patrón del dashboard.
- **B.2** Dropdown propio `DashboardFilters`: solo 2 filtros, anclado
  al trigger con popover compacto, sin amenities/precio. Mas simple,
  visualmente correcto al mockup.
- **Recomendación**: **B.2**. Crear un componente nuevo de ~80 líneas
  es más limpio que cargar `FiltersModal` con flags para esconder lo
  que no aplica. Permite además un counter sobre el trigger ("Filtros
  (2)") sin lógica especial.

### C. Soft delete: `archived` vs columna `deleted_at`

- **C.1** Setear `listing_status = 'archived'` (existe en el enum
  desde mig 0001). Reusa lo que está, RLS de SELECT ya excluye
  archived para anon (mig 0013 filtra por `active`).
- **C.2** Agregar columna `deleted_at timestamptz` + migración + tocar
  todas las queries con `is null`. Más invasivo y duplica un concepto
  que el enum ya cubre.
- **Recomendación**: **C.1**, idéntica a lo que dice el acceptance del
  feature_list.

### D. Cancelar visits: status nuevo `cancelled_by_agent` vs reusar `cancelled`

- **D.1** Agregar `cancelled_by_agent` al enum `visit_status`. Permite
  distinguir cancelaciones en queries futuras (analytics, reportes).
  Contra: cambio invasivo del schema (ALTER TYPE), forces a auditar
  todas las queries que comparen `status`.
- **D.2** Reusar `cancelled` y distinguir vía notification (y un campo
  `cancelled_by` futuro en una migración si se necesita). Más simple,
  el user afectado recibe contexto en la notification.
- **Recomendación**: **D.2**. Para el MVP el dato de "quién canceló"
  vive en la notification ("fue cancelada por el agente"). Si más
  adelante un dashboard de analytics lo requiere, se agrega el valor
  al enum.

### E. Restaurar: volver a `active` vs guardar status previo

- **E.1** Guardar el status previo (`status_before_archive` columna)
  y restaurarlo. Más fiel a la intención original.
- **E.2** Volver siempre a `active`. Simple, predecible. Si el agent
  quería `draft`, puede editar.
- **Recomendación**: **E.2** (decisión del humano R3). El 99% de las
  veces el agent archivó algo que era activo. El caso "tenía un draft
  archivado" es marginal y se resuelve con un click extra de edición.

## Riesgos

- **R6 — ¿RLS anon expone archived?** (heredado de la v1; aún
  pendiente de verificación en runtime).
  Migración 0013 abre `properties` a `anon` para select **filtrando
  por `listing_status = 'active'`**. Verificación rápida durante
  implementación: leer el contenido de
  `0013_anon_select_active_properties.sql` antes de codear; si la
  policy fuera más laxa, archivar no quitaría la propiedad del público
  y la deuda escala a migración correctiva (no parte de esta feature).
  El test de aceptación correspondiente cubre el caso end-to-end.

- **R-NEW1 — Carrera entre cancelar visit y archivar.**
  Si el agent cancela la última visita en el dialog y otro user
  agenda una nueva en el mismo instante, el guard server-side de
  `archiveProperty` (paso 5) lo detecta y devuelve `pending_visits`.
  El cliente re-fetcheará la lista (en una próxima vez que el dialog
  se abra) o mostrará el error. Aceptable: el caso es marginal y la
  defensa server-side es la garantía.

- **R-NEW2 — Trigger `notify_user_on_visit_cancel` requiere
  `auth.uid()`.**
  El trigger usa `auth.uid()` para decidir si NO notificar (el user
  se cancela a sí mismo). En contextos donde `auth.uid()` es null
  (e.g., service_role, jobs en background), el trigger SÍ enviará
  la notificación. Hoy no tenemos jobs cancelando visits, así que el
  caso no se da. Documentado para el futuro: si se agrega un cron
  que cancele visits expiradas, hay que ajustar el trigger para no
  notificar.

## Criterios de aceptación verificables

Lista para tildar en review humano:

### Renderizado y layout

- [ ] Página `/dashboard` carga sin errores para role agent/broker/
      admin y redirige correctamente para role user (validar manual:
      seed user vs seed agent).
- [ ] Stats overview muestra 3 counters reales del DB (Total /
      Activas / Pendientes). "Total" INCLUYE archivadas (R1).
- [ ] Mobile (`<md`, 360-400px): tabla colapsa a cards stacked, sin
      scroll horizontal, IconButtons accionables con dedo (≥40px).
- [ ] md+ (768px): grid 12-col con las 4 columnas en una sola línea,
      thumbnail 80×112, badge visible, acciones a la derecha.
- [ ] Status badges renderean con los tokens correctos (cero hex):
      Active=success, Pending=warning, Sold/Rented/Draft/Archived=
      neutral. Cada uno con dot.

### Admin scope (R5)

- [ ] Cuando viewer es admin, la tabla muestra columna "Propietario"
      (avatar + nombre) en md+ y chip "por {nombre}" en mobile.
      Stats reflejan totales globales (no solo del admin).
- [ ] Cuando viewer es agent/broker, NO aparece "Propietario" y los
      stats son solo de sus propias properties.

### Título clickeable (R4)

- [ ] El título de una property con status activo/pending/sold/rented
      es link a `/property/[id]` con `target="_blank"` y `rel="noopener
    noreferrer"`. El icono `open_in_new` aparece junto al título.
- [ ] El título de una property con status `draft` o `archived` NO es
      link (renderiza como texto plano con tooltip "No disponible
      públicamente").
- [ ] `aria-label` del link incluye "(se abre en otra pestaña)".

### Toggle "Ver archivadas" (R3)

- [ ] Por defecto el toggle está OFF y las archivadas NO aparecen en
      la tabla.
- [ ] Al activar el toggle, la URL agrega `?archived=1`, se resetea
      `page=1`, y las archivadas aparecen mezcladas con el resto
      (orden `updated_at desc`).
- [ ] En filas archivadas, la columna "Acciones" muestra solo
      "Restaurar" (no Edit, no Delete).
- [ ] Click en "Restaurar" abre confirm dialog. Al confirmar, ejecuta
      `restoreProperty`, la fila vuelve a `active`, vuelve a aparecer
      en la home pública (revalidación de `/`).
- [ ] Server Action `restoreProperty` rechaza con `forbidden` si
      caller no es owner ni admin; con `not_archived` si la property
      ya no está archivada.

### Archivar con guard de visits (R7)

- [ ] Click en Delete con property que tiene visits futuras
      pendientes (`status IN ('pending','confirmed','rescheduled')`
      AND `scheduled_at > now()`): el dialog muestra modo "bloqueado"
      con título "No podés archivar todavía" y la lista de visits.
- [ ] Cada `PendingVisitRow` muestra fecha+hora en la timezone de la
      property, nombre del user que agendó, y botón "Cancelar".
- [ ] Click en "Cancelar" llama a `cancelVisit({ visitId })`. La row
      desaparece de la lista (optimistic). Se crea una notification
      al user afectado con título "Tu visita fue cancelada" y body
      con el nombre de la property y la fecha.
- [ ] Cuando la lista llega a 0, el dialog transiciona a modo
      "simple" y aparece el botón "Archivar".
- [ ] Click en "Archivar" en modo simple ejecuta `archiveProperty`,
      la fila desaparece (o queda visible si toggle ON), la property
      ya no se ve en home pública ni en `/property/[id]` público.
- [ ] Si el cliente intenta saltearse el dialog (e.g., curl directo a
      la Server Action) con property que tiene visits pendientes, la
      action devuelve `pending_visits`.
- [ ] Server Action `cancelVisit` rechaza con `forbidden` si caller no
      es agent_id ni admin; con `past_visit` si `scheduled_at <=
    now()`; con `already_cancelled` si status ya no está en
      `(pending|confirmed|rescheduled)`.

### Filtros y paginación

- [ ] Paginación: con seed que tenga > 10 properties del mismo agent,
      footer muestra "Mostrando 1 a 10 de N", botón "Anterior"
      disabled en page=1, "Siguiente" disabled en última página.
      `?page=2` muestra las siguientes 10. Filtros y `?archived` se
      preservan al paginar.
- [ ] Filtros: aplicar `?status=active&type=sale` reduce la lista,
      el trigger muestra "Filtros (2)", el botón "Limpiar" resetea.
      El dropdown NO incluye opción "Archivada" (eso lo controla el
      toggle).

### Empty/loading/error

- [ ] Empty state (agent sin properties) renderiza icono + copy + CTA
      a `/dashboard/properties/new`.
- [ ] Empty con toggle ON (sin archivadas) muestra mensaje compacto
      "No tienes propiedades archivadas. [Volver a activas]".
- [ ] `loading.tsx` renderiza skeleton en navegaciones lentas.
- [ ] `error.tsx` captura excepciones de las queries.

### Migración

- [ ] El archivo `supabase/migrations/0018_visits_notify_user_on_cancel.sql`
      existe con el contenido especificado en "Migraciones
      requeridas".
- [ ] Tras `apply_migration`, `get_advisors` no reporta warnings
      nuevos de seguridad sobre la nueva función.

### A11y, lint, build

- [ ] A11y: navegación por teclado completa (tab por todos los CTAs,
      Enter abre/confirma, Esc cierra dialog y popover). Lighthouse
      a11y ≥ 95.
- [ ] Cero hex literales en JSX nuevo (grep `bg-\[#`, `text-\[#`,
      etc. da 0 hits).
- [ ] `pnpm lint` y `pnpm type-check` OK; `pnpm build` OK.
- [ ] El TopNav sigue mostrando "LuxeEstate" (no "Haven"); la página
      no introduce ningún literal "Haven".
