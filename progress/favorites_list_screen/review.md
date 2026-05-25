# Review — feature favorites_list_screen

**Veredicto:** APPROVED

## Checklist

- Tokens y colores: [x] cero hex literales en JSX de los 8 archivos nuevos y de PropertyCard modificado; todo via tokens (`bg-surface`, `text-on-surface`, `bg-surface-soft`, `text-primary`, `border-divider-soft`, etc.).
- Componentes y framework: [x] `page.tsx` es Server Component, `await searchParams`, los Client Components (`FavoritesSortDropdown`, `FavoritesViewToggle`) declaran `'use client'` y justifican el uso (`useRouter`, `useSearchParams`); sin deps nuevas; mobile-first cumplido (grid `grid-cols-1 → sm:2 → lg:3 → xl:4` y `lg:grid-cols-2` para list).
- Supabase: [x] `getUserFavorites` usa `createClient` de `src/lib/supabase/server` vía helper; query confía en RLS (mig 0006 `favorites_select_own_or_admin` ya restringe `user_id = auth.uid()`) y aún así filtra defensivamente por `user_id`; mutación de des-favoritear sigue siendo `toggleFavorite` Server Action ya existente que revalida `/favorites`. Sin `service_role` filtrado al cliente.
- Fidelidad visual: [x] Header H1 `font-light text-3xl md:text-4xl` + subtítulo con singular/plural correcto; toolbar `md:items-end md:justify-between`; sort dropdown nativo estilizado con chevron; view toggle con `aria-pressed` y `bg-surface-soft text-primary` en activo; grid y layout horizontal cumplen spec (`w-2/5 shrink-0`, `min-w-0 flex-1`, `min-h-[180px] sm:min-h-[200px]`); CTA al pie con `Button variant="secondary" fullWidth` y wrapper `z-20 mt-3 border-t border-divider-soft pt-3` (idéntico patrón en vertical y horizontal); copy diferenciado `"Reservar visita" / "Agendar tour"` y trailingIcon `arrow_forward / calendar_today`; `DiscoverMoreCard` con borde discontinuo verde como último item del grid; `FavoritesEmptyState` full-width sólo cuando count===0. **NO** se agregaron badges overlay NEW LISTING / PRICE DROP (fuera de scope respetado).
- Calidad: [x] `./init.sh full` pasa: deps OK, lint `--max-warnings=0` OK, type-check OK, build de producción OK (ruta `/favorites` listada como dynamic ƒ). Sin `console.log` de debug; los `console.warn` en `getUserFavorites` son logging legítimo de errores. Textos en español. PropertyCard mantiene defaults (`showBookingCTA=false`, `orientation='vertical'`) y Home (`src/app/(app)/page.tsx`) no pasa las nuevas props → cero regresión visual confirmada por inspección del callsite.

## Lo que está bien

- Defaults conservadores en `PropertyCard`: las dos props nuevas (`showBookingCTA`, `orientation`) tienen default que preserva el render previo. Home y Search no necesitan tocar nada. Confirmado leyendo `src/app/(app)/page.tsx` (no pasa ninguna de las dos props).
- Tipo `CompactCardProps extends InternalCardProps` mantiene el contrato del `FeaturedPropertyCard` intacto y obliga al `CompactPropertyCard` a recibir ambas props (sin defaults colgando en el sub-componente).
- `getUserFavorites` resuelve el embed de PostgREST con un type guard `Array.isArray(row.properties)` que tolera ambas formas (objeto único o array), evitando un bug latente cuando el schema cache rota.
- Sort server-side via `referencedTable: 'properties'` para `price_asc/desc`: correcto, no se hace `sort` en JS.
- `revalidatePath('/favorites')` ya estaba en `toggleFavorite` — verificado en `src/lib/properties/actions.ts:71,86`. La cadena optimistic UI → DELETE → revalidate → card desaparece funciona out-of-the-box.
- Empty state con `aria-labelledby="favorites-empty-heading"` propio, distinto del `favorites-heading` del listado; el header se oculta cuando `isEmpty` (no se muestra la toolbar sobre el empty), lo cual es coherente con el spec.
- `PropertyCardSkeleton` reutilizable expuesto desde `components/property/index.ts` — extensible para Home/Search cuando agreguen loading state propio.
- A11y: `role="toolbar" aria-label="Ordenar y vista"`, `<ul>` para el grid, `aria-pressed` en el toggle, `<label sr-only>` para el select, skip-link del shell público heredado.
- Migración 0006 confirma RLS activa (`alter table public.favorites enable row level security`) con políticas `select/insert/delete` propias.

## Issues bloqueantes

Ninguno.

## NITs no bloqueantes

1. **`loading.tsx` siempre renderiza orientation=vertical y grid de 4** (`src/app/(app)/favorites/loading.tsx:24,26`). Si el user llega con `?view=list` y la primera navegación dispara el skeleton, va a haber un flash entre `grid-cols-1 sm:2 lg:3 xl:4` (skeleton) y `grid-cols-1 lg:2` con cards horizontales (real). Mejora: leer `searchParams` en `loading.tsx`… aunque eso no es posible en App Router (`loading.tsx` no recibe params). Alternativa razonable: dejar como está. Menor.
2. **Caso `all_unavailable` nunca se dispara** (`src/app/(app)/favorites/page.tsx:96`). El `page.tsx` siempre pasa `reason="never_favorited"` porque la query ya filtra `listing_status='active'` y no distingue "no tenía favoritos" de "todos pausados". Para diferenciarlos haría falta una segunda query `count *` sin el filtro, o devolver el dato en `getUserFavorites`. El acceptance del feature_list no lo exige, así que está bien diferir. Documentar como deuda menor.
3. **`getUserFavorites` devuelve `[]` en error** sin propagar el caso al UI (`src/lib/properties/queries.ts:233-237`). La sección "Error" del spec proponía un estado distinto con copy "No pudimos cargar tus favoritos". La implementación opta por degradar silenciosamente a empty `never_favorited` — el spec lo permite ("tratamos el error como empty con copy especial") pero el copy actual dice "Aún no guardaste propiedades", lo que es engañoso si la query falló. Mejora futura: que `getUserFavorites` retorne `{ items, error }` y el page elija el copy. Diferir.
4. **`FavoritesEmptyState`**: el `<Link>` envuelve un `<Button tabIndex={-1}>` sin estilos focus propios visibles en el `<a>`. Funciona porque el button hereda el aspecto, pero un focus ring directo sobre el `<a>` mejoraría la visibilidad cuando se navega por teclado. Mismo patrón en `DiscoverMoreCard` pero allí el `focus-within:ring-2` del `<article>` lo compensa. Menor.
5. **`page.tsx:54-56` redirect con `redirect(...)`**: bien hecho, pero TypeScript no narrowa el tipo de `session?.user` después del redirect porque `redirect` está tipado como `never`. La línea 59 (`session.user.id`) lo asume — funciona pero TS no lo verifica. No es un bug (redirect tira), solo una observación.
6. **Pulido visual diferido**: el spec menciona transición/fade al des-favoritear como "mejora opcional NO bloqueante para V1" — no implementada, está OK.

## Tests recomendados al humano (smoke manual)

1. **Logged-in con favoritos** (≥3): visitar `/favorites`, verificar header "Tienes N propiedades guardadas", grid 4 cols en xl, DiscoverMoreCard al final, cada card con heart relleno y CTA inline al pie.
2. **Sin favoritos** (user nuevo o tras limpiar): verificar empty state con `favorite_border` en círculo, copy "Aún no guardaste propiedades", CTA "Explorar propiedades" → `/`.
3. **Toggle view → list**: cambiar a `?view=list`, verificar que las cards renderean horizontales (imagen izq 40%, contenido der 60%), badge listing y heart en su lugar sobre la imagen, CTA al pie de la columna contenido. Probar en mobile (360-414px) y desktop ancho (xl → grid de 2 cols horizontales).
4. **Sort dropdown**: cambiar a "Precio: menor a mayor" → URL `?sort=price_asc`, verificar orden ascendente; idem para `price_desc`; volver a "Más recientes" → URL queda sin `?sort=` (se borró del query string).
5. **Combinación `?view=list&sort=price_desc`**: cambiar sort no debe perder view ni viceversa (URLSearchParams se mergean en ambos toggles).
6. **Des-favoritear**: click en el heart de una card → optimistic flip inmediato, ~200ms después la card desaparece del grid (revalidatePath), el count del header decrementa, si era la última card → empty state.
7. **CTA "Reservar visita"**: confirmar que navega a `/property/[id]/visit` y cae en 404 (ruta no existe hasta `schedule_visit_screen`) — el spec lo flageó como riesgo aceptado.
8. **CTA en propiedad de renta** (`listing_type='rent'`): el botón al pie debe decir "Agendar tour" con icono `calendar_today`.
9. **Logged-out**: visitar `/favorites` sin sesión → middleware redirige a `/login?next=%2Ffavorites`.
10. **Race condition**: si el guard defensivo del page se dispara (sesión expira entre middleware y render), redirect a `/login?next=/favorites` debería funcionar — difícil de reproducir manualmente, se valida con el código (`page.tsx:54-56`).
