# Design spec — favorites_list_screen

## Referencia visual

- Mockup: `docs/designs/favorites_list_screen/screen.png`
- HTML: `docs/designs/favorites_list_screen/code.html`

> Recordatorio: el HTML está en inglés y usa nombres `bg-clearday`/`bg-mosque`.
> Aquí normalizamos a los tokens semánticos definidos en
> `src/app/globals.css` y al copy en español.

## Resumen visual

`/favorites` es la versión "biblioteca personal" del listado de propiedades.
Visualmente comparte ADN con la sección "Nuevas en el mercado" del Home
(grid de PropertyCard `compact`) pero se diferencia en tres detalles:

1. **Header con identidad propia**: H1 "Tus favoritos" + count dinámico
   ("Tienes N propiedades guardadas"), sin hero ni search box.
2. **Toolbar de listado**: sort dropdown + toggle de vista (grid/list)
   alineados a la derecha del header en desktop, bajo el título en móvil.
3. **Cards con CTA inline**: cada PropertyCard suma un botón "Reservar
   visita" full-width al pie y, en el rincón superior derecho, el corazón
   aparece SIEMPRE lleno (es la pantalla para des-favoritear).

Además, al final del grid aparece una tarjeta "Descubre más" con borde
discontinuo verde y CTA `Explorar propiedades` que enlaza a `/`. Es un
empty-state-soft: nunca está vacío, siempre invita a navegar.

## Layout y secciones (mobile-first)

Toda la página vive bajo el shell público en `src/app/(app)/layout.tsx`
(TopNav + main). Esto implica que `/favorites` **debe agregarse a
`protectedPaths` en `src/lib/supabase/proxy.ts`** — ya está incluido desde
la feature `app_shell`, verificar.

Contenedor raíz:

```
<div class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
```

### 1. Header — `<section class="py-8 md:py-12">`

Layout mobile (column) → desktop (row con `md:items-end md:justify-between`):

```
┌──────────────────────────────────────────────────────────┐
│  Tus favoritos                                           │ ← h1, text-3xl md:text-4xl font-light
│  Tienes 4 propiedades guardadas                          │ ← p, text-sm text-muted
│                                                          │
│  [Sort by: Date Added ▾]   [▦ ▤]                         │ ← toolbar
└──────────────────────────────────────────────────────────┘
```

- H1: `text-3xl md:text-4xl font-light text-on-surface` (mismo patrón que
  `/search` y `/`). El mockup usa `font-bold tracking-tight`; lo
  normalizamos a `font-light` para mantener coherencia editorial con
  Home y Search que ya usan ese peso.
- Subtítulo:
  - `0` → "Aún no guardaste ninguna propiedad."
  - `1` → "Tienes 1 propiedad guardada."
  - `n>1` → `Tienes ${n} propiedades guardadas.`
- Toolbar en mobile: stack debajo del título, `flex-wrap gap-3 mt-4`.
- Toolbar en desktop: alineada al `md:items-end` para que la base del sort
  comparta línea con la base del subtítulo.

### 2. Grid — `<section>` con cards

```
mobile  : grid-cols-1
sm 640+ : grid-cols-2
lg 1024+: grid-cols-3
xl 1280+: grid-cols-4
gap-6 lg:gap-8
```

El grid incluye, en este orden:

1. `N` PropertyCards (las propiedades favoritas).
2. La tarjeta "Discover More" como último item del grid (sólo si `N > 0`).

Si `N === 0` la grid se reemplaza por el empty state full-width (ver §
Estados).

### 3. Footer

El Footer vive en otro layout o se reutiliza del shell. **No es parte de
esta feature**; el HTML lo trae pero la app aún no tiene Footer global.
Si más adelante se añade uno, no toca esta pantalla.

## Componentes

### Reutilizados (sin cambios)

| Componente             | Origen                                       | Uso aquí                                                                                     |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `TopNav` variant `app` | `src/components/nav/TopNav.tsx`              | Ya provisto por `(app)/layout.tsx`                                                           |
| `Icon`                 | `src/components/ui/Icon.tsx`                 | Sort/view icons, CTA flecha                                                                  |
| `Button`               | `src/components/ui/Button.tsx`               | CTA "Reservar visita" (variant `secondary`) y CTA "Explorar propiedades" (variant `primary`) |
| `Badge`                | `src/components/ui/Badge.tsx`                | Badge "En venta" / "En alquiler"                                                             |
| `PriceTag`             | `src/components/property/PriceTag.tsx`       | Ya consumido por PropertyCard                                                                |
| `FavoriteButton`       | `src/components/property/FavoriteButton.tsx` | El corazón con optimistic UI; el server action `toggleFavorite` ya revalida `/favorites`     |

### Extender: `PropertyCard` con props `showBookingCTA` y `orientation`

El PropertyCard actual ya soporta `variant: 'featured' | 'compact'`. Para
`/favorites` necesitamos dos extensiones **ortogonales** sobre la variante
`compact`:

1. **`showBookingCTA: boolean`** (default `false`) — pinta el CTA inline al
   pie ("Reservar visita" / "Agendar tour").
2. **`orientation: 'vertical' | 'horizontal'`** (default `'vertical'`) —
   cambia el layout interno entre imagen-arriba/contenido-abajo (default,
   ya existente) y imagen-izquierda/contenido-derecha (nuevo).

Ambas props sólo aplican cuando `variant === 'compact'`. Para `'featured'`
las props se ignoran (TypeScript puede no enforcearlo; el runtime sí — la
implementación renderiza la `FeaturedPropertyCard` sin tocar esas props).
**No crear una tercera variante; no crear un wrapper.** El default de cada
prop garantiza que Home y Search no cambien.

Combinaciones soportadas:

| `orientation` | `showBookingCTA` | Pantalla típica                        |
| ------------- | ---------------- | -------------------------------------- |
| `vertical`    | `false`          | Home / Search (sin cambios)            |
| `vertical`    | `true`           | `/favorites` view=grid                 |
| `horizontal`  | `false`          | (no usado hoy, soportado por simetría) |
| `horizontal`  | `true`           | `/favorites` view=list                 |

#### CTA al pie (`showBookingCTA`)

El CTA debe:

- Estar fuera del `<Link>` z-10 que cubre la card. Como el Link absoluto
  ya está en z-10 y el FavoriteButton en z-20, el CTA al pie debe ir en
  z-20 también, dentro del `<div class="p-4">` final.
- Usar el componente `Button variant="secondary" size="sm" fullWidth`
  con `trailingIcon="arrow_forward"`. La variante secondary ya da el look
  "outline mosque" que pide el mockup (`border-outline hover:border-primary
hover:text-primary`).
- Para propiedades `listing_type === 'rent'` el copy es **"Agendar tour"**
  con `trailingIcon="calendar_today"` (el mockup diferencia visualmente
  las cards de renta — ver tarjeta 4 "Schedule Tour").
- En `orientation='horizontal'` el CTA mantiene `fullWidth` y vive en la
  columna de contenido (no debajo de la imagen); ver § Layout horizontal.
- El `<Link href={"/property/[id]/visit"}>` que envuelve el Button vive
  en `<div class="relative z-20 mt-auto">` (en vertical) o
  `<div class="relative z-20 mt-auto pt-3">` (en horizontal). Como ese
  wrapper está en z-20 sobre el Link absoluto de la card (z-10), el click
  NO se propaga al Link inferior. Verificado: el patrón ya funciona con
  `FavoriteButton`. **No se requiere componente cliente nuevo.**

#### Layout horizontal (`orientation='horizontal'`)

El `<article>` raíz cambia su layout interno según orientation. Manteniendo
el mismo `<article class="group relative ... bg-surface shadow-card">` y
el mismo Link absoluto `inset-0 z-10`:

**Estructura DOM en horizontal (igual en mobile y desktop):**

```
<article class="... flex flex-row">
  <Link inset-0 z-10 />
  <div class="relative w-2/5 shrink-0">           {/* imagen ~40% */}
    <Image fill class="aspect-[4/3] object-cover" />
    <FavoriteButton class="absolute top-3 right-3 z-20" />
    <Badge listingType class="absolute bottom-3 left-3 z-20" />
  </div>
  <div class="flex flex-1 flex-col p-4 min-w-0">  {/* contenido ~60% */}
    <PriceTag />
    <h4 truncate>title</h4>
    <p text-xs text-muted>address</p>
    <div features (beds/baths/area)>
    {showBookingCTA && (
      <div class="relative z-20 mt-auto pt-3">
        <Link><Button fullWidth>CTA</Button></Link>
      </div>
    )}
  </div>
</article>
```

**Reglas de layout:**

- Contenedor imagen: `relative w-2/5 shrink-0` en todos los breakpoints
  (40% del ancho del card). En desktop, donde el card a su vez es mucho
  más ancho (ver § Toggle vs responsive abajo), la imagen sigue siendo
  40% relativa al card, no a la viewport.
- `aspect-ratio` de la imagen: `aspect-[4/3]` (mismo que vertical, para
  consistencia visual y para reusar el ratio del Image fill). La altura
  resultante depende del ancho real del card; el `<article>` no fija
  altura, deja que el contenido (PriceTag + título + features + CTA) o la
  imagen — lo que sea mayor — definan el alto. En la práctica el
  contenido manda en cards angostos y la imagen manda en cards anchos.
  **Decisión**: agregar `min-h-[180px] sm:min-h-[200px]` al `<article>`
  en horizontal para que en filas con poca info (sin área, sin CTA) la
  card no colapse a un alto antiestético.
- Contenido (`flex-1 min-w-0 p-4`): apila vertical con `flex flex-col`.
  El `min-w-0` es **obligatorio** para que el `truncate` del título y el
  address funcionen dentro de un flex item.
- Bloque features (beds/baths/area): mantiene la fila horizontal con
  `flex items-center gap-x-4 gap-y-2 flex-wrap`. En cards muy angostos
  (ej. mobile portrait con `w-3/5 = ~210px`) las pastillas envuelven.
- CTA al pie: con `mt-auto pt-3` se empuja al fondo de la columna de
  contenido (no full-width del card; full-width de su columna, que es lo
  estéticamente correcto en horizontal). Borde superior `border-t
border-divider-soft` opcional para separar features del CTA — recomendado.
- `FavoriteButton` y badge listing-type viven sobre la imagen igual que en
  vertical. **No** se reposicionan en horizontal.

**Posicionamiento del FavoriteButton y badges en horizontal:**

- `FavoriteButton`: `absolute top-3 right-3 z-20` sobre el contenedor de
  imagen (no sobre la card entera). Idéntico a vertical.
- Badge listing-type: `absolute bottom-3 left-3 z-20` sobre el contenedor
  de imagen. Idéntico a vertical.
- Para badges overlay tipo NEW LISTING / PRICE DROP: **fuera de scope**
  (ver § Tokens y clases).

#### Toggle vs responsive — comportamiento del `?view=list`

El toggle es **siempre operable** (no se oculta en ningún breakpoint), pero
el efecto visual cambia con el ancho:

| Breakpoint       | `?view=grid`   | `?view=list`                                      |
| ---------------- | -------------- | ------------------------------------------------- |
| < 640px (mobile) | 1 col vertical | 1 col **horizontal** (imagen 40% / contenido 60%) |
| sm 640-1023      | 2 col vertical | 1 col horizontal full-width                       |
| lg 1024-1279     | 3 col vertical | 2 col horizontal (grid-cols-2)                    |
| xl 1280+         | 4 col vertical | 2 col horizontal (grid-cols-2)                    |

Decisiones implícitas y por qué:

- **Mobile sí estrena horizontal.** El humano lo confirmó: el list view
  brilla en TODOS los breakpoints, incluido mobile. A 360-414px, una
  card con imagen 40% (~140-165px de ancho) y contenido 60% sigue siendo
  legible para precio + dirección truncada + features compactas. Las
  pastillas de features envuelven si no entran.
- **Desktop NO va a 1 columna en list.** A `lg+` una sola columna
  horizontal a `max-w-7xl` haría cards de ~1280px de ancho con imagen
  de ~500px — desproporcionado y feo. La solución es **2 columnas** de
  cards horizontales en `lg` y `xl`. Eso replica el patrón de
  inmobiliarias serias (Idealista, Zillow) donde el list view en
  desktop wide usa grid de 2 columnas con cards horizontales.
- **Grid del contenedor cambia**:
  ```
  view=grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
  view=list: grid-cols-1                 lg:grid-cols-2
  gap:       gap-6 lg:gap-8 (común a ambos)
  ```
- El toggle persistirá la preferencia vía `?view=list` en la URL; al
  redimensionar la ventana el layout se adapta sin perder el modo.

#### Caso `showBookingCTA=true` + `orientation='horizontal'`

Es exactamente el caso de `/favorites` con `?view=list`. Decisiones:

- El CTA va al pie de la columna de contenido (derecha), no full-width
  del card. `fullWidth` del Button se interpreta como "100% del flex
  parent", que en este caso es la columna de contenido (60% del card).
- Separador `border-t border-divider-soft` antes del CTA, para distinguir
  visualmente features de acción.
- En mobile (card ~ ancho viewport menos padding), el bloque features
  puede envolverse a 2 líneas; el CTA queda debajo, full-width de la
  columna derecha. Sigue legible.
- Orden de tab focus: Link card → FavoriteButton → CTA visit. El CTA
  recibe focus al final dentro del scope de la card.

### Crear nuevos

| Componente              | Archivo                                              | Responsabilidad                                                                                                         | Client?                                                         |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `FavoritesSortDropdown` | `src/components/favorites/FavoritesSortDropdown.tsx` | Dropdown nativo (`<select>` estilizado) con 3 opciones de sort. On change, hace `router.push` con `?sort=` actualizado. | Sí (`'use client'`) — necesita `useRouter` y handlers de cambio |
| `FavoritesViewToggle`   | `src/components/favorites/FavoritesViewToggle.tsx`   | Par de IconButton `grid_view` / `view_list` con `aria-pressed`. On click, push con `?view=` actualizado.                | Sí (`'use client'`)                                             |
| `FavoritesEmptyState`   | `src/components/favorites/FavoritesEmptyState.tsx`   | Empty state full-width (sin favoritos en absoluto).                                                                     | No                                                              |
| `DiscoverMoreCard`      | `src/components/favorites/DiscoverMoreCard.tsx`      | La tarjeta "+" con borde discontinuo al final del grid.                                                                 | No                                                              |

Razón de la carpeta nueva `src/components/favorites/`: ya hay
`src/components/home/` y `src/components/search/`. Mantener el patrón "una
carpeta por pantalla específica" para piezas que sólo viven en
`/favorites`.

### `FavoritesSortDropdown` — detalle

Opciones:

- `date_desc` → "Más recientes" (default)
- `price_asc` → "Precio: menor a mayor"
- `price_desc` → "Precio: mayor a menor"

Implementación recomendada: `<select>` nativo estilizado (no popover
custom) — es la solución más accesible, consistente con `ListingTypeToggle`,
y sin dependencias extra. Estilo:

```
appearance-none bg-surface border border-transparent
rounded px-4 py-2.5 text-sm font-medium text-on-surface
shadow-sm hover:border-primary/30
focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
```

Con un `<Icon name="keyboard_arrow_down" />` superpuesto a la derecha vía
posicionamiento absoluto del label container.

Label visible: `Ordenar por: <opción seleccionada>`. La opción seleccionada
se reescribe en el `<option>` con el copy correspondiente.

### `FavoritesViewToggle` — detalle

Contenedor: `<div class="flex bg-surface rounded p-1 shadow-sm gap-1">`
con dos buttons del mismo ancho.

Estado activo (el view actual):

- `bg-surface-soft text-primary` (hint-green + mosque)

Estado inactivo:

- `text-muted hover:text-on-surface/70`

Ambos con `aria-pressed={view === 'grid'}` y `aria-label="Vista en
cuadrícula"` / `"Vista en lista"`.

### View `list` — comportamiento (resumen)

Cuando `?view=list`, cada `PropertyCard` se renderiza con
`orientation='horizontal'` y el grid cambia su `grid-template-columns`
según breakpoint (ver tabla en § Toggle vs responsive arriba):

- Mobile: 1 columna de cards horizontales.
- sm: 1 columna de cards horizontales (full-width).
- lg/xl: 2 columnas de cards horizontales.

Detalle completo del layout horizontal y del posicionamiento de
FavoriteButton/badges/CTA en § Extender: PropertyCard arriba.

## Tipografía

| Elemento              | Token                                                                                     | Notas                                  |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| H1 "Tus favoritos"    | `text-3xl md:text-4xl font-light text-on-surface`                                         | Inter 300, consistente con Home/Search |
| Subtítulo count       | `text-sm text-muted`                                                                      | body, peso 400                         |
| Botón sort label      | `text-sm font-medium text-on-surface`                                                     | title-2 weight                         |
| Discover More heading | `text-xl font-medium text-on-surface` (decisión: no `font-bold`, mantener tono editorial) |                                        |
| Discover More copy    | `text-sm text-muted`                                                                      |                                        |
| Empty state heading   | `text-xl font-medium text-on-surface`                                                     |                                        |

## Datos

### Server Component

`src/app/(app)/favorites/page.tsx` es Server Component (sin
`'use client'`). Hace una sola query con joins:

```sql
select
  f.created_at as favorited_at,
  p.id, p.title, p.address_line, p.city, p.state, p.country,
  p.price, p.previous_price, p.listing_type, p.property_type,
  p.bedrooms, p.bathrooms, p.area_sqm,
  p.is_featured, p.is_premium, p.published_at,
  pi.storage_path, pi.alt_text
from favorites f
inner join properties p on p.id = f.property_id
inner join property_images pi
  on pi.property_id = p.id and pi.is_main = true
where f.user_id = $1
  and p.listing_status = 'active'   -- ocultar pausadas/eliminadas
order by <según ?sort=>
```

Con `@supabase/ssr`:

```ts
supabase.from('favorites')
  .select(`
    created_at,
    properties!inner (
      id, title, address_line, city, state, country, price, previous_price,
      listing_type, property_type, bedrooms, bathrooms, area_sqm,
      is_featured, is_premium, published_at, listing_status,
      property_images!inner ( storage_path, alt_text, is_main )
    )
  `)
  .eq('user_id', user.id)
  .eq('properties.listing_status', 'active')
  .eq('properties.property_images.is_main', true)
  .order(...)
```

Mapear el resultado a `PropertyForCard[]` reutilizando la función
`toPropertyForCard` (ya existe en `queries.ts` — si la implementer la
encuentra inaccesible por estar `function` privada del módulo, exportarla
o crear una nueva función `getUserFavorites(supabase, userId, sort):
Promise<PropertyForCard[]>` en `src/lib/properties/queries.ts`).

**Recomendación**: agregar `getUserFavorites(supabase, userId, sort)` en
`queries.ts` para mantener `page.tsx` libre de SQL inline (mismo patrón
que `getFeaturedProperties`).

### Tablas Supabase consumidas

| Tabla             | Columnas                                      | RLS aplicable                                                                                                                              |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `favorites`       | `user_id, property_id, created_at`            | `select where user_id = auth.uid()` (ya existe)                                                                                            |
| `properties`      | columnas estándar de card (ver SELECT arriba) | `properties_select_active_anon` (mig 0013) cubre el SELECT incluso si el favorito apunta a una propiedad ya no-active (filtramos in-query) |
| `property_images` | `storage_path, alt_text, is_main`             | Política anon ya existente                                                                                                                 |

Como la página es protegida (middleware redirige si no hay user), nunca
veremos `user === null` aquí. Aún así, `page.tsx` debe usar
`getSessionAndProfile()` y manejar el caso `null` lanzando `notFound()`
o redirect explícito como cinturón-y-tirantes.

### Conteo (para el subtítulo)

El conteo es simplemente `properties.length` después de filtrar por
`listing_status = 'active'`. Si un favorito apunta a una propiedad
pausada, el conteo refleja sólo las visibles — esto es deliberado: no
queremos contar fantasmas que el user no ve.

## Interactividad

| Pieza                 | Server / Client                        | Motivo                         |
| --------------------- | -------------------------------------- | ------------------------------ |
| `page.tsx`            | Server                                 | Render del shell y query       |
| Sort dropdown         | Client                                 | `useRouter().push()` on change |
| View toggle           | Client                                 | Idem                           |
| Heart en cada card    | Client (ya existe en `FavoriteButton`) | Optimistic UI                  |
| CTA "Reservar visita" | Server (Link)                          | Navegación pura, sin estado    |
| Discover More CTA     | Server (Link)                          | Navegación pura                |

### Server Action involucrada

`toggleFavorite` (ya existe en `src/lib/properties/actions.ts`).
**Ya hace `revalidatePath('/favorites')`** en su implementación actual
(verificado), así que al des-favoritear:

1. El `useOptimistic` del `FavoriteButton` flipea el corazón al instante.
2. La server action borra la fila.
3. La revalidación fuerza re-fetch del Server Component padre.
4. La card desaparece del grid (porque ya no está en `favorites`).
5. El count del subtítulo decrementa.

### Persistencia de `?view`

**Recomendación: SOLO searchParam, sin cookie.**

Razones:

- La pantalla es protegida y vive en un solo lugar (`/favorites`). No
  tiene sentido propagar la preferencia a otras pantallas.
- Una cookie agrega round-trip + complejidad (server reads cookie, hidrata
  el toggle, sincroniza con URL). Con sólo searchParam: el `<Link>` que
  toca el toggle escribe `?view=list`, Next re-renderiza, listo.
- El "persiste en la sesión" del acceptance criterion se cumple con que
  la URL guarde el estado durante toda la sesión de navegación: bookmark,
  back/forward, refresh, share — todo funciona.
- Si el user vuelve a `/favorites` desde otra pantalla sin querystring,
  cae en el default `grid`. Aceptable.

Si el humano quiere persistencia entre sesiones, **agregar una cookie
`fav_view=grid|list`** como mejora posterior — es trivial pero no
necesario en V1.

Mismo razonamiento aplica a `?sort=`: solo searchParam.

## Estados

### Loading

`src/app/(app)/favorites/loading.tsx` con skeleton:

- Header skeleton: un `<div>` de 32px altura para H1 y 16px para el
  subtítulo, ambos con `bg-divider-soft rounded animate-pulse`.
- Toolbar skeleton: dos bloques pill `h-10` con `bg-divider-soft`.
- Grid skeleton: 4 cards skeleton reutilizando un componente
  `PropertyCardSkeleton` (ya hay un patrón animate-pulse en el HTML
  línea 287). **Crear `src/components/property/PropertyCardSkeleton.tsx`**
  si no existe — útil también para la home y search.

Verificación: revisar si ya existe algún skeleton en
`src/components/home/HomePageSkeleton.tsx` para reusar/extraer.

### Empty (sin favoritos)

`FavoritesEmptyState` full-width:

```
┌─────────────────────────────────────┐
│           [ icon favorite_border ]  │
│                                     │
│   Aún no guardaste propiedades      │
│                                     │
│   Toca el corazón en cualquier      │
│   propiedad para tenerla aquí.      │
│                                     │
│        [ Explorar propiedades ]     │ ← Button primary → href="/"
└─────────────────────────────────────┘
```

Tokens:

- Container: `bg-surface-soft rounded-xl px-4 py-16 text-center`
- Icon container: círculo `bg-surface h-16 w-16` con
  `<Icon name="favorite_border" size="xl" className="text-primary" />`
- H2: `text-xl font-medium text-on-surface`
- P: `text-sm text-muted max-w-md`
- Button: primary, `leadingIcon="search"`

Diferencia con `EmptyPropertiesState` de Home: ese empty habla de "no
encontramos propiedades", éste habla de "tu lista está vacía". Distinto
tono → componente separado.

### Estado intermedio: "tengo favoritos pero todos se pausaron"

Si el user tiene N favoritos pero TODAS sus propiedades están en
`listing_status !== 'active'`, el filtro las oculta y `properties.length
=== 0`. En ese caso mostramos el mismo `FavoritesEmptyState` pero con
copy alternativo:

- Heading: "Tus favoritos no están disponibles"
- Copy: "Las propiedades que guardaste fueron pausadas o eliminadas por
  sus dueños."
- CTA: "Explorar propiedades" → `/`

El componente recibe una prop `reason: 'never_favorited' |
'all_unavailable'` y pinta el copy correspondiente.

### Optimistic UI al des-favoritear

Comportamiento esperado, ya garantizado por `FavoriteButton` + revalidate:

1. User clickea el corazón lleno.
2. **Instante 0**: `useOptimistic` flipea el icono a `favorite_border`.
3. **Instante 0**: la card NO desaparece todavía (el server tiene que
   confirmar y revalidar).
4. **~100-300ms después**: la revalidación llega, la query del padre
   re-corre, la card desaparece del grid con un re-render.

**Mejora opcional (NO bloqueante para V1)**: envolver el grid en un
`<div>` con `view-transition-name` o usar `useTransition` + estado local
para que las cards desaparezcan con fade. **Recomendación: NO hacerlo
en V1** — el comportamiento default es funcionalmente correcto y la
animación entra como pulido posterior.

### Error

Si la query `getUserFavorites` falla, log + render del empty state con
copy especial:

- Heading: "No pudimos cargar tus favoritos"
- Copy: "Intenta refrescar la página."
- CTA: "Recargar" → button que llama `window.location.reload()` (Client
  Component mínimo) o un `<Link href="/favorites">Reintentar</Link>`.

**Recomendación**: usar el Link (server-friendly, recarga la query).

## Tokens y clases Tailwind

Todos los tokens necesarios YA EXISTEN en `globals.css`. No hay que
agregar nada nuevo. Inventario de uso:

| Pieza                                     | Token / utility                                                                                                                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fondo página                              | (heredado del body `bg-background`)                                                                                                                                                                                                                   |
| Card toolbar                              | `bg-surface shadow-card`                                                                                                                                                                                                                              |
| Toggle activo                             | `bg-surface-soft text-primary`                                                                                                                                                                                                                        |
| Toggle inactivo                           | `text-muted hover:text-on-surface/70`                                                                                                                                                                                                                 |
| CTA Reservar visita                       | Button `variant="secondary"` (ya da el outline mosque)                                                                                                                                                                                                |
| Discover More container                   | `bg-surface-soft rounded-xl border-2 border-dashed border-primary/30 hover:border-primary`                                                                                                                                                            |
| Discover More icon circle                 | `bg-surface-soft h-16 w-16 rounded-full`                                                                                                                                                                                                              |
| Discover More CTA                         | Button `variant="primary"`                                                                                                                                                                                                                            |
| Badge "En venta" (sale)                   | Reusar `<Badge variant="soft">En venta</Badge>` (ya existe en compact card como `bg-primary/90 text-on-primary` para rent y `bg-surface-inverse/90 text-on-surface-inverse` para sale — el patrón actual del CompactPropertyCard ya cumple, no tocar) |
| Card "Price Drop" / "New Listing" overlay | **FUERA DE SCOPE.** No tocar `derive-badges.ts`, no pintar overlays adicionales sobre la imagen. Ver decisión abajo.                                                                                                                                  |

**Decisión sobre badges del mockup (CERRADA por el humano):**

- "FOR SALE" / "FOR RENT" (esquina inferior izquierda): YA lo pinta
  `CompactPropertyCard` vía `deriveListingBadge`. Aplica idéntico en
  vertical y en horizontal. ✅
- "NEW LISTING" / "PRICE DROP" (overlay top-left sobre imagen): **FUERA
  DE SCOPE de esta feature.** El implementer **no debe** agregar lógica
  para estos badges en `derive-badges.ts`, ni renderizarlos en el
  CompactPropertyCard, ni en la card horizontal. Si en el futuro se quieren
  añadir, será una feature horizontal aparte que toque también Home y
  Search. El mockup queda intencionalmente sin estos overlays.

## Estructura semántica HTML

```html
<main id="main-content"> <!-- ya viene del layout (app) -->
  <div class="mx-auto max-w-7xl ...">
    <section aria-labelledby="favorites-heading" class="py-8 md:py-12">
      <header class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 id="favorites-heading">Tus favoritos</h1>
          <p>Tienes N propiedades guardadas.</p>
        </div>
        <div class="flex items-center gap-3" role="toolbar" aria-label="Ordenar y vista">
          <FavoritesSortDropdown ... />
          <FavoritesViewToggle ... />
        </div>
      </header>
    </section>

    {properties.length === 0
      ? <FavoritesEmptyState reason="never_favorited" />
      : <section aria-labelledby="favorites-heading">
          {/*
            El className del <ul> cambia según ?view=:
              view=grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 list-none"
              view=list: "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 list-none"
          */}
          <ul class={gridClassNameByView(view)}>
            {properties.map(p =>
              <li key={p.id}>
                <PropertyCard
                  property={p}
                  variant="compact"
                  orientation={view === 'list' ? 'horizontal' : 'vertical'}
                  isFavorite={true}
                  isAuthenticated={true}
                  showBookingCTA
                />
              </li>
            )}
            <li><DiscoverMoreCard /></li>
          </ul>
        </section>
    }
  </div>
</main>
```

Notas a11y:

- `role="toolbar"` agrupa los dos controles (sort + view).
- El grid como `<ul>` no es estrictamente necesario, pero ayuda a lectores
  de pantalla a anunciar "lista de N items". El `<article>` del
  PropertyCard se mantiene como child del `<li>`.
- `aria-pressed` en los buttons del view toggle.

## Riesgos / decisiones cerradas

Todos los puntos que requerían input humano fueron resueltos. Esta
sección queda como bitácora de las decisiones tomadas.

1. **Ruta `/property/[id]/visit` no existe aún** (decisión: aceptar 404
   temporal). La feature `schedule_a_visit` está más adelante en el
   backlog. El CTA "Reservar visita" apuntará a esa ruta y caerá en la
   404 default hasta que se construya. Cuando exista, no hay que tocar
   nada en `/favorites`. **Riesgo bajo, sin acción requerida.**

2. **Variante `list` de PropertyCard** (decisión: CARD HORIZONTAL
   COMPLETA, no simplificada). El humano confirmó que `?view=list` debe
   renderizar la card en layout horizontal real (imagen 40% / contenido
   60%) en todos los breakpoints, con el grid del contenedor adaptándose
   (1 col en mobile/sm, 2 cols en lg+). Detalle en § Extender:
   PropertyCard. **Decisión cerrada, sin acción requerida.**

3. **Badges overlay "NEW LISTING" / "PRICE DROP"** (decisión: FUERA DE
   SCOPE). El humano confirmó que estos overlays no se incluyen en esta
   feature. El implementer NO debe agregar lógica de price-drop ni
   new-listing en `derive-badges.ts` ni en `CompactPropertyCard`. Si más
   adelante se quieren, será una feature horizontal aparte. **Decisión
   cerrada, sin acción requerida.**

4. **`showBookingCTA` también afectaría Home/Search?** No: en Home/Search
   el CTA no aparece (`PropertyCard` con `variant="compact"` sin la
   prop). El default `false` garantiza que las pantallas existentes no
   cambian. **Sin riesgo.**

5. **`orientation='horizontal'` también afectaría Home/Search?** No: el
   default es `'vertical'` y Home/Search no pasan la prop. Mismo patrón
   de no-regresión que `showBookingCTA`. **Sin riesgo.**

6. **Conteo en subtítulo cuando hay favoritos pausados** (decisión:
   contar sólo activas). El subtítulo dice "Tienes N guardadas" donde
   N = propiedades activas mostradas. Si el user tiene 5 favoritos pero
   2 están pausadas, dice "3 guardadas". Aceptado en § Datos.

**Spec lista para implementer. No quedan preguntas abiertas.**

## Checklist de aceptación

Copio los criterios del `feature_list.json` y agrego los visuales que
emergen del mockup:

### Del feature_list (cumplir tal cual)

- [ ] `src/app/(app)/favorites/page.tsx` es Server Component (sin `'use client'`).
- [ ] Query única con join `favorites → properties → property_images` (main).
- [ ] Sort dropdown lee `?sort=date_desc | price_asc | price_desc` (default `date_desc`).
- [ ] Toggle grid/list lee `?view=grid|list` (default `grid`); persistencia vía searchParam.
- [ ] Cada card muestra el heart **lleno** (favorite icon, fondo mosque) y des-favoritear funciona con optimistic UI.
- [ ] Badge "En venta" (hint-green bg) / "En alquiler" (primary bg) en cada card. (Cubierto por `CompactPropertyCard`.)
- [ ] Botón "Reservar visita" navega a `/property/[id]/visit`.
- [ ] Empty state con ilustración (icon `favorite_border`) y CTA "Explorar propiedades" → `/`.
- [ ] Count en el header: "Tienes N propiedades guardadas" (singular/plural correcto).

### Criterios visuales adicionales del mockup

- [ ] H1 "Tus favoritos" con peso `font-light` (no bold) consistente con Home/Search.
- [ ] Subtítulo en `text-muted`.
- [ ] Toolbar (sort + view) se coloca a la derecha del header en `md+`, debajo en mobile.
- [ ] Sort dropdown estilizado con `bg-surface shadow-card` y chevron `keyboard_arrow_down`.
- [ ] View toggle: dos IconButton dentro de container `bg-surface rounded p-1 shadow-card`, con estado activo `bg-surface-soft text-primary`.
- [ ] Grid responsive en `?view=grid`: 1 / 2 / 3 / 4 columnas en mobile/sm/lg/xl.
- [ ] Tarjeta "Descubre más" al final del grid (sólo si N > 0): borde discontinuo, icono `+` en círculo verde, CTA primary "Explorar propiedades" → `/`.
- [ ] Para `listing_type === 'rent'`, el CTA al pie dice "Agendar tour" con icono `calendar_today` en vez de `arrow_forward`.
- [ ] La CTA al pie usa `Button variant="secondary" size="sm" fullWidth` y no propaga el click al `<Link>` que cubre la card (verificar manualmente).
- [ ] Loading state (`loading.tsx`) muestra skeleton de header + 4 cards skeleton.
- [ ] A11y: H1 con `id`, sort/view con `aria-label`, toggle con `aria-pressed`, toolbar agrupado con `role="toolbar"`.
- [ ] Contraste verificado en estado activo del view toggle (`text-primary` sobre `bg-surface-soft` cumple WCAG AA).

### Criterios para layout horizontal (`orientation='horizontal'` + `?view=list`)

- [ ] `PropertyCard` acepta prop `orientation: 'vertical' | 'horizontal'` con default `'vertical'`.
- [ ] En `'vertical'`, la card es **idéntica** al render actual (cero regresiones visuales en Home y Search).
- [ ] En `'horizontal'`, layout `flex flex-row`: imagen `w-2/5 shrink-0 aspect-[4/3]` a la izquierda, contenido `flex-1 min-w-0 p-4` a la derecha.
- [ ] En `'horizontal'`, el `<article>` aplica `min-h-[180px] sm:min-h-[200px]` para evitar cards aplastadas en filas con poca info.
- [ ] En `'horizontal'`, el `FavoriteButton` permanece `absolute top-3 right-3 z-20` sobre la imagen.
- [ ] En `'horizontal'`, el badge listing-type (`For Sale` / `For Rent`) permanece `absolute bottom-3 left-3 z-20` sobre la imagen.
- [ ] En `'horizontal'` con `showBookingCTA=true`, el CTA vive en `<div class="relative z-20 mt-auto pt-3 border-t border-divider-soft">` dentro de la columna de contenido (NO full-width del card, sí full-width de su columna).
- [ ] Bloque features (beds/baths/area) en horizontal usa `flex items-center gap-x-4 gap-y-2 flex-wrap` para que las pastillas envuelvan en cards angostos.
- [ ] El título y el address en horizontal usan `truncate` y la columna padre `min-w-0` (verificar que el truncado funciona en una sola línea cada uno).
- [ ] Cuando `?view=list`, el contenedor grid usa `grid-cols-1 lg:grid-cols-2` (NO 1 columna sola en desktop wide).
- [ ] Cuando `?view=grid`, el contenedor grid usa `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (sin cambios respecto a la spec original).
- [ ] El toggle persiste el modo vía `?view=` y el layout se re-adapta en cada breakpoint sin perder el modo seleccionado.
- [ ] El layout horizontal funciona en mobile (360-414px): card legible con imagen 40% y contenido 60%, features envolviendo si no caben en una línea.

### Exclusiones explícitas (NO implementar)

- [ ] El implementer NO agrega badges overlay "NEW LISTING" en la imagen.
- [ ] El implementer NO agrega badges overlay "PRICE DROP" en la imagen.
- [ ] El implementer NO modifica `derive-badges.ts` para añadir casos `new_listing` o `price_drop`.
- [ ] El implementer NO renderiza el `previous_price` tachado en la card (queda para otra feature).
