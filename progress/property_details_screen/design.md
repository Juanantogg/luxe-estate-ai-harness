# Design spec — property_details_screen

## Referencia visual

- Mockup: `docs/designs/property_details_screen/screen.png`
- HTML: `docs/designs/property_details_screen/code.html`

> El PNG manda sobre el HTML. El HTML usa colores `mosque/clear-day` que ya
> están normalizados en nuestros tokens, así que el mapeo es directo.

---

## 1. Resumen de la pantalla

Detalle profundo de una propiedad. Llega un visitante (anónimo o autenticado)
desde la home, los listados o un link compartido, y necesita: ver la galería
completa, los specs (m²/beds/baths/garage), la descripción, los amenities,
quién es el agente, dónde está ubicada y cómo agendar una visita. Es una
**página pública** (escaparate del portafolio) que escala su UI cuando el
visitante está logueado (heart funcional, CTAs sin redirect a login).

---

## 2. Ruta y acceso

| Aspecto                                                                       | Decisión                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta                                                                          | `/property/[id]`                                                                                                                                                                                                                                                    |
| Layout                                                                        | Vive bajo `src/app/(app)/property/[id]/page.tsx` (ya existe placeholder). Usa el `TopNav` variant `app` y su soporte para `session === null`.                                                                                                                       |
| Public/privada                                                                | **Pública.** NO se agrega a `protectedPaths` de `src/lib/supabase/proxy.ts`.                                                                                                                                                                                        |
| `params`                                                                      | `Promise<{ id: string }>` — `await params` (Next 16).                                                                                                                                                                                                               |
| `searchParams`                                                                | No se consume nada en MVP (la galería se controla con state cliente). Si llegan, se ignoran.                                                                                                                                                                        |
| Anónimo                                                                       | Render completo. El heart redirige a `/login?next=/property/[id]`. El CTA "Agendar visita" hace lo mismo (la pantalla de schedule sí es privada — feature siguiente). El CTA "Contactar al agente" también redirige a login (necesita escribir en `conversations`). |
| Logueado como `user`                                                          | UI completa con heart funcional, CTA "Agendar visita" → `/property/[id]/schedule` (feature siguiente; en este MVP enlaza pero la página aún no existe — ver §9).                                                                                                    |
| Logueado como `agent`/`broker`/`admin` (no dueño)                             | Mismo UI que `user`.                                                                                                                                                                                                                                                |
| Logueado como dueño (`owner_id == auth.uid()`)                                | Mismo render, pero el botón "Agendar visita" se sustituye por uno secundario "Ir al dashboard" (link a `/dashboard/properties/[id]/edit`). No tiene sentido que el dueño se agende a sí mismo. Decisión por defecto; ver §9 D4 si el humano prefiere ocultarlo.     |
| Property no existe / RLS la oculta                                            | `notFound()` de `next/navigation` → 404 nativo de Next con el `not-found.tsx` global (no hay uno custom en `(app)/`; basta el default).                                                                                                                             |
| Property en estado `draft`, `pending`, `sold`, `rented`, `archived` para anon | RLS bloquea (solo `active` se abrió a `anon` en migración 0013). Resultado: `notFound()`.                                                                                                                                                                           |
| Property `active`                                                             | Visible para todos. ✓                                                                                                                                                                                                                                               |
| Property en estado no-`active` para su dueño/admin                            | RLS sí lo deja leer, así que el dueño puede previsualizarla. Mostramos badge `Borrador` / `Pendiente` / `Vendido` / `Rentado` / `Archivado` en la cabecera del card de precio para que sea evidente.                                                                |

> **Decisión arquitectónica:** la página NO redirige manualmente a `/login` con
> `next=`. Hoy la RLS de `anon` ya devuelve la propiedad si está `active`. Si
> el visitante anónimo accede a una propiedad no-active, lo correcto es 404
> (no exponer su existencia). Las notas del feature_list mencionan redirigir
> a `/login?next=...` "si RLS bloquea"; eso era válido cuando la pantalla era
> privada. Ahora es pública: 404. Lo documento en §9 D2.

---

## 3. Datos

### 3.1 Query principal — Server Component

Una sola query con joins (`properties` ← `property_images`, `property_amenities`,
`profiles` como agente):

```ts
// Pseudocódigo del shape esperado en src/lib/properties/queries.ts → getPropertyDetail(supabase, id)
const { data, error } = await supabase
  .from('properties')
  .select(
    `
    id, title, description, price, previous_price,
    listing_type, listing_status, property_type,
    address_line, city, state, country, postal_code,
    latitude, longitude,
    bedrooms, bathrooms, area_sqm, parking_spaces, year_built,
    is_featured, is_premium, published_at, owner_id,
    property_images ( id, storage_path, alt_text, position, is_main ),
    property_amenities ( amenity ),
    owner:profiles!properties_owner_id_fkey (
      id, full_name, avatar_url, email, phone, role, city
    )
  `,
  )
  .eq('id', id)
  .maybeSingle();

if (error) throw error; // log + rethrow (Next mostrará error.tsx si lo hay)
if (!data) notFound(); // RLS oculta o no existe
```

Devolución aplanada vía un helper `toPropertyDetail(row)` paralelo al
`toPropertyForCard` actual: parsea numéricos (`price`, `bathrooms`,
`area_sqm`, `latitude/longitude`), ordena imágenes (`is_main` primero, luego
`position asc`), y normaliza el array de `property_amenities`.

### 3.2 Tablas y columnas consumidas

| Tabla                      | Columnas                                                                                | Para qué                                      |
| -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| `properties`               | (ver arriba; básicamente todo el row salvo `search_vector`, `created_at`, `updated_at`) | Header, specs, ubicación, descripción, badges |
| `property_images`          | `id, storage_path, alt_text, position, is_main`                                         | Galería                                       |
| `property_amenities`       | `amenity` (enum)                                                                        | Sección Amenities                             |
| `profiles` (alias `owner`) | `id, full_name, avatar_url, email, phone, role, city`                                   | Card del agente                               |

### 3.3 Query secundaria — favorito (solo logueado)

Reutilizar `getUserFavoriteIds(supabase, userId, [propertyId])` — devuelve un
`Set<string>`, comprobamos `set.has(propertyId)`. Mantiene el patrón ya
probado en home.

### 3.4 Conteo de favoritos de la propiedad (opcional, ver §9 D5)

```ts
const { count } = await supabase
  .from('favorites')
  .select('property_id', { count: 'exact', head: true })
  .eq('property_id', id);
```

RLS de `favorites` hoy bloquea anon y solo deja al dueño ver los suyos
(`favorites_select_own_or_admin`). Esto significaría que el count siempre da 0
para visitantes que no sean admin. **Recomendación**: no mostrar el count en
esta feature (no aparece en el mockup) → query NO se hace.

### 3.5 RLS — gaps abiertos a `anon` para que la página renderice completa

El mockup muestra info del agente (nombre, avatar) y amenities. Hoy:

| Tabla                | Política `anon` actual                        | Necesidad                              |
| -------------------- | --------------------------------------------- | -------------------------------------- |
| `properties`         | SELECT WHERE `listing_status='active'` (0013) | ✓                                      |
| `property_images`    | SELECT si parent active (0013)                | ✓                                      |
| `property_amenities` | **ninguna para `anon`** → bloqueado           | Falta abrir                            |
| `profiles`           | SELECT solo `authenticated`                   | Falta abrir lectura mínima para `anon` |

→ **Se propone una migración** `0014_anon_select_amenities_and_owner_profile.sql`
(ver §9 D1) que abre:

- `property_amenities` SELECT a `anon` cuando la `property` padre está `active`.
- `profiles` SELECT a `anon` **limitado a un subconjunto seguro de columnas**
  (`id, full_name, avatar_url, role, city`). Implementación: política con
  USING `exists (select 1 from properties p where p.owner_id = profiles.id and p.listing_status='active')`
  - lectura desde código solo de esas columnas (Postgres RLS no filtra a
    nivel columna; el filtro de columnas vive en el SELECT del cliente).
    Email y phone NUNCA se renderizan para anon (los gateamos en el client
    con `isAuthenticated`).

> Sin esta migración, anon vería la página pero sin amenities ni nombre del
> agente. Aceptable como degradación si el humano decide diferir; la spec
> entonces sigue funcionando, solo cae la calidad de la página para anon.
> Mi recomendación: aplicar la migración como parte de esta feature.

---

## 4. Layout y secciones

### 4.1 Estructura general

Container: `<main>` ya existente del `(app)/layout.tsx`. Dentro:

```
<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-20">
  <PropertyDetailHeader />          ← breadcrumb minimal + back link (móvil)
  <PropertyGallery />               ← main image + thumbnails
  <PropertyDetailGrid>              ← lg:grid-cols-12 gap-8
    <Columna principal lg:col-span-8>
      <PropertyFeatures />          ← grid 2x2 / 4x1 de specs
      <PropertyAbout />             ← descripción + "Leer más"
      <PropertyAmenitiesList />     ← grid 1x6 / 2x3 de chips
      <MortgageCalculatorCard />    ← banner hint-green, no funcional
    </>
    <Sidebar lg:col-span-4 sticky>
      <PriceAndAgentCard />         ← precio + dirección + agente + CTAs
      <PropertyMapPreview />        ← imagen estática + pin
    </>
  </PropertyDetailGrid>
</div>
<Footer />                          ← copyright + social (nuevo componente)
```

En mobile el grid colapsa a una sola columna; el orden visual sigue siendo:
galería → card de precio+agente (no sticky en mobile) → features → about →
amenities → map → mortgage. Es el orden natural de "quiero ver fotos, luego
contactar".

### 4.2 Header & breadcrumb (opcional pero pedido por UX coherente)

El mockup NO muestra breadcrumb explícito; el HTML tampoco. Mantenemos
simple: ningún breadcrumb. En mobile agregamos un link "← Volver" pequeño
sobre la galería usando `Link` + `Icon name="arrow_back"`. En `md+` se omite
(la TopNav cumple). Tokens: `text-muted hover:text-primary text-sm`.

### 4.3 Galería (`PropertyGallery`)

- Imagen principal: `relative aspect-[16/10] overflow-hidden rounded-xl shadow-card`.
- Badges arriba a la izquierda: `EXCLUSIVA` (si aplica) + `NUEVA` (si aplica).
  Reutilizar `deriveBadge()` y `deriveListingBadge()` + componente `Badge`.
- Badge inferior izquierda: estado de listing si NO es `active`
  (`Borrador`/`Pendiente`/`Vendido`/`Rentado`/`Archivado`) — variant `warning`
  o `neutral`. Solo visible para dueño/admin.
- Heart arriba a la derecha: `<FavoriteButton size="lg">` reutilizado.
- (No incluimos botón "Ver todas las fotos" + lightbox en MVP — ver §9 D6.
  Lo dejamos como CTA secundario inferior derecha: "Ver galería completa"
  que **solo hace scroll a las thumbnails** y muestra cursor → no abre
  modal. Ahorra una dependencia y un Client Component complejo).
- Thumbnails: fila scrollable horizontal debajo de la imagen principal.
  `flex gap-3 overflow-x-auto hide-scroll snap-x` (la utility `hide-scroll`
  ya existe en `globals.css`). Cada thumbnail: `flex-none w-32 sm:w-40
aspect-[4/3] rounded-lg overflow-hidden cursor-pointer ring-2 ring-transparent
hover:ring-primary/40`. La thumbnail activa: `ring-primary ring-offset-2
ring-offset-background`.
- Tap en thumbnail → cambia la `mainIndex`. Requiere ser **Client Component**
  porque hay state interno.

Tokens: `rounded-xl`, `shadow-card` para la imagen principal; `rounded-lg`
para thumbnails. Aspect ratios fijos para evitar layout shift.

**Edge cases**:

- 0 imágenes → render con `Icon name="apartment"` centrado sobre fondo
  `bg-surface-soft` con aspect-ratio igual, sin thumbnails ni heart? No: el
  heart sigue, badges siguen. Solo se reemplaza el `<Image>`.
- 1 imagen → no se muestra la fila de thumbnails.
- ≥ 2 → thumbnails como descritas; la main image siempre se incluye también
  como thumbnail (siguiendo el HTML).

### 4.4 Card de precio + agente (`PriceAndAgentCard`)

Mockup: card blanca rounded-xl con shadow-soft, sticky en `lg+` (`sticky top-24`).

- Precio: `text-3xl md:text-4xl font-light text-on-surface` con `formatPrice`.
  Para `listing_type='rent'` agregar sufijo `/mes` en `text-base text-muted`.
- Si `previous_price && price < previous_price`: tachado del previous arriba
  del precio actual: `text-sm line-through text-muted` + `Badge variant=success uppercase` "BAJÓ DE PRECIO".
- Dirección: `flex items-center gap-1 text-sm text-muted` con `Icon name="location_on" size="sm" className="text-primary"`. Texto: `address_line, city, state`.
- Divisor: `<div class="h-px bg-divider-soft my-6" />`.
- Bloque agente (`AgentBadge`, nuevo subcomponente):
  - `Avatar size="lg"` con `src={owner.avatar_url}`, fallback iniciales.
  - Nombre `font-semibold text-on-surface`.
  - Línea inferior: `Icon name="star" size="xs" className="text-primary"` + "Agente verificado" (label fijo en español; no hay "rating" en DB). Decisión: no usar "Top Rated Agent" del mockup porque no hay data — usar etiqueta del rol (`Agente`, `Broker`, `Administrador`) tomada de `profile.role`.
  - 2 IconButtons a la derecha: `chat` y `call`.
    - `chat` → si auth: `/property/[id]/contact` (no existe aún en MVP, redirige a `/login?next=...` o muestra toast "Próximamente"). Decisión por defecto: link a `mailto:{owner.email}` con `subject={title}`. Solo si auth (RLS de profiles oculta email a anon).
    - `call` → `tel:{owner.phone}` si `phone` existe; si no, escondido.
    - Si anon: ambos botones se mantienen visibles pero `onClick` redirige a `/login?next=/property/[id]`. UX consistente con `FavoriteButton`.
- CTAs (stacked, `space-y-3`):
  - Primario `<Button variant="primary" size="lg" fullWidth leadingIcon="calendar_today">Agendar visita</Button>`
    - Si auth y NO dueño: link a `/property/[id]/schedule`.
    - Si anon: link a `/login?next=/property/[id]/schedule`.
    - Si dueño: reemplazar por `<Button variant="secondary" size="lg" fullWidth leadingIcon="edit">Editar en dashboard</Button>` → `/dashboard/properties/[id]/edit`.
  - Secundario `<Button variant="secondary" size="lg" fullWidth leadingIcon="mail_outline">Contactar al agente</Button>`
    - Mismo gating que el chat IconButton.

### 4.5 Map preview (`PropertyMapPreview`)

Solo placeholder (no Google Maps real en MVP — confirmado en acceptance).

- Card `bg-surface rounded-xl shadow-card p-2`.
- Dentro: `aspect-[4/3] rounded-lg overflow-hidden bg-neutral-100 relative`.
- Imagen estática genérica: usar SVG inline o `next/image` con un PNG
  pequeño servido desde `/public/map-placeholder.png` (asset nuevo). **Si el
  PNG no existe**, el implementer crea un placeholder neutro (gris con grilla
  ligera) o usa puro CSS (un patrón de líneas) — no es bloqueante.
- Pin animado al centro: círculo `h-8 w-8 rounded-full bg-primary ring-4
ring-surface shadow-soft animate-bounce flex items-center justify-center` +
  `Icon name="home" className="text-on-primary text-sm"`.
- Link `Ver en Google Maps` absoluto abajo derecha, abre nueva pestaña con
  `https://www.google.com/maps/search/?api=1&query={lat},{lng}` si hay
  `latitude+longitude`, sino `?query={encodeURIComponent(address)}`.
- Tokens: `rounded-xl`, `shadow-card`, `bg-primary` para el pin.

### 4.6 Features (`PropertyFeatures`)

Card blanca `bg-surface rounded-xl shadow-soft border border-divider-soft p-6 md:p-8`.

- Título `text-lg font-semibold text-on-surface mb-6` "Características".
- Grid: `grid grid-cols-2 md:grid-cols-4 gap-4`.
- Cada celda: `flex flex-col items-center justify-center p-4 rounded-lg
bg-primary-soft border border-primary/10` con:
  - Icono arriba: `text-primary text-2xl mb-2` — íconos: `square_foot`
    (m²), `king_bed` (hab), `bathtub` (baños), `directions_car` (estacion.).
  - Número grande: `text-xl font-bold text-on-surface`.
  - Label: `text-xs uppercase tracking-wider text-muted`.

Si `area_sqm == null` → ocultar la celda de m². Si `parking_spaces == null
|| 0` → mostrar `0` (no esconder; las 4 celdas se ven más balanceadas).
Labels en español: "Metros cuadrados", "Habitaciones", "Baños", "Estacionamientos".

### 4.7 About this home (`PropertyAbout`)

Card blanca igual que Features.

- Título "Acerca de esta propiedad".
- `<div class="prose prose-sm max-w-none text-muted leading-relaxed">`
  con la `description` parseada por párrafos (split en `\n\n`). Sin
  HTML — solo `<p>` con whitespace-pre-wrap o split manual.
- Si la descripción excede ~280 caracteres: mostrar truncado a 280 chars
  con elipsis + botón "Leer más" `text-primary font-semibold` que expande
  inline. **Client Component** trivial (`useState`).
- Si `description == null || trim() === ''`: mostrar un mensaje suave
  "El agente aún no agregó una descripción." en `text-muted text-sm italic`.

### 4.8 Amenities (`PropertyAmenitiesList`)

Card blanca igual.

- Título "Amenidades".
- Grid `grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8`.
- Cada amenity: `flex items-center gap-3 text-on-surface`:
  - `Icon name="check_circle" size="sm" className="text-primary"`.
  - Label español (ver §8).
- Si no hay amenities: ocultar toda la card (no mostrar título vacío).

### 4.9 Mortgage calculator card (`MortgageCard`)

Banner destacado, NO funcional (acceptance lo pide explícito).

- Container: `bg-surface-soft rounded-xl border border-primary/10 p-6 flex
flex-col sm:flex-row items-center justify-between gap-6`.
- Lado izquierdo: `flex items-start gap-4`:
  - `<div class="p-3 bg-surface rounded-full text-primary shadow-card">
    <Icon name="calculate" />
     </div>`
  - Texto: título `font-semibold text-on-surface` "Calculadora de hipoteca"
    - subtítulo `text-sm text-muted` "Próximamente — estimación mensual con
      diferentes plazos y enganche."
- Lado derecho: `<Button variant="secondary" size="md" disabled>Próximamente</Button>`.

### 4.10 Footer (`Footer`, nuevo componente compartido)

El HTML del mockup incluye un footer con copyright + iconos sociales.
Reutilizable a futuro en otras pantallas de marketing.

- Container `bg-surface border-t border-divider mt-12 py-12`.
- Inner `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row
justify-between items-center gap-6`.
- Izquierda: `© 2026 Luxe Estate. Todos los derechos reservados.` (año
  dinámico con `new Date().getFullYear()`).
- Derecha: 2 IconButtons fantasma `facebook` y `twitter` (íconos via SVG
  inline porque material-icons no los trae; el HTML del mockup también usa
  SVGs). Para no introducir SVGs nuevos en `Icon`, dejarlo como `<a>`
  con SVG inline dentro. Aria-label "Facebook" / "Twitter".
- **Importante**: lo renderiza la PAGE, NO el `(app)/layout.tsx`. Si se
  agrega al layout, aparece también en la home y rompemos su diseño. La
  promoción a layout queda para una feature futura ("polish del shell
  público") y se documenta como decisión §9 D7.

### 4.11 Responsive — checklist

| Breakpoint       | Comportamiento                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 360-639 (mobile) | Una sola columna. Orden: galería → price card (no sticky) → features (2 cols) → about → amenities (1 col) → mortgage → map → footer. Padding `px-4 py-6`.                                 |
| 640+ (sm)        | Idem mobile pero `px-6`. Amenities pasan a 2 cols. CTAs ya cómodos.                                                                                                                       |
| 768+ (md)        | Features grid 4x1. Mortgage card horizontal. Padding `py-8`.                                                                                                                              |
| 1024+ (lg)       | Activa grid `grid-cols-12 gap-8`. Columna izquierda 8 cols (galería + features + about + amenities + mortgage). Columna derecha 4 cols con `sticky top-24` que contiene price card + map. |
| 1280+ (xl)       | Sin cambios estructurales. `max-w-7xl` ya tope el ancho.                                                                                                                                  |

---

## 5. Componentes nuevos

Todos los nuevos van en `src/components/property/` salvo `Footer` (compartido).

| Componente                                 | Path                                                | S/C                 | Props                                                                                                         | Por qué no reutilizar                                                                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PropertyGallery`                          | `src/components/property/PropertyGallery.tsx`       | **Client**          | `{ images: Array<{ id; src; alt }>; title: string; initialIndex?: number; renderOverlays?: React.ReactNode }` | State local (`mainIndex`). No hay primitivo para galería + thumbnails snap. Los overlays (badges, FavoriteButton) se pasan como children render-prop para mantener el componente desacoplado de `PropertyForDetail`. |
| `PriceAndAgentCard`                        | `src/components/property/PriceAndAgentCard.tsx`     | **Server**          | `{ property: PropertyForDetail; owner: OwnerProfile \| null; isAuthenticated: boolean; isOwner: boolean }`    | Composición específica de precio + dirección + agente + CTAs. Server porque solo lee datos y delega interactividad en `FavoriteButton` y `Link`.                                                                     |
| `AgentBadge`                               | `src/components/property/AgentBadge.tsx`            | **Server**          | `{ owner: OwnerProfile \| null; isAuthenticated: boolean; size?: 'md' \| 'lg' }`                              | Bloque reutilizable agente+rol+íconos contacto. Lo separamos porque también se usará en `schedule_visit_screen` (sidebar).                                                                                           |
| `PropertyFeatures`                         | `src/components/property/PropertyFeatures.tsx`      | **Server**          | `{ areaSqm: number \| null; bedrooms: number; bathrooms: number; parkingSpaces: number \| null }`             | Grid específico 2x2 / 4x1 con styling token-based; no calza en `Card` genérico.                                                                                                                                      |
| `PropertyAbout`                            | `src/components/property/PropertyAbout.tsx`         | **Client** (mínimo) | `{ description: string \| null }`                                                                             | Necesita `useState` para "Leer más". Mantener la lógica chiquita en una isla cliente — el resto de la card sigue siendo Server.                                                                                      |
| `PropertyAmenitiesList`                    | `src/components/property/PropertyAmenitiesList.tsx` | **Server**          | `{ amenities: AmenityKey[] }`                                                                                 | Mapeo enum→label con grid responsive. Pequeño y desacoplado para reutilizar en `add_edit_property_form` (futuro).                                                                                                    |
| `PropertyMapPreview`                       | `src/components/property/PropertyMapPreview.tsx`    | **Server**          | `{ latitude: number \| null; longitude: number \| null; address: string }`                                    | Construye la URL de Google Maps deterministic. No requiere JS cliente.                                                                                                                                               |
| `MortgageCard`                             | `src/components/property/MortgageCard.tsx`          | **Server**          | `{ price: number; listingType: ListingType }`                                                                 | Estático "próximamente"; recibe price por si se quiere mostrar una estimación textual placeholder (`Desde $X.XXX/mes con 20% de enganche`). Cálculo lo hace `format.ts` (helper nuevo `estimateMonthlyPayment`).     |
| `Footer`                                   | `src/components/layout/Footer.tsx`                  | **Server**          | (sin props)                                                                                                   | Footer estático. Path bajo `layout/` para separar de `nav/`. Si la carpeta no existe se crea.                                                                                                                        |
| Helper `getPropertyDetail`                 | `src/lib/properties/queries.ts` (extender)          | Server              | `(supabase, id) => Promise<PropertyForDetail \| null>`                                                        | Centraliza la query con joins + parsing.                                                                                                                                                                             |
| Helper `AMENITY_LABEL_ES` + `AMENITY_ICON` | `src/lib/properties/amenities.ts` (nuevo)           | Server              | Mapas estáticos                                                                                               | Mantener separado del query para reutilizar en filtros.                                                                                                                                                              |
| Helper `estimateMonthlyPayment`            | `src/lib/properties/format.ts` (extender)           | Server              | `(price, opts?) => number`                                                                                    | Fórmula amortización 30 años @ 6.5% por defecto, 20% down. Solo presentacional.                                                                                                                                      |
| `loading.tsx` para la ruta                 | `src/app/(app)/property/[id]/loading.tsx`           | Server              | (sin props)                                                                                                   | Skeleton específico — la home skeleton no aplica.                                                                                                                                                                    |

### 5.1 Esqueleto de tipo `PropertyForDetail`

```ts
export interface PropertyForDetail {
  id: string;
  title: string;
  description: string | null;
  price: number;
  previous_price: number | null;
  listing_type: ListingType;
  listing_status: ListingStatus;
  property_type: PropertyType;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  parking_spaces: number | null;
  year_built: number | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  owner_id: string;
  images: Array<{
    id: string;
    storage_path: string;
    alt_text: string | null;
    is_main: boolean;
    position: number;
  }>;
  amenities: AmenityKey[];
  owner: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null; // siempre null para anon (no se hidrata si !isAuthenticated)
    phone: string | null; // idem
    role: UserRole;
    city: string | null;
  } | null;
}
```

---

## 6. Tipografía

Toda Inter (única familia). Pesos disponibles 400/500/600/700 (más 300 ya
configurado vía next/font). Aplico la escala del design-system:

| Elemento                                            | Escala                                           | Token Tailwind                                                                           | Peso                           |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------ |
| Precio en card                                      | `display-3` (36px) → `display-2` (48px) en `md+` | `text-4xl md:text-5xl` (cercano) — usar `text-3xl md:text-4xl` para no romper sidebar lg | 300 / `font-light`             |
| Título de propiedad (h1, accesibilidad)             | `headline-1`                                     | `text-2xl md:text-3xl`                                                                   | 500 / `font-medium`            |
| Section titles (Características, About, Amenidades) | `headline-3` (20px)                              | `text-lg md:text-xl`                                                                     | 600 / `font-semibold`          |
| Nombre del agente                                   | `title-2` (16px)                                 | `text-base`                                                                              | 600                            |
| Address                                             | `body` (14px)                                    | `text-sm`                                                                                | 400 / `font-normal` text-muted |
| Specs grande (números 240/4/3/2)                    | `title-1` con bold                               | `text-xl`                                                                                | 700                            |
| Labels caption (m², habitaciones)                   | `caption` (12px) uppercase                       | `text-xs uppercase tracking-wider`                                                       | 500                            |
| Badges (EXCLUSIVA / NUEVA / EN VENTA)               | `overline`                                       | `text-[11px] uppercase tracking-wider` (ya en componente Badge)                          | 600                            |
| Body / descripción                                  | `body` (14px)                                    | `text-sm`                                                                                | 400, color `text-muted`        |

> Para que el `<h1>` siga las reglas de a11y (un único h1 por página), el
> nombre del título de la propiedad es h1; las secciones son h2; los
> subtítulos dentro son h3.

---

## 7. Interactividad

| Elemento                     | Comportamiento                                                                                                      | Estado                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Galería main + thumbnail tap | Cambia `mainIndex`. Animación suave (fade 200ms).                                                                   | idle / interacting (sin loading porque ya está cargada la imagen) |
| Heart                        | Optimistic via `FavoriteButton` existente. Anon: redirect.                                                          | idle / pending / error (silencioso)                               |
| "Leer más" descripción       | Toggle expand/collapse local.                                                                                       | idle                                                              |
| CTA "Agendar visita"         | `<Link>` a `/property/[id]/schedule` (auth) o `/login?next=...` (anon). No hay loading state propio.                | —                                                                 |
| CTA "Contactar al agente"    | Mismo patrón. Si auth, abre `mailto:` o navega a `/messages/new?property=...` (no existe en MVP — caemos a mailto). | —                                                                 |
| IconButtons chat/call        | `mailto:` / `tel:` (auth) o redirect a login (anon).                                                                | —                                                                 |
| Footer social links          | `<a target="_blank" rel="noopener">` con href `#` placeholder (no hay social real). Decisión §9 D7.                 | —                                                                 |
| Mortgage CTA                 | Disabled. No interactivo.                                                                                           | disabled                                                          |
| "Ver galería completa"       | `scrollIntoView` sobre la fila de thumbnails. Sin lightbox.                                                         | —                                                                 |

### 7.1 Server vs Client (resumen)

- **Server**: `page.tsx`, `PriceAndAgentCard`, `AgentBadge`, `PropertyFeatures`,
  `PropertyAmenitiesList`, `PropertyMapPreview`, `MortgageCard`, `Footer`.
- **Client**: `PropertyGallery` (state), `PropertyAbout` (toggle), y los ya
  existentes `FavoriteButton` (optimistic).

---

## 8. Server Actions

**Ninguna nueva**. Reutilizamos:

- `toggleFavorite({ propertyId })` de `src/lib/properties/actions.ts` —
  ya revalida `/property/[id]`.

Para `schedule_visit_screen` y `contact_agent` se crearán Server Actions en
sus features respectivas. En esta pantalla solo navegamos.

---

## 9. Mapeo de amenities (enum → label + ícono)

Enum oficial (confirmado desde `src/types/database.ts` líneas 494-505 y
`Constants.public.Enums.amenity_key`):

```
['pool','gym','wifi','air_conditioning','garden','smart_home','parking',
 'patio','wine_cellar','ev_charging','central_heating']
```

| `amenity_key`      | Label (es)               | Icono Material                              |
| ------------------ | ------------------------ | ------------------------------------------- |
| `pool`             | Piscina                  | `pool`                                      |
| `gym`              | Gimnasio                 | `fitness_center`                            |
| `wifi`             | Wi-Fi                    | `wifi`                                      |
| `air_conditioning` | Aire acondicionado       | `ac_unit`                                   |
| `garden`           | Jardín                   | `yard`                                      |
| `smart_home`       | Smart home               | `home_iot_device` (alt: `cottage`; ver §11) |
| `parking`          | Estacionamiento          | `local_parking`                             |
| `patio`            | Patio                    | `deck`                                      |
| `wine_cellar`      | Cava de vinos            | `wine_bar`                                  |
| `ev_charging`      | Carga vehículo eléctrico | `ev_station`                                |
| `central_heating`  | Calefacción central      | `thermostat`                                |

Implementación: dos objetos `Record<AmenityKey, string>` en
`src/lib/properties/amenities.ts`. **El mockup actual usa `check_circle` para
TODAS** las amenities; eso simplifica el render. Decisión: respetamos el
mockup → renderizamos `check_circle` siempre, y los íconos específicos quedan
mapeados pero NO se usan en esta pantalla. Se reservan para el modal de
filtros (`search_filters_modal`), donde tiene más sentido visual.

→ El spec por lo tanto define ambos mapas pero la UI de esta feature solo
consume `AMENITY_LABEL_ES`.

---

## 10. Edge cases y decisiones abiertas

### Decisiones abiertas (pido input humano)

| #      | Decisión                                                                                                                                                                                                 | Default propuesto                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | ¿Aplicar migración `0014_anon_select_amenities_and_owner_profile.sql` que abre `property_amenities` y un subset de `profiles` a `anon`?                                                                  | **Sí**, aplicar. Sin esto, los visitantes anónimos no ven amenities ni nombre del agente. Riesgo: exponer `profiles` aunque sea limitado. Mitigación: política con USING que filtra a perfiles dueños de al menos una `property active`, y en la query del client se piden solo `id, full_name, avatar_url, role, city`.                                                                                      |
| **D2** | Cuando el property no está `active` y el visitante es anónimo, ¿404 o `/login?next=...`?                                                                                                                 | **404.** La nota del feature_list ("redirigir a /login con next=") es legacy de cuando la pantalla era privada. Hoy es pública: 404 no filtra existencia y es coherente con RLS de anon.                                                                                                                                                                                                                      |
| **D3** | El acceptance pide CTA "Schedule Visit" funcional con navegación. La pantalla `/property/[id]/schedule` aún no existe (es la feature siguiente). ¿OK con que el link apunte ahí y dé 404 hasta entonces? | **Sí.** El criterio dice "navega a /property/[id]/schedule"; la navegación es el contrato, no que la página exista. La feature `schedule_visit_screen` lo levantará a continuación. Alternativa: dejar el botón disabled "Próximamente" hasta esa feature — la rechazo porque ensucia el flujo.                                                                                                               |
| **D4** | Si el visitante es el dueño de la propiedad (owner_id == auth.uid()), ¿qué hacer con los CTAs?                                                                                                           | **Reemplazar "Agendar visita" por "Editar en dashboard"**. Mantener "Contactar al agente" oculto (sería contactarse a sí mismo). Heart oculto también. Alternativa: dejar todo igual — la rechazo porque es confuso.                                                                                                                                                                                          |
| **D5** | ¿Mostrar contador de favoritos en la cabecera (ej. "12 personas guardaron esto")?                                                                                                                        | **No.** No aparece en el mockup. RLS hoy no lo permite a anon. Si en el futuro queremos prueba social, se agrega como mejora aparte.                                                                                                                                                                                                                                                                          |
| **D6** | ¿Lightbox real (modal con galería full-screen + flechas + ESC para cerrar) ahora o después?                                                                                                              | **Después.** En MVP el "Ver galería completa" hace scrollIntoView a las thumbnails. Razones: (a) reduce un Client Component complejo, (b) lazy-loadable a futuro sin romper API, (c) el mockup muestra el botón pero su comportamiento no está explícito en HTML (el HTML solo lo decora). Si el humano lo quiere ahora, el implementer agrega ~80-120 LOC con `useState` + `<dialog>` nativo + key handlers. |
| **D7** | Footer con iconos sociales Facebook/Twitter — ¿con qué URLs?                                                                                                                                             | **`href="#"` placeholders** (igual que el HTML del mockup). El humano puede sustituir cuando haya redes reales. Si prefiere, los ocultamos hasta tener URLs (esconder reduce ruido pero rompe paridad con el mockup).                                                                                                                                                                                         |
| **D8** | El mockup muestra "Top Rated Agent" estático bajo el nombre. No tenemos rating en DB. ¿Qué texto poner?                                                                                                  | **Etiqueta del rol traducida** ("Agente" / "Broker" / "Administrador"). Es factual y no inventa data.                                                                                                                                                                                                                                                                                                         |
| **D9** | Estructura URL para `schedule` y `contact`: ¿`/property/[id]/schedule` y `/property/[id]/contact`?                                                                                                       | **Schedule sí, contact no en esta feature.** Contact se difiere; usamos `mailto:` como puente. El acceptance dice "inicia conversation" — eso es una Server Action que vivirá en la feature de messaging (no listada en feature_list MVP). Documento la deuda.                                                                                                                                                |

### Edge cases cerrados

- **Property sin imágenes**: render con `Icon` placeholder centrado en aspect-ratio igual; heart y badges siguen.
- **Property sin amenities**: card oculta entera (no se ve título solo).
- **Property sin descripción**: mensaje suave "El agente aún no agregó una descripción.".
- **Property sin `area_sqm`**: celda de m² oculta; grid se ajusta a 3 cols en md+ (o 1 fila de 3 en grid de 4 que se ve aceptable; preferible esconder la celda y mantener centrado).
- **Property sin `latitude`/`longitude`**: link de Google Maps usa `?query={address}`.
- **Owner profile null** (caso edge: trigger no corrió): se renderiza el card sin agente, con un placeholder "Información del agente no disponible."
- **Owner sin `phone`**: botón de call oculto. `chat` queda solo.
- **Owner sin `email`**: botón `mail_outline` deshabilitado.
- **`previous_price` definido pero igual o mayor que `price`**: no se muestra badge "BAJÓ DE PRECIO". `deriveBadge` ya cubre esto.
- **Para anon, `owner.email` y `owner.phone` siempre `null`** porque ni la query los pide (filtro de columnas en client). Aunque la RLS dejara verlos, el client no los selecciona.
- **Texto multi-párrafo en descripción**: split por `\n\n` para mantener párrafos. Si excede 280 chars muestra "Leer más" sobre el contenido truncado.

---

## 11. Riesgos

| #   | Riesgo                                                                                                                 | Mitigación                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Apertura de `profiles` a `anon` filtra columnas sensibles sin querer                                                   | Política RLS con USING restrictivo (solo perfiles que sean dueños de al menos 1 property active) **y** el client selecciona explícitamente solo las 5 columnas seguras. Email/phone se hidratan a `null` si no auth. Documentado y verificable.                                                       |
| R2  | El ícono `home_iot_device` no existe en Material Icons clásico                                                         | Mapping deferido a la feature de filtros. En esta pantalla solo usamos `check_circle`. Riesgo neutralizado.                                                                                                                                                                                           |
| R3  | El placeholder de mapa puede no existir como asset                                                                     | El implementer crea un PNG genérico (o usa SVG inline / CSS pattern) — el spec no bloquea por esto.                                                                                                                                                                                                   |
| R4  | Performance: query con 4 joins (`images`, `amenities`, `profiles`) en un solo `.select()` puede ser pesada             | Es una sola row con sub-arrays chicos (≤ 10 imágenes, ≤ 11 amenities, 1 profile). Performance OK. Se podría paralelizar si las queries fueran independientes; no hace falta.                                                                                                                          |
| R5  | `next/image` para los placeholders Unsplash ya está configurado, pero las nuevas thumbnails podrían no respetar sizing | Aspect-ratio explícito en cada `<Image>` + `sizes="(max-width:640px) 40vw, 20vw"` para thumbnails y `(min-width:1024px) 66vw, 100vw` para la imagen principal.                                                                                                                                        |
| R6  | `useState` en `PropertyGallery` se pierde si el user navega a thumbnail externa                                        | No aplica — la galería vive dentro de una sola page render.                                                                                                                                                                                                                                           |
| R7  | Hidratación: `FavoriteButton` y `PropertyGallery` son client components anidados dentro de Server Components           | Patrón ya validado en `PropertyCard` de la home. Sin riesgo nuevo.                                                                                                                                                                                                                                    |
| R8  | Si el agente borra su `auth.users` row y `owner_id` queda dangling                                                     | FK `on delete restrict` en `properties.owner_id` lo bloquea; no puede ocurrir.                                                                                                                                                                                                                        |
| R9  | Botones que redirigen a `/login?next=/property/[id]/schedule` y la URL `/schedule` aún no existe → tras login, 404     | Acepta el riesgo (decisión §9 D3). En cuanto se implemente `schedule_visit_screen` queda resuelto. Mitigación temporal: si el implementer prefiere, puede dejar el `next=` apuntando a `/property/[id]` (la propia detail) hasta que exista la pantalla schedule. Lo dejo a criterio del implementer. |

---

## 12. Criterios de aceptación verificables

Tomados de `feature_list.json` → `property_details_screen` y enriquecidos con
"dónde se cumple". El reviewer puede marcar `[x]`.

- [ ] `src/app/(app)/property/[id]/page.tsx` es Server Component que hace `await params` (Next 16) → §2, §3.
- [ ] 404 si la propiedad no es visible (RLS) → §2 + §9 D2.
- [ ] Galería: imagen principal + thumbnails scrollables horizontal con `snap-x` → §4.3.
- [ ] Botón "Agendar visita" navega a `/property/[id]/schedule` cuando hay sesión → §4.4 + §9 D3.
- [ ] Botón "Contactar al agente" inicia conversation o `mailto:` como fallback → §4.4 + §9 D9 (deuda documentada).
- [ ] `FavoriteButton` funcional con optimistic UI (reutilizado) → §4.3, §7.
- [ ] Layout grid: `lg:col-span-8` gallery+features+about + `lg:col-span-4` sticky sidebar con price card + map → §4.1.
- [ ] Amenities: lee `property_amenities`, mapea `amenity_key` → label español → §4.8 + §9.
- [ ] Mortgage calculator card estática "Calculadora de hipoteca (próximamente)" → §4.9.
- [ ] Map placeholder: imagen estática + pin animado, sin Google Maps real → §4.5.
- [ ] Footer con copyright → §4.10.

Adicionales que el reviewer puede chequear:

- [ ] La página renderiza para visitante anónimo (`session === null`) sin errores y sin pintar CTAs como si pudieran mutar (heart/CTAs redirigen a `/login`).
- [ ] Tokens: cero hex en JSX. Todos los colores via `bg-*`/`text-*` semánticos.
- [ ] Mobile-first: en 360-414px se ve el orden vertical descrito en §4.11 y los specs caben en grid 2 cols.
- [ ] A11y: un único `<h1>`, alt en imágenes (de `property_images.alt_text` o fallback `property.title`), `aria-label` en IconButtons, focus visible en thumbnails y CTAs.
- [ ] Si el visitante es dueño, el CTA principal es "Editar en dashboard" y el heart está oculto (§9 D4).
- [ ] `getPropertyDetail` exportada desde `src/lib/properties/queries.ts` y tipada con `PropertyForDetail`.

---

## 13. Alternativas consideradas

### Opción A — Spec actual (sticky sidebar derecha en lg+, scroll vertical en mobile)

- **Pros**: paridad 1:1 con mockup. Sidebar sticky = CTA siempre visible en desktop. Patrón ya implementado en muchos sitios de real estate (Idealista, Redfin).
- **Contras**: el sticky requiere `position: sticky` con `top` calculado considerando el TopNav (h-16/h-20). Pequeño riesgo de "salto" si el alto del TopNav cambia.

### Opción B — CTA sticky abajo en mobile + columna única en desktop

- **Pros**: simplifica el layout (sin grid 12 cols). El CTA "Agendar visita" siempre visible en mobile (mejora conversión).
- **Contras**: se aleja del mockup. Duplica la card de precio (una arriba para mostrar precio + agente y una sticky abajo solo con CTA). Más componentes, más estado.

### Opción C — Tabbed layout (Galería | Detalles | Agente | Ubicación)

- **Pros**: muy compacto en mobile.
- **Contras**: muy lejos del mockup. Esconde info que el visitante quiere ver de un vistazo (specs + amenities). Estándar inferior de la industria.

### Recomendación: **A**.

Es el contrato visual; B y C son mejoras de conversión que requerirían
re-validar con producto. El sticky en desktop + scroll natural en mobile es
el patrón de la industria y mockup confirma.

---

## Notas finales

- **Idioma**: todos los strings van directamente en JSX en español neutro
  (es-MX/es-ES). Sin diccionarios.
- **A11y verificada**: jerarquía `h1 > h2 > h3`, alt en imágenes, aria-labels
  en IconButtons, navegación por teclado en thumbnails (`tabIndex={0}` +
  `onKeyDown` Enter/Space), focus rings consistentes con el sistema.
- **Reutilización**: `AgentBadge` se piensa pensando en `schedule_visit_screen`,
  `PropertyAmenitiesList` se piensa pensando en `add_edit_property_form`,
  `Footer` se piensa pensando en una eventual promoción a layout (§9 D7).
- **No-deuda nueva**: no se introducen libs nuevas, no se introducen tokens
  nuevos, no se modifica el sistema base.
