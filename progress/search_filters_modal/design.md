# Design spec — search_filters_modal

> Modal de filtros de búsqueda. Se abre desde el botón "Filtros" del Hero
> (home `/`) o del listado `/search` y aplica filtros a la URL del listado
> (`/search?...`). Es una **vista superpuesta**, no una página: usa el patrón
> de modal+searchParams ya iniciado con el href `/search?filters=open`
> que el botón "Filtros" del componente `PropertyTypeChips` produce hoy.

## Referencia visual

- Mockup: `docs/designs/search_filters_screen/screen.png`
- HTML referencia: `docs/designs/search_filters_screen/code.html`

## Resumen

El usuario abre el modal desde el botón "Filtros" (icono `tune`) que ya
existe en `PropertyTypeChips`. El modal le permite refinar: location
(texto), price (rango con slider dual + inputs), property_type (select),
bedrooms y bathrooms (counter pill), amenities (chips toggleables). Al
pulsar **Show N Homes** aplica los filtros a `/search?...` (o vuelve a la
home con filtros si el origen era `/`). **Clear all filters** resetea
todos los parámetros sin cerrar el modal. El contador `N` se actualiza
en vivo (con debounce) mientras el usuario cambia filtros.

El modal es 100% **público**: la home y `/search` no requieren sesión,
así que el modal NO debe asumir `user`. No escribe nada en DB.

---

## Comportamiento (mobile vs desktop)

| Aspecto          | Mobile (`< md` / `< 768px`)                                                                                | Desktop (`md+`)                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Forma            | **Bottom sheet** anclado al borde inferior                                                                 | **Dialog centrado** `max-w-2xl`   |
| Ancho            | `w-full`                                                                                                   | `max-w-2xl mx-auto`               |
| Alto             | `max-h-[90vh]` (header + body scrollable + footer fijos)                                                   | `max-h-[90vh]`                    |
| Radios           | `rounded-t-xl rounded-b-none` (solo arriba)                                                                | `rounded-xl` (todo)               |
| Entrada          | `slide-in-from-bottom` (200 ms ease-out)                                                                   | `fade-in` + `zoom-in-95` (180 ms) |
| Salida           | `slide-out-to-bottom`                                                                                      | `fade-out` + `zoom-out-95`        |
| Grab handle      | Barra horizontal centrada (`w-10 h-1.5 rounded-full bg-divider`) arriba del header, visible solo en mobile | No                                |
| Swipe-to-dismiss | Sí — touch drag sobre el grab handle o header con threshold de 60 px (ver §"Notas y a11y")                 | No                                |
| Overlay          | `bg-on-surface/40 backdrop-blur-sm` (cubre toda la viewport en ambos)                                      | igual                             |
| Cierre           | Tap fuera, `Esc`, botón `close`, swipe hacia abajo (mobile)                                                | Click fuera, `Esc`, botón `close` |
| Scroll lock      | `body` con `overflow-hidden` mientras está abierto                                                         | igual                             |

**Animaciones**: usar el plugin `tailwindcss-animate` ya instalado
(utilities `animate-in`, `animate-out`, `slide-in-from-bottom`, `fade-in`,
`zoom-in-95`, etc.).

---

## Anatomía / layout

Estructura HTML semántica del modal:

```
<dialog> (role="dialog", aria-modal, aria-labelledby="filters-title")
├── overlay (sibling absoluto / fixed)
├── panel
│   ├── (mobile only) grab handle
│   ├── <header> sticky top — "Filtros" + close button
│   ├── <form> (scrollable, flex-1 overflow-y-auto)
│   │   ├── §1 Location           (full width)
│   │   ├── §2 Price Range        (slider + min/max inputs)
│   │   ├── §3 Property details   (grid 1col mobile / 2col md+)
│   │   │   ├── Property Type     (select)
│   │   │   └── Bedrooms / Bathrooms (counter pill)
│   │   └── §4 Amenities          (grid 2col mobile / 3col md+)
│   └── <footer> sticky bottom — Clear all + Show N Homes
```

### Spacing y tokens concretos

| Elemento         | Clases                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Panel            | `bg-surface text-on-surface shadow-soft-hover`                                                                                   |
| Panel mobile     | `fixed inset-x-0 bottom-0 rounded-t-xl`                                                                                          |
| Panel desktop    | `relative w-full max-w-2xl rounded-xl mx-auto my-auto`                                                                           |
| Header           | `flex items-center justify-between px-6 py-5 md:px-8 md:py-6 border-b border-divider-soft sticky top-0 bg-surface z-10`          |
| Body             | `flex-1 overflow-y-auto hide-scroll px-6 py-6 md:px-8 md:py-8 space-y-8 md:space-y-10`                                           |
| Sección          | `space-y-3` (label + control). Entre secciones: `space-y-10`                                                                     |
| Footer           | `flex items-center justify-between gap-4 px-6 py-4 md:px-8 md:py-6 border-t border-divider-soft sticky bottom-0 bg-surface z-10` |
| Label de sección | `text-xs font-semibold uppercase tracking-wider text-muted`                                                                      |
| Overlay          | `fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm` (el panel queda dentro del mismo contenedor con `z-50`)                   |

### Detalle por sección

**§1 Location** (texto libre, sin autocomplete por ahora)

- Input con `leadingIcon="location_on"`.
- Tamaño: `Input` primitivo, `size="lg"`, `placeholder="Ciudad, barrio o dirección"`.
- Escribe a `?location=...` (URL-encoded). Trim en el client antes de
  setear. Vacío → eliminar el param.

**§2 Price Range** (dual handle slider + 2 inputs sincronizados)

- Cabecera de sección: label "PRECIO" a la izquierda + valor formateado
  a la derecha (`text-sm font-medium text-primary`, ej. `$1.2M – $4.5M`).
- Slider dual track: `relative h-1 rounded-full bg-neutral-200`. Tramo
  activo `bg-primary` posicionado entre los dos thumbs.
- Thumbs: `h-6 w-6 rounded-full bg-surface border-2 border-primary
shadow-card cursor-pointer hover:scale-110 transition`. Halo blanco
  ya está dado por el `bg-surface` + `border-primary`.
- Bajo el slider, **grid 2 columnas con `gap-4`**:
  - Card Min Price: `bg-background rounded p-3 border border-transparent focus-within:border-primary/30`
  - Card Max Price: igual.
  - Cada una tiene label `MIN PRECIO`/`MAX PRECIO` (`text-[10px] uppercase font-medium text-muted`) + prefijo `$` muted + input numérico sin borde.
- Rango por defecto: `min = 0`, `max = 10_000_000` (cubre el seed).
  Paso: 50_000. Si el listing es de rent, el implementer puede
  contemplar un step más fino en el futuro; **para esta feature usamos
  un solo rango unificado** (sale + rent comparten escala).
- Sincronización: mover thumbs actualiza inputs; editar inputs valida
  (`min <= max`, clamp a rango) y actualiza thumbs.

**§3 Property details** (grid 1col / md:2col gap-6)

- **Property Type** (`<label>` + `<select>` nativo styled):
  - Opciones: `Cualquier tipo` (default, sin param) + las 7 del enum
    `property_type`: Casa (house), Apartamento (apartment), Villa
    (villa), Penthouse (penthouse), Condo (condo), Townhouse
    (townhouse), Comercial (commercial).
  - Estilo: `bg-background rounded py-3 pl-4 pr-10 text-sm appearance-none
focus:ring-2 focus:ring-primary`. Icono `expand_more` absoluto a la
    derecha (`pointer-events-none text-muted`).
  - Reutilizar enum desde `@/lib/properties/queries` (`PropertyType`).

- **Counters (Bedrooms / Bathrooms)** — dos filas verticales (`space-y-4`):
  ```
  [Etiqueta a la izquierda]      [pill counter a la derecha]
  ```

  - Pill counter: `inline-flex items-center gap-3 bg-background rounded-full p-1`.
  - Botón `−` y `+`: `IconButton` ya existente con `variant="ghost"
size="sm"` o un botón ad-hoc `w-8 h-8 rounded-full bg-surface shadow-card
flex items-center justify-center`. El botón `+` activo lleva
    `text-primary`; `−` lleva `text-muted` cuando no está disabled. Si
    el valor llega a 0 → `−` queda disabled (`opacity-50`,
    `pointer-events-none`).
  - Display: `text-sm font-semibold w-6 text-center`.
  - Rango: 0–6. Display: si `value === 0` mostrar `"Cualquiera"` (compacto:
    `Cualq.` en mobile si no cabe — pero el counter es ancho fijo de 64 px
    y el texto entra). Si `value >= 5` mostrar `"5+"`. Demás: `${value}+`.
  - URL: `?bedrooms=N` / `?bathrooms=N`. Si N === 0 → eliminar param.

**§4 Amenities** (grid 2col mobile, 3col md+, `gap-3`)

- 11 chips (uno por valor del enum `amenity_key`).
- Cada chip = `<label>` envolviendo un `<input type="checkbox" class="peer sr-only">` + un div visual.
- Layout del chip: `h-full px-4 py-3 rounded border text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer`.
- Estados:
  - **Inactivo**: `border-outline bg-surface text-muted hover:border-primary/40 hover:text-on-surface`. Icono Material (de `AMENITY_ICON`) con `text-muted`.
  - **Activo** (`peer-checked:`): `border-primary bg-primary-soft text-primary font-medium`. Icono con `text-primary`. Punto indicador `absolute top-2 right-2 w-2 h-2 rounded-full bg-primary` (decorativo, `aria-hidden`).
- Labels desde `AMENITY_LABEL_ES` (ya existe en
  `@/lib/properties/amenities`). Iconos desde `AMENITY_ICON`.
- URL: `?amenities=pool,wifi,patio` (CSV, orden no semántico). Vacío → eliminar param.

### Footer (sticky)

- **Clear all filters** (a la izquierda): `<button type="button">` con
  `Button variant="ghost" size="sm"` + clase `underline underline-offset-4
decoration-divider`. Texto literal: `Limpiar filtros`.
- **Show N Homes** (a la derecha): `Button variant="primary" size="lg"
trailingIcon="arrow_forward"`. Texto: `Ver N propiedades` (no "Show N
  Homes" — proyecto es 100% español; ver §"Desviaciones del mockup"). Si
  `N === 0` el botón sigue clickeable y simplemente navega a `/search?...`
  donde el listado mostrará empty state. Si la query de count falla
  silenciosamente, el botón muestra `Ver propiedades` (sin N).

---

## Estados

| Estado                   | Comportamiento visual                                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cerrado**              | Modal desmontado. El botón "Filtros" lleva el icono `tune` y el indicador (ver §"Acceptance #1") cuenta filtros activos.                                                                                                                                                                |
| **Abierto inicial**      | Form pre-poblado desde los searchParams actuales (ver §"Pre-población"). Count inicial = total con esos filtros aplicados.                                                                                                                                                              |
| **Loading del count**    | Mientras la preview-query está en vuelo, el botón muestra `Ver propiedades` (sin número) y un spinner pequeño (`Icon name="progress_activity" className="animate-spin"`) a la izquierda del label. NO se deshabilita el botón: el usuario puede aplicar antes de que termine el conteo. |
| **Count = 0**            | Botón pinta `Ver 0 propiedades`. No se deshabilita; se confía en el empty state de `/search`.                                                                                                                                                                                           |
| **Submit disabled**      | Solo si el form tiene un error de validación (p. ej. `min_price > max_price`). El mensaje aparece bajo los inputs de precio en `text-xs text-danger`.                                                                                                                                   |
| **Error de count query** | Silencioso para el usuario: el botón queda en `Ver propiedades` sin número. `console.warn` para debug.                                                                                                                                                                                  |
| **Cargando navegación**  | Al pulsar submit, el modal cierra inmediatamente y se navega con `router.push`. Next muestra el `loading.tsx` del segmento `/search`.                                                                                                                                                   |

### Pre-población al abrir

El modal lee `searchParams` actuales del URL y pre-pobla cada control.
Mapping exacto:

| URL param              | Control                      | Conversión                                       |
| ---------------------- | ---------------------------- | ------------------------------------------------ |
| `?location=...`        | Input location               | `decodeURIComponent`                             |
| `?min_price=N`         | Slider min + Min Price input | `parseInt`; clamp a rango                        |
| `?max_price=N`         | Slider max + Max Price input | igual                                            |
| `?type=house`          | Select Property Type         | match exacto del enum, fallback `Cualquier tipo` |
| `?bedrooms=N`          | Counter Bedrooms             | `parseInt`, clamp 0–6                            |
| `?bathrooms=N`         | Counter Bathrooms            | igual                                            |
| `?amenities=pool,wifi` | Chips Amenities              | `split(',')`, filtrar contra enum válido         |
| `?q=...`               | (no se toca, se preserva)    | —                                                |
| `?listing=sale\|rent`  | (no se toca, se preserva)    | —                                                |

---

## Interacción y URL

### Eventos del modal

1. **Cambio de cualquier control** → estado local del modal cambia. Debounced 350 ms (Bedrooms/Bathrooms/Amenities/Type) o 500 ms (Location/Price inputs) → dispara fetch del count.
2. **Submit (Ver N propiedades)** → construye `URLSearchParams`, navega vía `router.push(`/search?${params}`)` (preservando `q` y `listing` si existían), cierra modal.
3. **Limpiar filtros** → resetea estado local a valores neutros. NO navega ni cierra. El count se recalcula automáticamente.
4. **Close (X / Esc / tap fuera / swipe down)** → cierra sin aplicar. Si el modal se abrió vía `?filters=open` en `/search`, el cierre debe **eliminar ese param** de la URL para evitar re-abrir al recargar (`router.replace`).

### URL contract — formato exacto

| Param       | Tipo         | Cuándo se omite                      | Notas                                             |
| ----------- | ------------ | ------------------------------------ | ------------------------------------------------- |
| `q`         | string       | vacío                                | Preservado, no editable desde este modal          |
| `location`  | string       | vacío                                | Texto libre URL-encoded                           |
| `min_price` | number       | igual al mínimo del slider (0)       | Sin separadores de miles                          |
| `max_price` | number       | igual al máximo (10000000)           | Idem                                              |
| `type`      | enum         | `all` o ausente                      | Match exacto del enum DB                          |
| `listing`   | `sale\|rent` | ausente                              | Preservado desde la URL anterior (toggle de home) |
| `bedrooms`  | number 1–6   | 0 / ausente                          | Significa "N o más"                               |
| `bathrooms` | number 1–6   | 0 / ausente                          | Idem                                              |
| `amenities` | CSV de enum  | ausente o vacío                      | Orden no semántico; el server hace `IN (...)`     |
| `filters`   | `open`       | siempre se elimina al cerrar/aplicar | Solo vivo mientras el modal está visible          |

**Clear all filters** elimina TODOS los params del modal y conserva
únicamente `q` y `listing` si estaban.

### Count en vivo

- Implementación: **Server Action** (`getMatchingPropertiesCount`) en
  `src/lib/properties/actions.ts` (archivo ya existe). Recibe el objeto
  de filtros tipado, devuelve `{ count: number }`.
- Internamente: `supabase.from('properties').select('id', { count: 'exact', head: true })` con los mismos filtros que el listado aplicaría + `listing_status = 'active'`. `head: true` evita traer rows.
- Debounce en el cliente: 350 ms para discretos, 500 ms para sliders/inputs de texto. AbortController para cancelar requests en vuelo.
- **No** se cachea entre aperturas: cada apertura del modal recalcula desde la URL inicial.

---

## Integración con el shell

### Archivos nuevos

- `src/components/search/FiltersModal.tsx` — Client Component, contenedor del estado y formulario.
- `src/components/search/FiltersTrigger.tsx` — Client Component que envuelve el botón "Filtros" del Hero y controla la apertura local. Reemplaza el `<Link href="/search?filters=open">` actual del `PropertyTypeChips`.
- `src/components/search/index.ts` — re-exports.
- `src/lib/search/filter-params.ts` — utilidades puras: `parseFilterParams(searchParams) → Filters`, `serializeFilters(filters) → URLSearchParams`, `countActiveFilters(filters) → number`, `EMPTY_FILTERS`. Sin lógica de UI. Test-friendly.
- `src/lib/properties/actions.ts` — agregar Server Action `getMatchingPropertiesCount(filters)`. (El archivo ya existe, solo se añade una función.)

### Archivos que se tocan

- `src/components/home/PropertyTypeChips.tsx` — el `<Link>` de "Filtros" pasa a usar `<FiltersTrigger />`. Mantiene la apariencia visual (icono `tune` + label "Filtros"). Si hay filtros activos, agrega badge con count (`<Badge variant="primary" size="sm">3</Badge>`) inline. Esto cumple el acceptance "indicador de filtros activos".
- `src/app/(app)/search/page.tsx` — deja de ser placeholder. Pasa a:
  - Leer todos los filter params con `parseFilterParams`.
  - Ejecutar query de listado contra `properties` con esos filtros + `q` (full-text via `search_vector` cuando esté presente).
  - Renderizar el grid de `PropertyCard` (reutiliza el patrón de `home_discover_screen`).
  - Si `searchParams.filters === 'open'` → renderizar `<FiltersModal initialOpen />` junto al listado. El modal vive en el segmento `/search`.
- `src/app/(app)/page.tsx` (home) — el modal **también** debe poder abrirse desde la home. La home renderiza `<FiltersTrigger />` (que ya hereda del cambio en `PropertyTypeChips`). Al aplicar filtros desde la home, navega a `/search?...` (no se queda en la home).

### Lifecycle del modal

- **En `/search`**: si `searchParams.filters === 'open'` al cargar, el modal se monta abierto en el initial render. Si el user lo cierra sin aplicar, se hace `router.replace('/search?<resto>')` quitando `filters=open`. Esto soporta deep-link.
- **En `/`**: el modal SIEMPRE arranca cerrado (no hay `filters=open` en la home). Si el user lo abre desde el botón "Filtros" del Hero, el modal abre client-side (state local) sin tocar la URL hasta que aplica. Al aplicar, navega a `/search?...`. Esto evita un viaje innecesario a `/search?filters=open` antes de tener los filtros.

**Por qué la diferencia**: en `/search` los filtros forman parte del
contexto natural de la página y queremos que `Ctrl+L` + paste reproduzca
la vista (incluido el modal). En `/` el modal es un "interruptor"
client-side; tener `filters=open` en el URL de la home sería ruido para
SEO sin valor.

### Server Component vs Client Component

| Componente                                 | Tipo                    | Justificación                                                                              |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| `FiltersModal`                             | Client (`"use client"`) | State controlado por React, listeners de teclado, debounce, animaciones, swipe-to-dismiss. |
| `FiltersTrigger`                           | Client                  | Necesita on-click handler para abrir el modal y leer searchParams.                         |
| `/search/page.tsx`                         | Server                  | Ejecuta queries con `createServerClient`, lee `await searchParams`.                        |
| Server Action `getMatchingPropertiesCount` | Server                  | Va a Supabase con cookies del request; ningún secreto cruza al cliente.                    |
| `filter-params.ts`                         | Lib pura                | Sin React; importable desde ambos lados.                                                   |

---

## Tokens y clases

Resumen del set de utilities que se debe usar. **Cero hex** y **cero
clases custom de color**.

### Color

- Fondos: `bg-surface` (panel y header/footer sticky), `bg-background` (cards de price, select, counter pill), `bg-primary` (botón submit, tramo activo del slider, punto indicador de chip activo), `bg-primary-soft` (fondo de chip activo), `bg-on-surface/40 backdrop-blur-sm` (overlay).
- Texto: `text-on-surface` (texto principal, valores), `text-muted` (labels de sección, captions, iconos inactivos), `text-primary` (valor del precio, chip activo, botón `+` del counter), `text-on-primary` (texto del CTA), `text-danger` (errores de validación).
- Bordes: `border-divider-soft` (separadores header/footer), `border-outline` (chips inactivas, focus-within sutil), `border-primary` (chip activo), `border-primary/30` (focus-within de cards de precio).

### Radio

- `rounded-xl` panel desktop / `rounded-t-xl` panel mobile.
- `rounded` (default 8 px): botones, inputs, select, cards de price, chips de amenities.
- `rounded-full`: thumbs del slider, counter pill, botones `+`/`−`, punto indicador, grab handle.
- `rounded-sm`: ninguno aquí, pero permitido si surge.

### Sombra

- `shadow-soft-hover` para el panel del modal (lift suave).
- `shadow-soft` para el botón submit.
- `shadow-card` para los thumbs del slider y los botones del counter pill.

### Spacing (tokens Tailwind nativos)

- Padding panel: `p-6 md:p-8`.
- Gap entre secciones: `space-y-8 md:space-y-10`.
- Gap dentro de §3: `gap-6 md:gap-8`.
- Gap grid amenities: `gap-3`.

### Tipografía

- Título del modal "Filtros": `text-2xl font-semibold tracking-tight text-on-surface` (mapea a escala `headline-2` con peso 600).
- Labels de sección: `text-xs font-semibold uppercase tracking-wider text-muted` (escala `caption` 600).
- Texto de chip / counter: `text-sm font-medium` (escala `body`).
- Botón submit: `text-base font-medium` (escala `title-2`).
- Botón Clear all: `text-sm font-medium underline underline-offset-4 decoration-divider`.

Inter siempre. Pesos usados: 400, 500, 600, 700 (todos ya cargados en
`src/app/layout.tsx`).

---

## Componentes

### Reutilizar (ya existen)

- `Button` (`primary` size `lg` para submit; `ghost` size `sm` para Clear).
- `IconButton` (`ghost` size `sm` para el botón close del header).
- `Icon` (`close`, `location_on`, `expand_more`, `arrow_forward`, `progress_activity`, `add`, `remove`, y todos los de `AMENITY_ICON`).
- `Badge` (`primary` size `sm`) — en el botón "Filtros" del hero para indicar filtros activos.
- `Input` primitivo — solo para el campo Location (con `leadingIcon="location_on"`, `size="lg"`).

### Nuevos (locales al feature, no se promueven a `ui/` por ahora)

- `RangeSlider` (en `src/components/search/RangeSlider.tsx`) — dual-thumb slider:
  - Props: `min, max, step, value: [number, number], onChange: (v: [number, number]) => void`.
  - Implementación: 2 `<input type="range">` superpuestos + track + dos thumbs con `pointer-events: auto`. Estilo via CSS module o `globals.css` extendido (los pseudo-elementos `::-webkit-slider-thumb` no se pueden estilizar 100% con clases Tailwind sin plugin).
  - **Decisión**: el styling del thumb se inserta en `globals.css` como utility puntual (`.range-thumb-primary`) en lugar de tener estilos sueltos en el componente. Esto mantiene un solo lugar de "lo que escapa a Tailwind".
- `CounterPill` (en `src/components/search/CounterPill.tsx`) — counter genérico (Bedrooms/Bathrooms):
  - Props: `label: string, value: number, onChange: (n: number) => void, min?: number = 0, max?: number = 6, formatValue?: (n: number) => string`.
- `AmenityChipGroup` (en `src/components/search/AmenityChipGroup.tsx`) — wrapper para las 11 chips:
  - Props: `selected: AmenityKey[], onChange: (next: AmenityKey[]) => void`.
  - Renderiza un `<label>` por amenity con `<input type="checkbox" class="peer sr-only">` para el manejo accesible nativo.

Todos nuevos van bajo `src/components/search/` (no `ui/`) porque son
específicos del modal de filtros.

---

## Tipografía

Inter, pesos 400/500/600/700 (ya cargados). Mapeo a la escala del
design-system:

| Elemento                                | Escala                  | Clases                                           |
| --------------------------------------- | ----------------------- | ------------------------------------------------ |
| Título "Filtros"                        | `headline-2`            | `text-2xl font-semibold tracking-tight`          |
| Valor de precio "$1.2M – $4.5M"         | `body`                  | `text-sm font-medium`                            |
| Labels de sección (LOCATION, PRECIO, …) | `caption` 600 uppercase | `text-xs font-semibold uppercase tracking-wider` |
| Label de campo Min/Max Price            | smaller caption         | `text-[10px] uppercase font-medium`              |
| Texto de chip de amenity                | `body`                  | `text-sm` (activo `font-medium`)                 |
| Botón submit                            | `title-2`               | `text-base font-medium`                          |
| Botón Clear                             | `body`                  | `text-sm font-medium`                            |

---

## Datos

### Tablas consultadas (vía RLS pública ya abierta)

| Tabla                | Operación                                                                             | Columnas necesarias                                                                                                       | Política RLS aplicada                                                          |
| -------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `properties`         | `SELECT count(*)` para preview, `SELECT *` para listado                               | `id, listing_status, listing_type, property_type, price, bedrooms, bathrooms, city, address_line, country, search_vector` | `properties_select_active_anon` (mig 0013) + `properties_select_public_or_own` |
| `property_amenities` | `SELECT property_id WHERE amenity IN (...)` (subquery cuando hay filtro de amenities) | `property_id, amenity`                                                                                                    | (abierta a `anon` para propiedades active, mig 0014)                           |
| `property_images`    | `SELECT WHERE is_main = true` (solo en el listado, no en el count)                    | `storage_path, alt_text`                                                                                                  | abierta a `anon` para propiedades active                                       |

### Estrategia de query (server, página `/search`)

```ts
// pseudo-código
const filters = parseFilterParams(searchParams);

let q = supabase
  .from('properties')
  .select(SELECT_COLUMNS, { count: 'exact' })
  .eq('listing_status', 'active');

if (filters.q) q = q.textSearch('search_vector', filters.q);
if (filters.location) q = q.ilike('city', `%${filters.location}%`); // ver §"Notas"
if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
if (filters.type) q = q.eq('property_type', filters.type);
if (filters.listing) q = q.eq('listing_type', filters.listing);
if (filters.bedrooms) q = q.gte('bedrooms', filters.bedrooms);
if (filters.bathrooms) q = q.gte('bathrooms', filters.bathrooms);

if (filters.amenities.length > 0) {
  // Subquery: properties cuyo id está en una intersección con property_amenities.
  // Estrategia 1 (recomendada para MVP): traer property_ids con AT LEAST ONE de los amenities
  //   q = q.in('id', subquery_ids);
  // Estrategia 2 (estricta, "todos"): un RPC dedicado.
  // DECISIÓN: para esta feature usamos OR (al menos uno).
  //   Esto matchea el mockup ("filtra por amenities seleccionadas") y es lo más útil para descubrir.
  //   Documentar en código.
}
```

### Server Action `getMatchingPropertiesCount`

```ts
'use server';
export async function getMatchingPropertiesCount(filters: Filters): Promise<{ count: number }> {
  const supabase = await createClient();
  let q = supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('listing_status', 'active');
  // ...mismos filtros que arriba
  const { count, error } = await q;
  if (error) {
    console.warn('[getMatchingPropertiesCount] failed', error);
    return { count: 0 };
  }
  return { count: count ?? 0 };
}
```

---

## Interactividad

### Estático (Server)

- La página `/search` (Server Component) ejecuta la query inicial con
  los searchParams y renderiza el listado.
- La pre-población del modal viene de los searchParams ya leídos en el
  server, pero el modal en sí es Client.

### Interactivo (Client, `"use client"` en `FiltersModal`)

- State local: `{ location, minPrice, maxPrice, type, bedrooms, bathrooms, amenities }`.
- Hooks usados: `useState`, `useEffect` (debounce + count fetch), `useRef` (input refs, dialog ref, AbortController), `useTransition` (para el submit), `useRouter` (de `next/navigation`).
- Eventos:
  - `onChange` de cada control → setState → debounced effect → Server Action `getMatchingPropertiesCount` → setCount.
  - `onSubmit` (botón Ver N) → `startTransition(() => router.push(`/search?${serializeFilters(filters)}`))` → cerrar modal.
  - `onClear` → reset state al `EMPTY_FILTERS`. NO cierra ni navega.
  - `onClose` (close button / Esc / overlay click / swipe down):
    - Si está abierto vía `?filters=open` → `router.replace` quitando ese param.
    - Si está abierto vía state local (home) → solo `setOpen(false)`.

### Server Actions

- `getMatchingPropertiesCount(filters)` — única. No muta nada.

---

## Estados del flujo (resumen)

| Estado                  | Trigger                              | Render                                                                                 |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| **Cerrado**             | inicial                              | Solo el botón "Filtros" (con badge si hay filtros activos).                            |
| **Abriendo**            | click en "Filtros" o `?filters=open` | Overlay fade-in + panel slide/zoom. Foco va al close button.                           |
| **Abierto**             | post-animación                       | Form usable. Body con `overflow-hidden`.                                               |
| **Recalculando count**  | cambio de control + debounce         | Botón muestra spinner + texto sin número.                                              |
| **Validación inválida** | `min_price > max_price`              | Mensaje `text-xs text-danger` bajo los inputs. Submit deshabilitado.                   |
| **Aplicando**           | click en submit                      | `useTransition` pinta el botón con spinner; al completar, modal cierra y route cambia. |
| **Cerrando**            | Esc / X / swipe / overlay click      | Slide/zoom out. Body recupera scroll. URL limpia `filters=open` si aplica.             |

---

## Desviaciones del mockup

| Lugar                         | Mockup HTML                                                         | Resolución en el spec                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color primary                 | `#006611` (verde brillante)                                         | Normalizado a `mosque` (`#006655`) vía `bg-primary` (decisión Fase 2, documentado en `docs/design-system.md` §"Desviaciones documentadas").                                                                                              |
| Idioma                        | "Filters", "Show 124 Homes", "Clear all filters", "Min Price", etc. | Todo en español: "Filtros", "Ver N propiedades", "Limpiar filtros", "Precio mín", "Precio máx". Project rule.                                                                                                                            |
| Property Type options         | "Any Type", "House", "Apartment", "Condo", "Townhouse"              | Las 7 del enum DB + "Cualquier tipo" como default. Se agregan "Villa", "Penthouse", "Comercial" porque existen en `property_type` y aparecen en el seed.                                                                                 |
| Amenities                     | 6 chips visibles (Pool, Gym, Parking, AC, Wifi, Patio)              | Las 11 del enum `amenity_key`: pool, gym, wifi, air_conditioning, garden, smart_home, parking, patio, wine_cellar, ev_charging, central_heating. Es decisión consciente: queremos cubrir el enum completo, no solo el subset del mockup. |
| Location input                | Valor hardcoded "San Francisco, CA"                                 | Sin valor por default. Placeholder "Ciudad, barrio o dirección".                                                                                                                                                                         |
| Counter `−` button            | Disabled cuando value = 0                                           | Igual al mockup pero el indicador en pantalla pasa a "Cualquiera" para que el usuario sepa que 0 = sin filtro.                                                                                                                           |
| Background blurred decorativo | Imagen de fondo blureada de una casa                                | Omitir. El modal abre sobre la home o `/search` reales, no sobre un fondo decorativo. Solo el overlay translucido (`bg-on-surface/40 backdrop-blur-sm`).                                                                                 |
| Botón submit                  | Texto + flecha `arrow_forward` con `shadow-primary/30`              | Mantenemos icono `arrow_forward`. Sombra usa `shadow-soft` del sistema (no hay token primary-tinted; el lift visual con primary intenso queda fuera de scope).                                                                           |
| Counter pill background       | `bg-background-light` (claro)                                       | `bg-background` (clear-day del sistema). Mismo rol semántico.                                                                                                                                                                            |
| Indicador de chip activo      | Punto verde + borde verde + bg verde tenue                          | Mantenido. Punto usa `bg-primary`, borde `border-primary`, fondo `bg-primary-soft`.                                                                                                                                                      |

---

## Notas para el implementer

### A11y

- **Modal dialog**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="filters-title"`. Idealmente usar `<dialog>` nativo con `showModal()` para gestión gratis de focus-trap + Esc. Si surge incompatibilidad con animaciones, caer a div + manual focus trap.
- **Focus management**: al abrir, el foco va al botón close (no al primer input, para que Esc/Tab sean obvios). Al cerrar, vuelve al trigger que lo abrió.
- **Live region**: el contador "Ver N propiedades" debe ser `aria-live="polite"` para que screen readers lean el conteo actualizado tras los cambios.
- **Counter pill**: cada `−`/`+` con `aria-label="Quitar uno"` / `"Agregar uno"`. El valor central va dentro de un `<span aria-live="polite">`.
- **Chips amenities**: el `<input type="checkbox" sr-only>` ya provee semántica nativa. Cada `<label>` lleva un `for` implícito porque envuelve al input.
- **Contraste**: `text-primary` sobre `bg-primary-soft` cumple WCAG AA en mosque (verificado en design-system). `text-muted` sobre `bg-surface` también.
- **Sin sesión**: el modal funciona idéntico sin sesión. Las queries son públicas. No hay CTAs que requieran login.

### Validación

- `min_price` y `max_price`: aceptan solo dígitos. Implementer puede usar `inputMode="numeric"` + filtrar `onChange`. Si el user borra el valor (`""`), tratar como "sin límite" (equivalente al extremo del rango).
- Si `min_price > max_price` → mostrar error inline en ambos inputs (`border-danger focus:ring-danger`) y deshabilitar el submit hasta corregir. El slider previene este caso visualmente.
- `bedrooms`/`bathrooms`: clamp a 0–6. Si el server recibe `bedrooms=7` lo trata como 6.

### Performance

- Debounce del count: 350-500 ms es suficiente para no martillar la DB. AbortController cancela requests previos.
- `head: true` en el count evita transferir filas.
- La query del listado en `/search` ya está limitada a `listing_status='active'` por la RLS y la cláusula explícita.

### Edge cases

- **Slider en mobile + iOS**: dos `<input type="range">` superpuestos pueden tener problemas de hit-test. Si el implementer lo encuentra, escalar a 1 solo input con un thumb visualmente split (común en libs), o intercambiar `z-index` según cuál thumb está más cerca del touch. Probar en iOS Safari real.
- **searchParams existentes no contemplados**: el modal debe ignorarlos al construir su state pero preservarlos al hacer `router.push` (p. ej. `q` y `listing`). `serializeFilters` recibe `URLSearchParams` base y agrega/sobreescribe solo los suyos.
- **Deep-link con todos los params**: `?location=Miami&min_price=500000&max_price=2000000&type=apartment&bedrooms=2&bathrooms=2&amenities=pool,wifi` debe pintar el listado correcto y pre-poblar el modal si `?filters=open` se agrega.
- **Re-render del listado mientras el modal está abierto en `/search`**: al pulsar Clear, el modal NO navega (deja la URL como está), pero el listado de fondo sigue mostrando los resultados del URL anterior. Esto es correcto: el conteo del botón refleja los filtros pendientes y el listado actualiza al pulsar "Ver N propiedades".
- **`location` ilike sobre `city`**: para MVP es suficiente. Acepta una limitación: si el usuario escribe "Beverly Hills, CA" no matchea porque `city` guarda solo "Beverly Hills". El implementer puede ampliar el ilike a `city || ', ' || state` con `or()` de Supabase. Documentar como TODO para una iteración futura.

### Performance + revalidación

- `/search` debe declarar `export const dynamic = 'force-dynamic'` o `'auto'` (no `'force-static'`) porque depende de searchParams runtime.
- Sin cache adicional para la query: cada cambio de URL es un nuevo render. Aceptable para el MVP.

---

## Decisiones cerradas (humano, 2026-05-23)

Las 4 preguntas abiertas del spec se resolvieron antes de implementar:

1. **Amenities → OR (al menos una)**. Si selecciono Pool + Wifi muestro
   propiedades que tengan pool O wifi. Implementación: subquery
   `select property_id from property_amenities where amenity in (...)` y
   `q.in('id', ids)`. Query barata, favorece descubrimiento.
2. **Slider de precio → dual condicionado por `listing`**. Si `?listing=rent`
   en la URL: rango `[0, 20000]` step `100`. Caso contrario (sale o sin
   listing): rango `[0, 10_000_000]` step `50_000`. El componente
   `RangeSlider` lee `listing` del URL al montar y configura sus props
   en consecuencia. Los inputs Min/Max Price aplican el mismo clamp.
3. **Location → `ilike` sobre `city`**. `q.ilike('city', '%' + texto + '%')`.
   Acepta matches parciales (`"Bever"` matchea `"Beverly Hills"`). Sin
   `textSearch` por ahora; mejora futura documentada como TODO.
4. **Modal → div custom con focus-trap propio**. No usar `<dialog>` nativo
   ni Radix. Implementación: `<div role="dialog" aria-modal="true">` +
   `useEffect` que captura `Tab`/`Shift+Tab` para ciclar focus entre los
   elementos focuseables del panel. Esc y click fuera con listeners
   manuales. ~30 líneas extra pero ganamos animaciones limpias con
   `tailwindcss-animate` sin hacks de `data-state`.

## Riesgos vivos (no bloqueantes)

- **`filters=open` y la barra de URL**. Que el query string contenga
  `filters=open` solo mientras el modal está abierto es elegante para
  deep-linking pero "ruido" para el usuario que copia la URL. Aceptable
  porque el cierre lo limpia. Si el usuario comparte la URL con
  `filters=open`, el destinatario ve el modal abierto on first paint
  (eso es deseado, deep-link funciona).
- **`ilike` sobre `city` no matchea "Beverly Hills, CA"** porque `city`
  guarda solo "Beverly Hills". Mejora futura: ampliar a
  `or(city.ilike.%X%,state.ilike.%X%)`. TODO documentado en código.

---

## Acceptance mapping

Mapeo cada criterio del backlog (`feature_list.json` → `search_filters_modal.acceptance`) a la sección del spec donde se cumple. El implementer debe poder pasar este checklist con código basado en este documento.

- [ ] **1. `src/components/search/FiltersModal.tsx` (Client Component)** → §"Integración con el shell" + §"Interactividad". El archivo se crea como Client.
- [ ] **2. Mobile bottom sheet con swipe-to-dismiss; desktop dialog centrado `max-w-2xl`** → §"Comportamiento (mobile vs desktop)". Forma + ancho + swipe.
- [ ] **3. Slider de precio dual handle que lee/escribe `?min_price=&max_price=`** → §"Anatomía §2 Price Range" + §"Interacción y URL → URL contract".
- [ ] **4. Bedrooms y bathrooms con contadores +/− en pill, formato `3+`** → §"Anatomía §3 Counters" + §"Componentes → CounterPill".
- [ ] **5. Amenities chips toggleables, colección completa del enum** → §"Anatomía §4 Amenities" + §"Desviaciones del mockup" (las 11). Iconos+labels vienen de `AMENITY_ICON`/`AMENITY_LABEL_ES`.
- [ ] **6. Submit actualiza URL con searchParams y cierra modal; la página lee los params en server** → §"Interacción y URL → Eventos del modal #2" + §"Integración con el shell → `/search/page.tsx`".
- [ ] **7. Botón Show N Homes con count en vivo (preview query)** → §"Anatomía → Footer" + §"Interacción y URL → Count en vivo" + §"Datos → Server Action `getMatchingPropertiesCount`".
- [ ] **8. Botón Clear all filters resetea searchParams a vacío** → §"Interacción y URL → Eventos del modal #3" + §"Componentes → Botón Clear". (Nota: Clear NO navega; resetea el state local y deja la URL intacta hasta que se aplica. Si el reviewer interpreta el acceptance como "borrar también la URL", esto requiere un cambio menor — documentado en §"Decisiones abiertas" si surge.)

---

## Self-review (pre-entrega)

- Sin placeholders/TBD/TODO sueltos. ✓
- Tokens consistentes con `globals.css`. ✓
- Tipografía Inter consistente con design-system. ✓
- Scope acotado a la feature (no se filtra a `/favorites`, `/property/[id]`, etc.). ✓
- Mockup respetado en jerarquía visual; desviaciones documentadas en §"Desviaciones del mockup". ✓
- 8 acceptance del backlog mapeados a secciones. ✓
