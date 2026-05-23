# Design spec — home_discover_screen

> **Estado**: APROBADO por humano el 2026-05-22 — listo para implementación.
>
> Decisiones de aprobación:
>
> - R4 (badges idioma): traducir al español → EXCLUSIVA / NUEVA / EN VENTA / EN RENTA.
> - R5 (fallback New in Market): activado por defecto (`includeOlderIfEmpty: true`).
> - R7 (full-text search): diferida a `search_filters_modal`; placeholder `/search` solo navega.
> - R13 (cambio de modelo del shell `(app)/`): documentado en CLAUDE.md como parte de esta feature.
> - R14 (convención de migraciones): confirmada `NNNN_` → `0013_anon_select_active_properties.sql`.
> - Alcance público ampliado: home + property detail + search son públicos. TopNav variant `app` con CTAs anónimos. (Override de §14 R1 y §16 Alt B; ver §18.)
>
> El leader cometió un error de sobreescritura el 2026-05-22; el usuario restauró el archivo con Ctrl-Z.

---

> Primera feature que materializa el sistema visual real sobre el `(app)/` shell. Renderiza la Home `/` (Discover) que el usuario ve tras login: hero con búsqueda + chips, Featured Collections (2 cards grandes) y New in Market (grid responsive). Incluye un `PropertyCard` reutilizable, heart con optimistic UI, toggle Buy/Rent y paginación "Load more" server-side.

## Referencia visual

- Mockup: `docs/designs/home_discover_screen/screen.png`
- HTML: `docs/designs/home_discover_screen/code.html`

> El TopNav del HTML original NO se replica: ya existe `src/components/nav/TopNav.tsx` (Server Component) que el layout `(app)/layout.tsx` monta arriba. La spec se ocupa solo del `<main>`.

---

## 1 · Resumen ejecutivo

### Rutas que se crean / mueven

- **Mover**: `src/app/page.tsx` (placeholder actual) → `src/app/(app)/page.tsx`. Esto es lo que el acceptance pide explícitamente y lo que `app_shell` dejó pendiente. La home queda envuelta por `(app)/layout.tsx`, que ya redirige a `/login` si no hay sesión. **Decisión**: la Home es ruta autenticada; no hay landing pública en el MVP (coherente con que el resto del shell exige sesión y con el TopNav que asume `user/profile`).
- **Crear placeholder mínimo**: `src/app/(app)/search/page.tsx` — página estática "Búsqueda — próximamente" que evita 404 cuando el Submit del search bar o el icono lupa del TopNav navegan a `/search`. La página real es la feature `search_filters_modal` (status `pending`).
- **No tocar**: middleware (`/` ya queda cubierto porque NO está en `protectedPaths` pero el layout `(app)/` sí redirige; ver §13 / Riesgos).

### Componentes nuevos

- `src/components/property/PropertyCard.tsx` — Server Component con dos variantes (`featured`, `compact`). Reutilizable en favorites, dashboard, search.
- `src/components/property/FavoriteButton.tsx` — Client Component "use client", maneja optimistic UI del corazón. Recibe `propertyId`, `initialIsFavorite`, `isAuthenticated`.
- `src/components/property/PriceTag.tsx` — helper presentacional (formatea `$5,250,000` o `$3,200/mo`). Server Component puro.
- `src/components/property/ListingTypeToggle.tsx` — Client Component, toggle Buy/Rent que escribe `?listing=` en la URL (router.replace, scroll false).
- `src/components/home/HeroSearch.tsx` — Client Component (sólo lo necesario: el `<form>` que navega a `/search?q=`). Los chips de tipo son links (Server). El bloque hero es Server por defecto.
- `src/components/home/PropertyTypeChips.tsx` — Server Component que renderiza `<Link>`s a `/?type=...` reutilizando `Chip` (variant `selected` para el activo) + botón "Filters" (link a `/search?filters=open`, placeholder hasta `search_filters_modal`).
- `src/components/home/LoadMoreLink.tsx` — Server Component (un `<Link>` que aumenta `?limit=`). Justificación: paginación server-side; no necesita estado cliente.
- `src/components/home/EmptyPropertiesState.tsx` — Server Component para el empty state.
- `src/components/home/HomePageSkeleton.tsx` — Server Component que renderiza `loading.tsx` (skeleton de hero + 2 featured + 4 cards compact).

### Server Action nueva

- `src/lib/properties/actions.ts` — `toggleFavorite(propertyId: string)`. Valida con zod, alterna entre INSERT y DELETE en `favorites`, revalida `/`, `/favorites`, `/property/[id]`.

### Lib helpers nuevos

- `src/lib/properties/queries.ts` — funciones puras tipadas para los selects (`getFeaturedProperties`, `getNewInMarketProperties`, `getUserFavoriteIds`). Mantienen la `page.tsx` legible.
- `src/lib/properties/format.ts` — `formatPrice`, `formatArea` (separadores de miles `es-MX`, símbolo `$`, sufijo `/mo`, `m²`).
- `src/lib/properties/derive-badges.ts` — `deriveBadge(property)` que devuelve `{ label, variant }`. Regla canónica (ver §3.4).

### Componentes existentes que se reutilizan tal cual

`Card`, `Button`, `Chip`, `Badge`, `Icon`, `Input`, `IconButton`, `TopNav`. No se modifica ninguno.

---

## 2 · Layout por sección

Estructura del `<main>`:

```
<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
  <Hero />                  {/* py-12 md:py-16 */}
  <FeaturedCollections />   {/* mb-16 */}
  <NewInMarket />
</div>
```

> Nota: el `<main>` global vive en `(app)/layout.tsx`. La home renderiza directamente el `<div>` contenedor.

### 2.1 Hero

Referencia: `code.html` líneas 94-132. PNG: bloque superior centrado.

- Contenedor: `max-w-3xl mx-auto text-center space-y-8`.
- **Título** `<h1>` mobile-first: `text-4xl md:text-5xl lg:text-6xl font-light leading-tight text-on-surface`.
  - Texto: `Encuentra tu <span>refugio</span>.` (decisión de traducción: "sanctuary" → "refugio"; mantiene el tono editorial).
  - El span "refugio" lleva `font-medium` y un subrayado decorativo (`<span class="absolute bottom-2 left-0 w-full h-3 bg-primary/20 -rotate-1 z-0">`). Token: `bg-primary/20` (Tailwind permite opacidad sobre token).
- **Search bar** (`HeroSearch` Client):
  - `<form action="/search" method="get">` con `<input name="q">`. Submit por defecto navega a `/search?q=...`. Sin JS también funciona.
  - Visual: contenedor `relative max-w-2xl mx-auto`; input `block w-full pl-12 pr-28 py-4 rounded-xl border-none bg-surface text-on-surface shadow-soft placeholder:text-muted/70 focus:ring-2 focus:ring-primary text-lg`; icono `search` (Icon size lg) absoluto a la izquierda; botón submit absoluto a la derecha (`Button variant="primary" size="md"` con texto "Buscar"). El input requiere `aria-label="Buscar propiedades"`.
  - El `Input` primitivo NO se usa aquí: tiene `h-10` fijo, label opcional arriba y no soporta botón submit absoluto sin overrides. Se construye inline con tokens. **Decisión**: no extender `Input` por un caso visual único.
- **Chips de quick filter** (`PropertyTypeChips` Server):
  - Wrapper: `flex items-center justify-center gap-3 overflow-x-auto hide-scroll py-2 px-4 -mx-4`.
  - Una `hide-scroll` utility: añadirla a `globals.css` como clase global (no es token; es utility puro). **Decisión**: agregar en `globals.css` debajo de `body` un bloque `@layer utilities` con `.hide-scroll`.
  - Chips: `All / Casa / Apartamento / Villa / Penthouse`. El chip activo (basado en `searchParams.type`) usa `<Chip variant="selected" size="md">`; el resto `<Chip variant="default" size="md">`. Cada chip es un `<Link>` envolviendo un `<Chip asStatic>` (porque `Chip` ya soporta `asStatic`).
  - Divider visual: `<div class="w-px h-6 bg-divider mx-2" />`.
  - Botón Filters: `<Button variant="ghost" size="sm" leadingIcon="tune">Filtros</Button>` que linkea a `/search?filters=open` (placeholder).

### 2.2 Featured Collections

Referencia: HTML 134-213. PNG: dos cards grandes "Exclusive" / "New Arrival".

- Header de sección:
  ```
  <div class="flex items-end justify-between mb-8">
    <div>
      <h2 class="text-2xl font-light text-on-surface">Colecciones destacadas</h2>
      <p class="text-muted mt-1 text-sm">Propiedades curadas para el ojo exigente.</p>
    </div>
    <Link class="hidden sm:flex items-center gap-1 text-sm font-medium text-primary hover:opacity-70" href="/search?featured=true">
      Ver todas <Icon name="arrow_forward" size="sm" />
    </Link>
  </div>
  ```
- Grid: `grid grid-cols-1 lg:grid-cols-2 gap-8`.
- Contenido: máx. 2 `PropertyCard variant="featured"`. Si hay 0 o 1, llenar con el primero del query y omitir la sección si query devuelve 0 (esconder header también). En PNG aparecen 2: si la DB tiene >2 featured, se toman los 2 más recientes (`order by published_at desc`).

### 2.3 New in Market

Referencia: HTML 214-407. PNG: grid de cards más chicas.

- Header (`flex items-end justify-between mb-8`):
  - Izquierda: `<h2>Nuevas en el mercado</h2>` + caption `<p>Oportunidades frescas agregadas esta semana.</p>` (tono editorial; el copy del PNG dice "this week" pero la regla técnica es <30 días — copy genérico para no engañar).
  - Derecha: `ListingTypeToggle` (visible `hidden md:flex`) con tres botones segment: `Todas / Comprar / Rentar`. Wrapper: `bg-surface p-1 rounded-lg`; botón activo `bg-surface-inverse text-on-surface-inverse shadow-sm`; inactivos `text-muted hover:text-on-surface`. Padding por botón `px-4 py-1.5 rounded text-sm font-medium`.
  - En mobile (sin md), el toggle se renderiza como una fila de chips justo debajo del header: `flex md:hidden gap-2 mb-4`.
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`.
- Footer del bloque: `<div class="mt-12 text-center"><Button variant="secondary" size="lg" asChild?>Cargar más propiedades</Button></div>`. `Button` no expone `asChild`, así que el "Load more" es un `<Link>` estilizado con las clases del botón secondary inline (`LoadMoreLink` componente helper).

---

## 3 · Componente `PropertyCard`

### 3.1 Ubicación

`src/components/property/PropertyCard.tsx`. Server Component (no necesita estado: el corazón es un sub-componente cliente).

### 3.2 Props

```ts
type PropertyCardVariant = 'featured' | 'compact';

interface PropertyCardProps {
  property: PropertyForCard; // tipo compuesto, ver §4
  variant: PropertyCardVariant;
  isFavorite: boolean; // resuelto en el server con el set de favoritos del user
  isAuthenticated: boolean; // si false, el corazón redirige a /login?next=/
  priority?: boolean; // para next/image — true en las primeras 2 cards above-the-fold
}
```

### 3.3 Estructura visual

#### Variant `featured`

HTML 145-178.

- Wrapper `<article class="group relative rounded-xl overflow-hidden shadow-soft bg-surface">`. Hover hace `shadow-soft-hover` (transition-shadow).
- Sección imagen: `aspect-[4/3] w-full overflow-hidden relative`.
  - `<Image>` `fill` con `object-cover transition-transform duration-700 group-hover:scale-105`. `sizes="(min-width:1024px) 50vw, 100vw"`. `priority={priority}`.
  - Badge top-left: `<Badge variant="soft" size="sm" uppercase>EXCLUSIVE | NEW ARRIVAL</Badge>` (regla §3.4). Position: `absolute top-4 left-4`.
  - `FavoriteButton` top-right: `absolute top-4 right-4` size `lg`.
  - Overlay gradiente bottom: `absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-60` — decisión: mantener `black` con opacidad porque es overlay decorativo (no es color de marca; equivalente al `from-black/60` del HTML; `black` es valor Tailwind nativo, no hex literal).
- Sección contenido: `p-6 relative`.
  - Fila superior `flex justify-between items-start mb-2`:
    - Izq: `<h3 class="text-xl font-medium text-on-surface group-hover:text-primary transition-colors">{title}</h3>` + ubicación `<p class="text-muted text-sm flex items-center gap-1 mt-1"><Icon name="place" size="sm" />{city}, {state ?? country}</p>`.
    - Der: `<PriceTag amount={price} listingType={listing_type} variant="featured" />`. Tipografía: `text-xl font-semibold text-primary`.
  - Specs (`flex items-center gap-6 mt-6 pt-6 border-t border-divider-soft`):
    - 3 ítems: `<Icon name="king_bed" size="md" />{bedrooms} hab`, `bathtub` `{bathrooms} baños`, `square_foot` `{area_sqm} m²`. Cada ítem con `text-muted text-sm flex items-center gap-2`.
    - Si `area_sqm == null`, se omite ese ítem.

#### Variant `compact`

HTML 227-255.

- Wrapper `<article class="bg-surface rounded-xl overflow-hidden shadow-card hover:shadow-soft transition-all duration-300 group cursor-pointer h-full flex flex-col">`.
- Sección imagen: `relative aspect-[4/3] overflow-hidden`.
  - `<Image>` `fill` `sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"`.
  - `FavoriteButton` size `md`, position `absolute top-3 right-3`.
  - Listing badge bottom-left `absolute bottom-3 left-3`: `<Badge variant="inverse" size="sm" uppercase>EN VENTA</Badge>` (sale) o `<Badge variant="primary" size="sm" uppercase>EN RENTA</Badge>` (rent). Wrapper: `bg-surface-inverse/90 text-on-surface-inverse` y `bg-primary/90 text-on-primary` con `backdrop-blur-sm`. **Decisión**: extender `Badge` no — usar `className` override `bg-surface-inverse/90 backdrop-blur-sm` cuando se necesite. Si crece, se promueve a variant nueva.
- Sección contenido: `p-4 flex flex-col flex-grow`.
  - Precio: `<PriceTag amount={price} listingType={listing_type} variant="compact" />` → `text-lg font-bold text-on-surface` con `/mo` en `text-sm font-normal text-muted` si rent.
  - Título `<h4 class="text-on-surface font-medium truncate mb-1">`.
  - Dirección `<p class="text-muted text-xs mb-4">{address_line}, {city}</p>`.
  - Footer (mt-auto): `flex items-center justify-between pt-3 border-t border-divider-soft`.
    - 3 ítems compactos: `Icon size="sm" className="text-primary/80"` + texto `text-muted text-xs`. Mismos 3 datos (beds/baths/area).
- Click en card: navega a `/property/{id}`. Implementación: envolver el `<article>` en `<Link>` ó usar pattern de "card link" (h3 con `<Link>` que se expande con `::before absolute inset-0`). **Decisión**: pattern de link absoluto sobre el título, para que el corazón siga siendo clickeable sin `stopPropagation`. La spec dice cómo:
  ```
  <article class="relative ...">
    <Link href={`/property/${id}`} class="absolute inset-0 z-10" aria-label={`Ver detalle de ${title}`}>
      <span class="sr-only">{title}</span>
    </Link>
    {/* imagen, contenido, etc. */}
    <FavoriteButton class="relative z-20" />
  </article>
  ```

### 3.4 Reglas de derivación de badges

Función `deriveBadge(property)` en `src/lib/properties/derive-badges.ts`:

- **EXCLUSIVE** (top-left, ambas variantes destacadas): `property.is_premium === true` **o** `property.is_featured === true && price > 3_000_000`. **Decisión**: usar `is_premium` como señal canónica de exclusividad; el segundo criterio aplica solo si no hay `is_premium` (compatibilidad con seed actual).
- **NEW ARRIVAL** (top-left): `published_at > now() - 7 days` **y** no es EXCLUSIVE. Si ambas condiciones aplican, prioridad EXCLUSIVE.
- **PRICE DROP** (no aparece en este mockup pero la regla queda lista): `previous_price !== null && price < previous_price`. **Decisión**: no se renderiza en home (mantener fidelidad al PNG), pero la función la devuelve para uso futuro.
- **FOR SALE / FOR RENT** (bottom-left compact): siempre, derivado de `listing_type`. Etiquetas en español: "EN VENTA" / "EN RENTA".

Salida tipada:

```ts
type DerivedBadge = { kind: 'exclusive' | 'new_arrival' | 'price_drop' | null };
type ListingBadge = { kind: 'sale' | 'rent'; label: 'EN VENTA' | 'EN RENTA' };
```

### 3.5 Estados del card

- **default**: como arriba.
- **hover**: `group-hover:shadow-soft-hover` + `group-hover:scale-105` en imagen + título cambia a `text-primary` en variant featured.
- **focus** (cuando el link del card recibe foco con tab): el `<article>` muestra `focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2` para a11y.
- **loading**: no aplica a la card individual; el page entero usa `loading.tsx` con skeletons. Si una imagen tarda, `next/image` ya muestra blur placeholder (futuro; en seed actual no hay blur data, así que `placeholder="empty"`).

---

## 4 · Data fetching

### 4.1 Tipos compuestos

```ts
// src/lib/properties/queries.ts
export type PropertyForCard = {
  id: string;
  title: string;
  address_line: string;
  city: string;
  state: string | null;
  country: string | null;
  price: number;
  previous_price: number | null;
  listing_type: 'sale' | 'rent';
  property_type:
    | 'house'
    | 'apartment'
    | 'villa'
    | 'penthouse'
    | 'condo'
    | 'townhouse'
    | 'commercial';
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  is_featured: boolean;
  is_premium: boolean;
  published_at: string | null;
  main_image: { storage_path: string; alt_text: string | null } | null;
};
```

### 4.2 Select para Featured

```ts
async function getFeaturedProperties(supabase: SupabaseClient): Promise<PropertyForCard[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      `
      id, title, address_line, city, state, country, price, previous_price,
      listing_type, property_type, bedrooms, bathrooms, area_sqm,
      is_featured, is_premium, published_at,
      property_images!inner ( storage_path, alt_text, is_main, position )
    `,
    )
    .eq('listing_status', 'active')
    .eq('is_featured', true)
    .eq('property_images.is_main', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(2);
  if (error) throw error;
  return (data ?? []).map(toPropertyForCard);
}
```

- **Por qué `!inner` + `eq('property_images.is_main', true)`**: garantiza que solo trae propiedades con una imagen marcada como main. Si una propiedad no tiene imagen main no aparece (decisión razonable: una card sin foto rompe la UX). El seed garantiza una main por propiedad (`property_images_one_main_idx`).
- `toPropertyForCard` aplana `property_images[0]` a `main_image`.

### 4.3 Select para New in Market

```ts
async function getNewInMarketProperties(
  supabase: SupabaseClient,
  opts: { listingType?: 'sale' | 'rent'; propertyType?: string; limit: number },
): Promise<{ items: PropertyForCard[]; hasMore: boolean }> {
  const NEW_WINDOW_DAYS = 30;
  const since = new Date(Date.now() - NEW_WINDOW_DAYS * 86_400_000).toISOString();

  let q = supabase
    .from('properties')
    .select(`...mismas columnas..., property_images!inner(...)`, { count: 'exact' })
    .eq('listing_status', 'active')
    .eq('property_images.is_main', true)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(opts.limit + 1); // pedimos uno extra para detectar hasMore

  if (opts.listingType) q = q.eq('listing_type', opts.listingType);
  if (opts.propertyType && opts.propertyType !== 'all') {
    q = q.eq('property_type', opts.propertyType);
  }

  const { data, error } = await q;
  if (error) throw error;
  const all = (data ?? []).map(toPropertyForCard);
  return {
    items: all.slice(0, opts.limit),
    hasMore: all.length > opts.limit,
  };
}
```

- **Fallback si no hay "nuevas"**: si `items.length === 0` y no se aplicaron filtros, repetimos la query sin `gte('published_at', since)` (todas las active) — así la home nunca se ve vacía mientras el seed no rote. **Decisión**: documentar el fallback aquí y dejarlo opt-in via flag `includeOlderIfEmpty` para que el reviewer pueda quitarlo si decide priorizar honestidad sobre densidad.

### 4.4 Favoritos del usuario sin N+1

```ts
async function getUserFavoriteIds(
  supabase: SupabaseClient,
  userId: string,
  propertyIds: string[],
): Promise<Set<string>> {
  if (propertyIds.length === 0) return new Set();
  const { data } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('user_id', userId)
    .in('property_id', propertyIds);
  return new Set((data ?? []).map((r) => r.property_id));
}
```

Una sola query con `IN (...)` sobre los IDs de las cards ya cargadas. RLS de `favorites` permite SELECT del propio user.

### 4.5 Flujo completo en `page.tsx`

```ts
export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const session = await getSessionAndProfile(); // layout ya garantiza user; aquí lo usamos

  const propertyType = typeof sp.type === 'string' ? sp.type : 'all';
  const listingType = sp.listing === 'rent' ? 'rent' : sp.listing === 'sale' ? 'sale' : undefined;
  const limit = Math.min(Math.max(parseInt(String(sp.limit ?? '8'), 10) || 8, 8), 48);

  const [featured, newInMarket] = await Promise.all([
    getFeaturedProperties(supabase),
    getNewInMarketProperties(supabase, {
      listingType,
      propertyType,
      limit,
      includeOlderIfEmpty: true,
    }),
  ]);

  const allIds = [...featured.map((p) => p.id), ...newInMarket.items.map((p) => p.id)];
  const favoriteIds = session?.user
    ? await getUserFavoriteIds(supabase, session.user.id, allIds)
    : new Set<string>();

  // ... render
}
```

- `searchParams` se `await` (Next 16).
- `Promise.all` paraleliza featured + new in market.
- `limit` clamp [8, 48] para evitar abuso vía URL.
- **Caching**: dejar default (Server Component, cache deshabilitado en Next 16 por defecto). Las queries van fresh cada request — barato porque son índices simples y `limit ≤ 49`.

### 4.6 Aplicación de searchParams

| Param       | Tipo                           | Aplica a                                              |
| ----------- | ------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ----- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `?type=`    | `all                           | house                                                 | apartment                                                       | villa | penthouse` | Chips quick filter → filtra New in Market. Featured Collections **no** se filtra (es curaduría editorial). |
| `?listing=` | `sale                          | rent`                                                 | Toggle Buy/Rent → filtra solo New in Market. Sin valor = ambos. |
| `?limit=`   | número (clamp 8-48, default 8) | Tamaño de New in Market. Load more aumenta de 8 en 8. |

> El TopNav ya navega a `/?listing=rent` desde su link "Rentar" (ver `TopNav.tsx`); este spec es compatible.

---

## 5 · Server Action `toggleFavorite`

`src/lib/properties/actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ propertyId: z.string().uuid() });

export type ToggleFavoriteResult =
  | { ok: true; isFavorite: boolean }
  | { ok: false; error: { code: 'unauthenticated' | 'invalid' | 'server'; message: string } };

export async function toggleFavorite(input: { propertyId: string }): Promise<ToggleFavoriteResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'ID de propiedad inválido' } };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'Inicia sesión para guardar' } };
  }

  // Lee estado actual
  const { data: existing } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('user_id', user.id)
    .eq('property_id', parsed.data.propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('property_id', parsed.data.propertyId);
    if (error)
      return { ok: false, error: { code: 'server', message: 'No se pudo quitar el favorito' } };
    revalidatePath('/');
    revalidatePath('/favorites');
    revalidatePath(`/property/${parsed.data.propertyId}`);
    return { ok: true, isFavorite: false };
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, property_id: parsed.data.propertyId });
    if (error) return { ok: false, error: { code: 'server', message: 'No se pudo guardar' } };
    revalidatePath('/');
    revalidatePath('/favorites');
    revalidatePath(`/property/${parsed.data.propertyId}`);
    return { ok: true, isFavorite: true };
  }
}
```

### 5.1 `FavoriteButton` cliente (optimistic UI)

`src/components/property/FavoriteButton.tsx`:

```tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFavorite } from '@/lib/properties/actions';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface FavoriteButtonProps {
  propertyId: string;
  initialIsFavorite: boolean;
  isAuthenticated: boolean;
  size?: 'md' | 'lg'; // md=compact, lg=featured
  className?: string;
}

export function FavoriteButton({
  propertyId,
  initialIsFavorite,
  isAuthenticated,
  size = 'md',
  className,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(initialIsFavorite);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // bloquea el Link del card
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?next=/`);
      return;
    }
    startTransition(async () => {
      setOptimistic(!optimistic);
      const res = await toggleFavorite({ propertyId });
      if (!res.ok) {
        // Revertir: dispara un re-render con el valor server real
        setOptimistic(initialIsFavorite);
        // Toast inline (placeholder: console.error; cuando exista Toast usarlo)
        console.error('[FavoriteButton]', res.error.message);
      }
      // revalidatePath ya refresca el Server Component padre
    });
  };

  const iconName = optimistic ? 'favorite' : 'favorite_border';
  const sizeClasses = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      disabled={isPending}
      className={cn(
        'inline-flex items-center justify-center rounded-full backdrop-blur-sm transition-all',
        'bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary',
        optimistic && 'bg-primary text-on-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        sizeClasses,
        className,
      )}
    >
      <Icon name={iconName} size={size === 'lg' ? 'md' : 'sm'} />
    </button>
  );
}
```

**Rutas que revalida**: `/`, `/favorites`, `/property/[id]`. El `revalidatePath('/')` re-renderiza la home con el set de favoritos actualizado; el cliente entretanto ya muestra optimistic.

**Por qué no `useFormState`**: el botón no envía un form completo y la respuesta es síncrona. `useTransition` + `useOptimistic` es el pattern correcto para action one-shot.

---

## 6 · Toggle Buy/Rent

**Decisión**: searchParam `?listing=sale|rent` (sin valor = todos). El `ListingTypeToggle` es Client Component que usa `useRouter().replace()` con `scroll: false` para no saltar al top.

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
// 3 botones: 'all' (sin param), 'sale', 'rent'
// active = !sp.get('listing') ? 'all' : sp.get('listing')
// click → router.replace(`/?${newParams}`, { scroll: false })
```

- **Afecta solo "New in Market"**. Featured Collections es curaduría y se mantiene constante. Justificación: el PNG muestra el toggle dentro del header de "New in Market" y los Featured siguen visibles.
- Mantiene también `?type=` y otros params si existen al cambiar listing.
- Mobile: el toggle vive como una fila compacta `flex md:hidden` justo bajo el `<h2>` "Nuevas en el mercado" (3 botones segmentados, mismo estilo).

**Por qué Client y no Server Links**: 3 estados con persistencia de otros params hace que `<Link>` requiera concatenación manual y el active state debe leer searchParams en el cliente para evitar full reload. Es el caso clásico donde Server Component falla.

---

## 7 · Búsqueda

- El `<form>` del Hero hace `action="/search" method="get"` con `<input name="q">`. Submit estándar (sin JS) navega a `/search?q=<term>`.
- El botón Submit es un `<button type="submit">` (Button primary inline).
- **Página destino** (`/search`): aún no implementada (corresponde a `search_filters_modal` u otra futura feature de search results). Para no romper la app:
  - **Crear** `src/app/(app)/search/page.tsx` Server Component mínimo:
    ```tsx
    export default async function SearchPage({
      searchParams,
    }: {
      searchParams: Promise<{ q?: string; filters?: string }>;
    }) {
      const sp = await searchParams;
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="mb-2 text-3xl font-light text-on-surface">Búsqueda</h1>
          <p className="text-muted">Esta sección llega pronto. {sp.q && `Buscaste: "${sp.q}".`}</p>
          <Link href="/" className="mt-6 inline-block text-primary hover:underline">
            Volver a la home
          </Link>
        </div>
      );
    }
    ```
  - Se documenta como "placeholder; reemplazado por la feature `search_filters_modal` / `listings_screen`".
- El icono lupa del `TopNav` también linkea a `/search`; este placeholder lo cubre.

---

## 8 · Empty state

`EmptyPropertiesState` Server Component, renderizado en lugar del grid de "New in Market" cuando `items.length === 0` después del fallback.

- Wrapper: `flex flex-col items-center text-center py-16 px-4 bg-surface-soft rounded-xl`.
- Ícono grande: `<Icon name="apartment" size="xl" className="text-primary mb-4" />` dentro de un círculo `w-16 h-16 rounded-full bg-surface flex items-center justify-center`.
- Título: `<h3 class="text-xl font-medium text-on-surface mb-2">No encontramos propiedades</h3>`.
- Descripción: `<p class="text-muted text-sm mb-6 max-w-md">Probá quitar los filtros o explorar otra categoría.</p>`.
- CTA: `<Link href="/">` envolviendo `<Button variant="secondary">Limpiar filtros</Button>` (limpia type + listing).
- Si `featured.length === 0` además, se oculta la sección Featured entera (no se muestra header).
- Si el user no aplicó ningún filtro y el seed está vacío: copy alternativo "Aún no hay propiedades publicadas. Vuelve pronto." sin CTA. Detectable por: `!propertyType || propertyType === 'all'` y `!listingType`.

---

## 9 · Pagination "Load more"

- Server-side. El `LoadMoreLink` es un `<Link>` que aumenta `?limit=` en +8, preservando los demás params.
- Ejemplo: `current limit=8 hasMore=true` → href `?limit=16&listing=rent&type=...`.
- Si `hasMore === false` el botón no se renderiza (en vez de deshabilitado).
- **Anclado para no saltar**: el `<Link>` lleva `scroll={false}` y un `replace={false}` (push para que back vuelva a `limit=8`). Como es Server, la página se re-renderiza completa con `limit=16` y las 8 cards previas siguen estando con sus mismos IDs (orden estable por `published_at desc, id desc` — agregar `id desc` como tiebreaker para evitar reordering cuando dos publican el mismo instante).
- **Anchor de scroll**: el `<Link>` apunta a `/?limit=16#new-in-market` y la `<section>` "New in Market" lleva `id="new-in-market"`. Combinado con `scroll={false}` el browser no salta automáticamente, pero el ancla queda compartible.

**Por qué no infinite scroll**: requiere Client Component con IntersectionObserver, estado local, gestión de duplicados, y rompe el botón "back" del browser. El Load more cumple el acceptance y mantiene la home como Server Component salvo por los islotes de interactividad.

---

## 10 · Responsive breakdown

| Breakpoint     | Hero título | Featured grid | New in Market grid | Chips                | Toggle Buy/Rent                       |
| -------------- | ----------- | ------------- | ------------------ | -------------------- | ------------------------------------- |
| `<sm` (mobile) | `text-4xl`  | 1 col         | 1 col, gap-6       | scroll horizontal    | fila debajo del h2 (`flex md:hidden`) |
| `sm` (≥640)    | `text-4xl`  | 1 col         | 2 cols             | scroll horizontal    | igual                                 |
| `md` (≥768)    | `text-5xl`  | 1 col         | 2 cols             | centrados sin scroll | en el header del bloque               |
| `lg` (≥1024)   | `text-6xl`  | 2 cols, gap-8 | 3 cols             | igual                | igual                                 |
| `xl` (≥1280)   | `text-6xl`  | 2 cols        | 4 cols             | igual                | igual                                 |

- Padding del `<main>`: `px-4 sm:px-6 lg:px-8 pb-20`.
- `max-w-7xl mx-auto` siempre.
- Card variant featured cambia padding interior de `p-4` (sm) a `p-6` (md+).

---

## 11 · Accesibilidad

- **Heading order**: `<h1>` único en hero, `<h2>` por sección, `<h3>` títulos de Featured, `<h4>` títulos compact. No saltar niveles.
- **Skip link**: ya existe en `(app)/layout.tsx`; este page no agrega ninguno.
- **Heart button**: `aria-pressed={isFavorite}`, `aria-label` dinámico ("Guardar en favoritos" / "Quitar de favoritos"). `<button type="button">` para que no envíe el form del hero accidentalmente.
- **Card link absoluto**: el `<a>` del título tiene `aria-label="Ver detalle de {title}"` y un `<span class="sr-only">{title}</span>` para que screen readers también lean el título completo. El `<article>` lleva `focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2` para que el foco del link sea visible.
- **Chips de filtro**: cuando seleccionados, `aria-current="page"` en el `<Link>`. El badge "soft" sobre imágenes contrasta gracias al `backdrop-blur` + `bg-surface/90`.
- **Toggle Buy/Rent**: grupo `role="group"` con `aria-label="Filtrar por tipo de operación"`; cada botón `aria-pressed`.
- **Search input**: `aria-label="Buscar propiedades"`; el botón submit `aria-label="Buscar"`.
- **Contraste**: todos los tokens del sistema cumplen 4.5:1 sobre sus fondos por diseño (validado en spec del sistema de diseño). El único riesgo es el badge `soft` sobre imágenes claras → mitigar con `backdrop-blur-sm` + `bg-surface/90` (no transparencia pura).
- **Imágenes**: `<Image alt={main_image.alt_text ?? title}>`. Nunca alt vacío.
- **Empty state**: el ícono central `aria-hidden`, el `<h3>` queda como heading accesible.

---

## 12 · Tokens estrictamente desde `globals.css`

### Colores que se usan

- `bg-background`, `bg-surface`, `bg-surface-soft`, `bg-surface-inverse`
- `text-on-surface`, `text-on-surface-inverse`, `text-on-primary`, `text-muted`
- `bg-primary`, `text-primary`, `bg-primary-soft`, `bg-primary-hover`
- `border-divider`, `border-divider-soft`, `border-outline`
- `shadow-soft`, `shadow-soft-hover`, `shadow-card`
- Opacidades sobre tokens permitidas: `bg-primary/20` (subrayado hero), `bg-surface/90` (badges sobre imagen), `bg-surface-inverse/90`, `bg-primary/90`, `text-primary/80` (íconos compact).

### Tokens que NO faltan (verificado)

Todos los anteriores ya existen en `globals.css` (líneas 14-76).

### Excepciones (negros decorativos)

- `from-black/60 to-transparent` en el overlay gradiente de cards featured: `black` es valor Tailwind nativo (no hex literal en JSX). **Decisión**: aceptable porque es overlay decorativo sobre imagen arbitraria, donde la marca no aplica. Si se prefiere uniformidad, alternativa: `from-nordic/70` (un poco menos contraste pero on-brand). El designer elige `from-black/60` para preservar fidelidad visual con el PNG.

### Utility nueva que se agrega a `globals.css`

```css
@layer utilities {
  .hide-scroll::-webkit-scrollbar {
    display: none;
  }
  .hide-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

**Justificación**: la usa el wrapper de chips quick-filter en mobile para esconder la barra de scroll horizontal sin perder el comportamiento. No es token; es utility puro de UX y no tiene equivalente Tailwind nativo.

### Tipografía aplicada

| Escala (design-system.md) | Clase Tailwind                                       | Uso                              |
| ------------------------- | ---------------------------------------------------- | -------------------------------- |
| display-1 / display-3     | `text-4xl md:text-5xl lg:text-6xl font-light`        | h1 hero                          |
| headline-2                | `text-2xl font-light`                                | h2 sección                       |
| headline-3                | `text-xl font-medium`                                | h3 título featured               |
| title-1                   | `text-lg font-bold`                                  | Precio compact                   |
| title-2                   | `text-xl font-semibold text-primary`                 | Precio featured                  |
| title-2                   | `text-base font-medium`                              | h4 título compact                |
| body                      | `text-sm`                                            | Captions, ubicación              |
| body-sm                   | `text-xs`                                            | Specs compact, address           |
| overline                  | `text-[11px] font-semibold uppercase tracking-wider` | Badges (lo da `Badge size="sm"`) |

Inter cargada en `src/app/layout.tsx` con pesos 400/500/600/700; `font-light` (300) está cargado (verificado en `feature_list.json` acceptance de `ui_primitives`).

---

## 13 · Archivos a crear / modificar

### Crear

- `src/app/(app)/page.tsx` — Home Server Component.
- `src/app/(app)/loading.tsx` — Skeleton de la home (boilerplate).
- `src/app/(app)/search/page.tsx` — placeholder "Búsqueda — próximamente".
- `src/components/property/PropertyCard.tsx`
- `src/components/property/FavoriteButton.tsx` — `'use client'`.
- `src/components/property/PriceTag.tsx`
- `src/components/property/ListingTypeToggle.tsx` — `'use client'`.
- `src/components/property/index.ts` — re-exports.
- `src/components/home/HeroSearch.tsx` — Server (el form HTML nativo funciona sin JS; opcional `'use client'` si se quiere desactivar Submit mientras está vacío, pero la spec dice Server).
- `src/components/home/PropertyTypeChips.tsx`
- `src/components/home/LoadMoreLink.tsx`
- `src/components/home/EmptyPropertiesState.tsx`
- `src/components/home/HomePageSkeleton.tsx`
- `src/components/home/index.ts`
- `src/lib/properties/queries.ts`
- `src/lib/properties/actions.ts` — `'use server'`.
- `src/lib/properties/format.ts`
- `src/lib/properties/derive-badges.ts`
- `src/lib/properties/index.ts`

### Modificar

- `src/app/page.tsx` — **eliminar** (se reemplaza por `(app)/page.tsx`). Verificar que ningún test/import lo referencia.
- `src/app/globals.css` — agregar bloque `@layer utilities` con `.hide-scroll`.

### NO tocar

- `middleware.ts` / `proxy.ts` — no añadir `/` a `protectedPaths`. La protección viene del layout `(app)/`.
- `TopNav.tsx` y demás del shell.
- Migraciones SQL.

---

## 14 · Riesgos / preguntas abiertas

### R1 · `/` no autenticada

**Comportamiento decidido**: si el user no está logueado y visita `/`, el `(app)/layout.tsx` ya lo redirige a `/login`. Por ende NO existe una "home pública" en el MVP. Esto es coherente con la decisión tomada al diseñar el shell. **No requiere input humano**, pero conviene confirmar con el líder porque cambia respecto al patrón de muchas inmobiliarias (landing pública).

### R2 · Layout `(app)/` no agrega `<main>` wrapper duplicado

`(app)/layout.tsx` ya monta `<main id="main-content">`. La `page.tsx` debe renderizar `<div>` (no otro `<main>`). Documentado en §2 para evitar `<main>` anidados.

### R3 · `next/image` y dominios remotos

Las imágenes del seed son URLs de `images.unsplash.com` y `picsum.photos` (ya en `remotePatterns` por feature `image_placeholders`). Las imágenes reales subidas a Supabase Storage también deben estar en `remotePatterns` (`<projectref>.supabase.co`). **Verificar**: ¿está ya el patrón de Supabase Storage en `next.config.ts`? Si no, el implementer lo agrega como tarea menor.

### R4 · Etiquetas en mockup vs sistema en español

El mockup dice `EXCLUSIVE`, `NEW ARRIVAL`, `FOR SALE`, `FOR RENT`. **Decisión**: traducir a `EXCLUSIVA`, `NUEVA`, `EN VENTA`, `EN RENTA` (CLAUDE.md exige textos en español). Si se prefiere mantener inglés por estética editorial, hay precedente en otras pantallas que usan inglés decorativo; **pregunta al líder si quiere override**.

### R5 · Fallback "includeOlderIfEmpty"

Si la DB tiene >30 días sin publicaciones nuevas, la home se vería vacía. La spec propone fallback opcional que muestra todas las active si no hay nuevas. **Decisión por defecto**: activado para evitar UX vacía durante demo. Si el reviewer cree que rompe el contrato del nombre "New in Market", se desactiva con un flag y se muestra empty state.

### R6 · Click del card vs heart button

El pattern del link absoluto cubierto en §3.3 funciona pero exige `z-index` estricto entre `<Link>` (z-10) y `<FavoriteButton>` (z-20). Si el implementer omite el `z-20` en el button, el click va al link. Documentado.

### R7 · Búsqueda full-text

El acceptance dice "búsqueda full-text usando `search_vector`". El form del hero solo navega a `/search?q=`. La query full-text se ejecuta en la página `/search` (no implementada). **Decisión**: el placeholder `/search` no ejecuta la búsqueda real; documentado como dependencia. El acceptance se cumple parcialmente — el implementer debe marcar en su PR que la query full-text se difiere a `search_filters_modal`. **Esto requiere visto bueno del líder/reviewer** (puede ser que prefiera cerrar también la query mínima en este PR).

### R8 · "Sell" del TopNav

El TopNav tiene un link a `/sell` que no existe. Está fuera del scope de esta feature pero conviene documentar: cualquier 404 en `/sell` cae fuera del acceptance de `home_discover_screen`. **No bloquear por esto**.

### R9 · Avatar URL del dropdown

`profile.avatar_url` se pasa al `AvatarDropdown` del TopNav. Si Supabase Storage no está en `remotePatterns` y un avatar real apunta ahí, falla. **Mismo punto que R3**.

---

## 15 · Criterios de aceptación verificables (reviewer)

- [ ] `src/app/page.tsx` ya no existe; en su lugar `src/app/(app)/page.tsx`.
- [ ] Hero: `<h1>` con `text-4xl md:text-5xl lg:text-6xl font-light`, palabra "refugio" subrayada con `bg-primary/20`.
- [ ] Search bar: form GET → `/search?q=...`, funciona sin JavaScript (probar con JS off).
- [ ] Chips: 5 chips (Todas/Casa/Apartamento/Villa/Penthouse), uno con `Chip variant="selected"` según `?type`. Botón "Filtros" navega a `/search?filters=open`.
- [ ] Featured Collections: máx 2 cards `featured`, grid `lg:grid-cols-2 gap-8`. Si la query devuelve 0 featured, la sección se oculta.
- [ ] New in Market: grid `sm:2 md:2 lg:3 xl:4`, `gap-6`. Cards `compact`.
- [ ] Toggle Buy/Rent: 3 botones (Todas/Comprar/Rentar), activo con `bg-surface-inverse text-on-surface-inverse`, filtra solo "New in Market".
- [ ] Heart: optimistic UI con `useOptimistic`; navega a `/login?next=/` si no auth; persiste tras refresh.
- [ ] Load more: link a `?limit=+8`, oculto si `hasMore=false`. URL es shareable.
- [ ] Empty state visible cuando hay filtros y 0 resultados; copy diferenciado si NO hay filtros y la DB está vacía.
- [ ] Cero hex literales en JSX (`grep -rn "#[0-9a-fA-F]\{3,8\}" src/app/(app)/ src/components/property src/components/home` debe estar vacío salvo en comentarios).
- [ ] No hay `<main>` anidado.
- [ ] `pnpm lint` y `pnpm type-check` pasan.
- [ ] `pnpm build` produce build válido.
- [ ] Smoke test manual con un user del seed (elena@): se ve la home, se favoritea/desfavoritea, el toggle Buy/Rent filtra, Load more agrega cards.

---

## 16 · Alternativas consideradas

### Alt A · Home pública (sin auth) con CTA "Iniciar sesión"

- **Pros**: SEO, primera impresión sin barrera.
- **Contras**: el shell `(app)/` y el `TopNav` asumen sesión. Habría que duplicar layout, hacer dos versiones del TopNav (pública y autenticada), agregar guard solo a las acciones (favorito, agendar). Mucho trabajo extra para algo no pedido por el acceptance ni los mockups (el PNG muestra avatar en el nav).
- **Recomendación**: **NO**. Mantener autenticada (Alt B).

### Alt B · Home autenticada (decidido)

- **Pros**: cumple acceptance, reutiliza shell tal cual, el corazón funciona siempre, no duplica layouts.
- **Contras**: requiere login antes de ver propiedades. Aceptable para MVP de aprendizaje.
- **Recomendación**: **SÍ**.

### Alt C · Load more con infinite scroll

- **Pros**: UX moderna, sin click.
- **Contras**: Client Component, IntersectionObserver, estado local, no shareable, rompe back button.
- **Recomendación**: **NO**. `<Link>` con `?limit=` es más simple y respeta el acceptance.

### Alt D · Toggle Buy/Rent como Server Links

- **Pros**: cero JS.
- **Contras**: rebuild de URL manual preservando `?type=`, `?limit=` requiere helper; cada cambio causa scroll al top (mala UX) salvo que se use `prefetch` + `scroll={false}` consistentemente.
- **Recomendación**: **NO** — Client Component con `router.replace({ scroll: false })` es el caso real para un toggle.

---

## 17 · Notas para el implementer

- `await searchParams` y `await params` siempre (Next 16).
- Si `next/image` se queja por `<Image fill>` dentro de un wrapper sin `position: relative`, agregar `relative` al wrapper (ya está en la spec, pero recordatorio).
- Para el `Promise.all` de queries: si una falla, el page entero falla. Si se quiere tolerancia, envolver cada uno en try/catch y degradar. Por ahora **fail fast**: el reviewer prefiere ver el error.
- El icono `place` cae bajo Material Icons (clásico). Si no aparece, fallback `location_on`.
- Los textos en español ya están definidos en cada sección de esta spec — no improvisar.
- El componente `Card` del sistema **no se usa** directamente en `PropertyCard`: PropertyCard maneja su propio wrapper porque necesita `group`, `aspect-ratio`, `overflow-hidden` y composición específica de la card. Usar `Card` sería forzar overrides que rompen el sistema. Documentar esa decisión en el jsdoc de `PropertyCard`.

---

## 18 · Addendum: home pública (D1-D7)

> **Disclaimer**: Esta sección se agregó después de las 1-17 y **sobrescribe** sus partes contradictorias. Cuando el implementer detecte conflicto entre lo descrito aquí y secciones anteriores, **gana esta sección**. Lista explícita de overrides al final.
>
> Contexto: el líder cambió el alcance de la home, property detail y search de "autenticadas" a "públicas". El resto del shell (favorites, profile, visits, dashboard, admin) sigue protegido. Esta sección documenta cómo se adapta la spec original sin reescribir las secciones 1-17.

### Overrides explícitos al texto previo

| Sección original                                                                  | Estado                                                                                                      | Reemplazada por                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| § 1 — "el layout `(app)/layout.tsx`, que ya redirige a `/login` si no hay sesión" | Inválido                                                                                                    | § 18 D3                                |
| § 4.5 — `getSessionAndProfile()` "layout ya garantiza user"                       | Parcialmente inválido                                                                                       | § 18 D3 + § 18 sobre TopNav            |
| § 14 R1 — "Comportamiento decidido: el layout redirige a `/login`"                | Invalidado                                                                                                  | § 18 D1                                |
| § 16 Alt B — "Home autenticada (decidido)"                                        | Invalidado                                                                                                  | § 18 D1 (Alt A es la nueva línea base) |
| § 13 "Modificar — `middleware.ts` / `proxy.ts`: no añadir `/` a `protectedPaths`" | Se mantiene como está, pero ahora `proxy.ts` ya **no** debe redirigir desde `(app)/layout.tsx`; ver § 18 D3 |

### D1 · Alcance público de la home, detalle y búsqueda

- **Decisión**: las rutas `/`, `/property/[id]` y `/search` son **públicas** (accesibles sin sesión).
- **Rutas que siguen protegidas** (sin cambio): `/favorites`, `/profile`, `/visits`, `/dashboard/*`, `/admin/*`. El `proxy.ts` ya las cubre vía `isProtectedPath`.
- **Impacto**:
  - § 14 R1 ("Home autenticada") queda **reemplazada por D1**.
  - § 16 Alt B ("decidido: home autenticada") queda **reemplazada por D1** (la opción ganadora pasa a ser Alt A "Home pública"); ver D7 abajo para los riesgos asumidos.
- **Justificación**: SEO + primera impresión sin barrera; el resto de las pantallas accionables (favoritos, agendar visita, dashboard) sigue exigiendo login a través del middleware existente. No duplicamos layouts porque el TopNav se bifurca internamente (ver D2) en vez de tener dos layouts.

### D2 · TopNav con soporte para `session === null`

- **Decisión**: `TopNav` deja de hacer `redirect('/login')` cuando `variant === 'app'` y no hay sesión. Para `variant === 'dashboard'` y `variant === 'admin'` el redirect defensivo se mantiene (esas variantes asumen sesión).
- **Cambios concretos en `src/components/nav/TopNav.tsx`**:
  1. **Tipos**: `TopNavProps.session` pasa de `{ user: User; profile: Profile | null }` opcional a `{ user: User; profile: Profile | null } | null` explícitamente. La firma queda:
     ```ts
     export interface TopNavProps {
       variant: TopNavVariant;
       /** Sesión ya resuelta. `null` indica anónimo (solo válido para variant 'app'). */
       session?: { user: User; profile: Profile | null } | null;
     }
     ```
  2. **Guard condicional** (reemplaza las líneas 141-143 actuales):
     ```ts
     const session = passedSession === undefined ? await getSessionAndProfile() : passedSession;
     if (!session?.user) {
       if (variant !== 'app') {
         redirect('/login');
       }
       // variant 'app' continúa con `session = null` (modo anónimo).
     }
     ```

     - Nota sobre la condición `passedSession === undefined`: hoy es `passedSession ??`, lo cual confunde `null` con "no pasado". Con el nuevo tipo, hay que distinguirlos: `undefined` = "no me pasaron nada, fetcho yo"; `null` = "el layout sabe que es anónimo".
  3. **`unreadCount` skip cuando no hay user** (resuelve el riesgo R10 nuevo, ver abajo): envolver el bloque `try { ... }` actual (líneas 154-167) con `if (session?.user) { ... }`. Default `unreadCount = 0` ya está fijado.
  4. **Render del cluster derecho**: bifurcación por `session?.user`. Pseudocódigo:
     ```tsx
     {session?.user ? (
       <>
         {/* búsqueda lupa, NotifBell, NameBlock (si aplica), AvatarDropdown, MobileNavDrawer — igual que hoy */}
       </>
     ) : (
       <>
         {/* búsqueda lupa: visible (link a /search), sin NotifBell, sin AvatarDropdown */}
         <Link href="/search" aria-label="Buscar" className={cn(/* las mismas clases del Link actual de la lupa */)}>
           <Icon name="search" size="md" />
         </Link>
         {/* CTAs anónimos */}
         <Link
           href="/login"
           className={cn(/* clases equivalentes a Button variant="ghost" size="md" */)}
         >
           Iniciar sesión
         </Link>
         <Link
           href="/login?mode=signup"
           className={cn(
             'hidden sm:inline-flex', /* mobile: solo se muestra "Iniciar sesión" */
             /* clases equivalentes a Button variant="primary" size="md" */
           )}
         >
           Registrarse
         </Link>
         {/* MobileNavDrawer en modo anónimo: ver D2 abajo */}
         <MobileNavDrawer
           links={links}
           dropdownItems={[]}              {/* sin items de cuenta */}
           displayName=""                  {/* drawer detecta vacío y oculta header */}
           email=""
           anonymous                       {/* nuevo prop boolean; ver detalle */}
         />
       </>
     )}
     ```

     - **Decisión copy CTAs**: "Iniciar sesión" (no "Entrar", no "Acceder") y "Registrarse" (no "Crear cuenta", no "Sign up"). Razón: alineación con CLAUDE.md "textos en español" y con la convención que ya usa la pantalla `/login` (verificar en feature `auth_layer`).
     - **Decisión breakpoint mobile**: `Registrarse` lleva `hidden sm:inline-flex` (oculto < 640px). `Iniciar sesión` siempre visible. En mobile el usuario que quiera registrarse también llega al mismo `/login`, donde puede alternar a signup; no se pierde el flujo.
     - **`Button` como `<Link>`**: el primitivo `Button` no expone `asChild`. Para no introducir cambios al primitivo, los dos CTAs anónimos son `<Link>` con las clases de Button replicadas inline (mismo patrón documentado en § 2.3 para "Load more"). El implementer puede mover esto a un helper `buttonClasses({variant, size})` si lo prefiere, **pero no es requisito**.
- **Sub-decisión nav links anónimos**: el array de links de `variant: 'app'` (Comprar / Rentar / Vender / Guardados) **se mantiene igual** para anónimos. Click en "Guardados" sin sesión cae naturalmente en el middleware de `proxy.ts`, que ya hace `redirect('/login?next=/favorites')`. No filtramos el link porque (a) preserva memoria visual del nav, (b) `/login?next=` ya es el flujo correcto. Click en "Vender" cae en 404 — está documentado fuera de scope (§ 14 R8) y no cambia con esta feature.

#### `MobileNavDrawer`: variante anónima

- Lectura del componente: el drawer hoy renderiza (a) header con `displayName + email`, (b) lista de `links`, (c) lista de `dropdownItems` separados, (d) form `signOut`. Si pasamos `dropdownItems = []`, la sección (c) se omite gracias al guard `{dropdownItems.length > 0 && ...}`. Pero (a) y (d) siempre se renderizan.
- **Decisión**: extender `MobileNavDrawerProps` con un flag opcional `anonymous?: boolean` (default `false`). Cuando `anonymous === true`:
  - Header (a): se reemplaza por un bloque "Bienvenido" con dos botones a `/login` y `/login?mode=signup` (`Button variant="primary"` y `Button variant="ghost"`, ambos `block w-full`). Esto le da al usuario móvil sin sesión la misma puerta de entrada que tiene el cluster derecho del desktop.
  - Sign out form (d): se omite (no hay sesión que cerrar).
  - Lista de links (b): se mantiene tal cual.
- **Justificación**: pequeño cambio acotado, sin tocar el shell de focus trap / scroll lock. Alternativa rechazada: ocultar el drawer entero en anónimo — perdemos el menú hamburguesa que da acceso a los nav links en mobile (Comprar, Rentar, Vender, Guardados).

### D3 · Layout `(app)/` deja de redirigir

- **Decisión**: `src/app/(app)/layout.tsx` elimina el bloque `if (!session?.user) redirect('/login')`. Sigue fetchando la sesión con `getSessionAndProfile()` y la pasa al TopNav (puede ser `null`).
- **Código resultante** (sustituye las líneas 12-27 actuales):

  ```tsx
  export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSessionAndProfile();

    return (
      <>
        <SkipLink />
        <TopNav variant="app" session={session ?? null} />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
      </>
    );
  }
  ```

- **Consecuencia**: la **protección de rutas privadas (`/favorites`, `/profile`, `/visits`)** queda 100% delegada al middleware (`proxy.ts`). Esto ya funciona hoy (verificado en código). La home `/` y futuras rutas públicas dentro de `(app)/` no se ven afectadas porque no están en `protectedPaths`.
- **Impacto en § 4.5**: el snippet de `page.tsx` dice `const session = await getSessionAndProfile(); // layout ya garantiza user`. **Override**: el comentario es obsoleto. `session?.user` puede ser `undefined`. El código del Promise.all y `getUserFavoriteIds` ya está blindado (`session?.user ? ... : new Set<string>()`), así que **no requiere cambio funcional**, solo eliminar el comentario engañoso.

### D4 · Heart anónimo — confirmación

- **Confirmación**: el `FavoriteButton` (§ 5.1) ya cubre el caso anónimo. Cuando `isAuthenticated === false`, el click navega a `/login?next=/`. **No cambia**.
- **Pequeña precisión adicional**: el `aria-label` cuando `isAuthenticated === false` debería ser "Inicia sesión para guardar" en vez de "Guardar en favoritos" para que sea honesto con la acción real. **Sub-decisión**: agregar esa rama:
  ```ts
  const ariaLabel = !isAuthenticated
    ? 'Inicia sesión para guardar'
    : optimistic
      ? 'Quitar de favoritos'
      : 'Guardar en favoritos';
  ```
- El resto del componente (optimistic UI, `useTransition`) sigue igual; cuando no hay sesión el `useOptimistic` nunca se dispara porque el click corta antes con `router.push`.

### D5 · Migración RLS para lectura anónima

- **Nombre del archivo**: `supabase/migrations/0013_anon_select_active_properties.sql`.
- **Conflicto detectado con la indicación del líder**: el líder pidió formato timestamp `YYYYMMDDHHMMSS_`. Sin embargo, **las 12 migraciones existentes del proyecto siguen formato secuencial `NNNN_`** (`0001_` … `0012_`). Cambiar de convención en plena migración 13 rompería la ordenación natural por nombre y volvería el orden ambiguo (`0012_` < `20260522...` lexicográficamente, pero solo por accidente). **Decisión del designer**: respetar la convención del repo (`0013_`). Si el líder confirma que prefiere migrar todo el repo a timestamp, esa es una decisión separada que debe aplicarse a las 12 anteriores también.
- **Contenido**:

  ```sql
  -- 0013_anon_select_active_properties.sql
  -- Permite a clientes anónimos (rol `anon`) leer propiedades activas y sus
  -- imágenes. Necesario para que /, /property/[id] y /search funcionen sin
  -- login. NO abre profiles, favorites, visits ni messages a anon.

  -- properties: SELECT solo de listings activos.
  drop policy if exists "properties_select_active_anon" on public.properties;
  create policy "properties_select_active_anon"
    on public.properties
    for select
    to anon
    using (listing_status = 'active');

  -- property_images: SELECT solo de imágenes cuyo property padre esté active.
  drop policy if exists "property_images_select_anon" on public.property_images;
  create policy "property_images_select_anon"
    on public.property_images
    for select
    to anon
    using (
      exists (
        select 1 from public.properties p
        where p.id = property_images.property_id
          and p.listing_status = 'active'
      )
    );
  ```

- **Aditividad**: las políticas existentes para `to authenticated` (`properties_select_public_or_own`, `property_images_select`) **no se modifican**. PostgreSQL evalúa políticas por rol; un usuario autenticado sigue regido por las suyas, un anon usa las nuevas. La migración suma, no reemplaza.
- **Lo que NO abrimos a anon** (decisión consciente):
  - `profiles`: no exponer datos del agente al público anónimo en la home. Si el detalle (`/property/[id]`) necesita mostrar info del agente (foto, nombre), se resolverá en la feature `property_details_screen` mediante una de estas estrategias:
    - (a) Crear una función `public.get_property_agent_card(property_id uuid)` con `security definer` que devuelva solo `(full_name, avatar_url, role)`, accesible a `anon`.
    - (b) Crear una vista materializada `public.property_agent_cards` con select abierto a `anon` (solo columnas no sensibles).
    - (c) Resolver server-side en el Server Component con el cliente `service_role` (descartado: no queremos `service_role` en runtime de páginas).
    - **Recomendación del designer**: (a). Pero esa decisión cae fuera del scope de esta feature; documentada para que la próxima la considere.
  - `favorites`: anon nunca tiene `user_id`. Sin política para `to anon`, el SELECT devuelve cero filas (RLS deniega por default). Eso ya está cubierto por § 4.4 (el `getUserFavoriteIds` solo se llama si `session?.user`).
  - `visits`, `messages`, `notifications`, `conversations`: idem, sin política anon.
- **Verificación post-migración** (incluir en `get_advisors` después de aplicar): asegurarse que no se levantan advisors de "table has RLS enabled but no policy for role anon" en otras tablas (esperamos warnings ya existentes, no nuevos).

### D6 · Página placeholder de detalle público

- **Decisión**: crear `src/app/(app)/property/[id]/page.tsx` como placeholder Server Component **en esta feature**. Justificación: el `<Link>` absoluto sobre la card de `PropertyCard` (§ 3.3) navega a `/property/${id}`. Sin esta página el card daría 404 — inaceptable para una home pública. La página real es la feature `property_details_screen` (`pending` en `feature_list.json`).
- **Contenido propuesto** (mínimo, sin tocar datos):

  ```tsx
  // src/app/(app)/property/[id]/page.tsx
  import Link from 'next/link';

  type PageProps = { params: Promise<{ id: string }> };

  export default async function PropertyDetailPlaceholder({ params }: PageProps) {
    const { id } = await params;
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-2 text-3xl font-light text-on-surface">Detalle de propiedad</h1>
        <p className="mb-1 text-muted">Esta vista llega pronto.</p>
        <p className="mb-6 text-sm text-muted">
          ID: <code className="font-mono">{id}</code>
        </p>
        <Link href="/" className="inline-block text-primary hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }
  ```

- **Por qué dentro de `(app)/` y no fuera**: para reusar el shell con `TopNav` y `SkipLink` que ya monta `(app)/layout.tsx`. Como ahora ese layout no exige sesión (D3), esto funciona para anónimos.
- **No se valida que el `id` exista en la DB** en el placeholder. Cuando llegue `property_details_screen`, se reemplaza por el query real con `notFound()` si no existe + RLS.

### D7 · Decisiones previas confirmadas (recordatorio)

- **Badges en español** (§ 14 R4): se confirma `EXCLUSIVA / NUEVA / EN VENTA / EN RENTA`. No se revierte a inglés.
- **`includeOlderIfEmpty: true`** (§ 14 R5): activado por defecto en el query de New in Market. Si la DB tiene <8 activas de las últimas 30 días, se rellena con activas más antiguas para no mostrar empty state estando seedeada la DB. Anon ve lo mismo (la política `properties_select_active_anon` permite todas las active).
- **Full-text search diferida** (§ 14 R7): el form de búsqueda del hero sigue navegando a `/search?q=...` como GET sin lógica de query. La página `/search` placeholder (§ 7) ahora es pública por defecto al estar fuera de `protectedPaths`. La feature `search_filters_modal` implementa la query real.

### Lista actualizada de archivos a crear/modificar (override de § 13)

#### Crear (sumar a § 13 "Crear")

- `src/app/(app)/property/[id]/page.tsx` — placeholder de detalle (D6).
- `supabase/migrations/0013_anon_select_active_properties.sql` — RLS anon (D5).

#### Modificar (sumar a § 13 "Modificar")

- `src/components/nav/TopNav.tsx`:
  - Cambiar tipo `TopNavProps.session` a `... | null`.
  - Reemplazar guard `redirect('/login')` por bifurcación que solo redirige cuando `variant !== 'app'` (D2).
  - Envolver el query de `unreadCount` con `if (session?.user)`.
  - Bifurcar el render del cluster derecho según `session?.user` (CTAs anónimos vs avatar autenticado).
- `src/components/nav/MobileNavDrawer.tsx`:
  - Sumar prop `anonymous?: boolean`.
  - Cuando `anonymous === true`: cambiar header a bloque "Bienvenido + CTAs login/signup", omitir form de sign out.
- `src/app/(app)/layout.tsx`:
  - Eliminar el bloque `if (!session?.user) redirect('/login')`.
  - Pasar `session ?? null` al `TopNav`.

#### NO tocar (sin cambio respecto a § 13)

- `middleware.ts` / `proxy.ts`: `protectedPaths` ya excluye `/`, `/property`, `/search`. Las rutas privadas ya están listadas correctamente.
- `AvatarDropdown.tsx`: no se modifica; solo se omite del render cuando hay anónimo.

### Criterios de aceptación adicionales (sumar a § 15)

- [ ] **Home anónima funcional**: visitar `/` en modo incógnito (sin cookies) renderiza la home completa, con featured y new in market, sin redirect a `/login`.
- [ ] **Detalle anónimo funcional**: visitar `/property/<uuid-existente>` en incógnito muestra el placeholder con el ID, sin 404 ni redirect.
- [ ] **Detalle con ID inválido**: `/property/abc-no-existe` en placeholder devuelve la página igualmente (no valida; documentado como deuda hasta feature `property_details_screen`).
- [ ] **Búsqueda anónima**: `/search?q=algo` en incógnito muestra el placeholder existente, sin redirect.
- [ ] **TopNav anónimo (≥sm)**: muestra logo + 4 nav links + lupa + "Iniciar sesión" (ghost) + "Registrarse" (primary). Sin NotifBell. Sin Avatar.
- [ ] **TopNav anónimo (<sm)**: muestra logo + lupa + "Iniciar sesión" + menú hamburguesa. "Registrarse" oculto.
- [ ] **TopNav autenticado**: idéntico al comportamiento actual (lupa + NotifBell + Avatar + drawer). Verificar que el redirect del TopNav sigue funcionando para `variant: 'dashboard'` y `variant: 'admin'`.
- [ ] **Heart anónimo**: click en el corazón sin sesión navega a `/login?next=/`. El componente no llama al server action.
- [ ] **Heart anónimo aria-label**: lectura del botón con screen reader anuncia "Inicia sesión para guardar".
- [ ] **Link "Guardados" anónimo**: click en el nav link "Guardados" sin sesión hace que el middleware redirija a `/login?next=/favorites` (comportamiento heredado, solo verificar que sigue ocurriendo después de los cambios).
- [ ] **RLS anon — propiedades activas**: ejecutar con cliente anon (CLI `psql` con el `anon` key) `select count(*) from properties where listing_status='active'` devuelve >0; `select count(*) from properties where listing_status='draft'` devuelve 0.
- [ ] **RLS anon — imágenes**: `select count(*) from property_images` con cliente anon devuelve solo las imágenes de propiedades active.
- [ ] **RLS anon — tablas privadas**: `select count(*) from favorites`, `from profiles`, `from visits` con cliente anon devuelve 0 (sin error, solo cero filas — comportamiento esperado de RLS sin política para el rol).
- [ ] **Layout `(app)/` no redirige**: comentar temporalmente el middleware y visitar `/` sin sesión devuelve 200 con la home (no 307 a `/login`).
- [ ] **`unreadCount` no se consulta sin user**: revisar logs en dev al visitar `/` anónimo — no debe haber query a `notifications`.

### Riesgos nuevos (sumar a § 14)

#### R10 · `unreadCount` query sin user

La query a `notifications` en TopNav (líneas 154-167) filtra por `recipient_id = user.id`. Si `user` es `undefined`, el query intentaría `eq('recipient_id', undefined)` y la API de Supabase serializaría a `recipient_id=is.null` o lanzaría error. **Mitigación**: envolver el bloque en `if (session?.user) { ... }` (cubierto en D2). Sin esto, anon vería errores en logs aunque la UI no se rompiera (porque la campana se omite). **Acción**: el implementer debe agregar el guard explícitamente.

#### R11 · CTAs anónimos sin componente reutilizable

Los dos `<Link>` que imitan a `Button` duplican clases. Si en el futuro otras pantallas necesitan "link estilizado como botón", convendría un helper `buttonClasses({variant, size})`. **Decisión**: fuera de scope de esta feature. Si el reviewer pide refactor preventivo, está bien, pero no bloquea.

#### R12 · Card del agente en `/property/[id]` futuro

Cuando llegue `property_details_screen`, el detalle anónimo necesitará mostrar el agente publicador (foto + nombre). `profiles` NO está abierto a `anon` (D5). **Acción a recordar**: la feature `property_details_screen` debe crear una función `security definer` (preferencia del designer) o vista pública con campos limitados. Documentado para que el líder lo incluya en el spec de esa feature.

#### R13 · Cambio del comportamiento del shell `(app)/`

Hoy, ANTES de esta feature, cualquier ruta dentro de `src/app/(app)/` requería sesión (vía layout). DESPUÉS de esta feature, el layout es permisivo y la protección está solo en el middleware. **Riesgo**: si alguien crea `src/app/(app)/profile/page.tsx` esperando que el layout proteja y olvida añadir la ruta a `protectedPaths`, queda accesible sin sesión. **Mitigación**: documentar en CLAUDE.md el cambio de modelo (responsabilidad: leader, no este addendum). Por ahora, las rutas privadas ya están listadas en `proxy.ts` y se mantienen así.

#### R14 · Convención de nombres de migración

El líder pidió `YYYYMMDDHHMMSS_` pero el repo usa `NNNN_`. Esta spec opta por `0013_` para no romper la ordenación lexicográfica. Si el líder insiste en timestamp, se puede renombrar pero **antes de aplicar la migración**, y aclarar si las 12 anteriores también se renumeran. **Estado**: pendiente de confirmación; no bloquea implementación.
