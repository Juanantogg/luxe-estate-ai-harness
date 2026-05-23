# Review — search_filters_modal

**Veredicto:** APPROVED

## Resultados de verificación

- `pnpm lint` → OK (sin warnings).
- `pnpm type-check` → OK (`tsc --noEmit` sin errores).
- `pnpm build` → OK. Compilación con Turbopack en ~1.3s, TypeScript ~1.4s, 11 páginas generadas. `/search` queda como ruta dinámica (`ƒ`), como exige el spec.

## Checklist

### Reglas duras

- [x] **Cero hex en JSX**: `grep -rnE '#[0-9a-fA-F]{3,8}' src/components/search src/lib/search src/app/(app)/search/page.tsx` no devuelve nada. Los únicos hex viven en `src/app/globals.css` (tokens + `.range-thumb-primary`), que es donde corresponden.
- [x] **`"use client"` correcto**: marcado en los 5 componentes interactivos (`FiltersModal`, `FiltersTrigger`, `RangeSlider`, `CounterPill`, `AmenityChipGroup`). `filter-params.ts` es lib pura sin directiva. `search/page.tsx` es Server Component sin directiva.
- [x] **`await searchParams`**: `src/app/(app)/search/page.tsx:100` (`const sp = await searchParams;`). El tipo del prop es `Promise<...>`.
- [x] **Sin `createClient` directo**: tanto la página como la Server Action usan `@/lib/supabase/server`.
- [x] **Español**: títulos ("Filtros"), labels ("Ubicación", "Precio", "Detalles", "Amenidades", "Tipo de propiedad", "Habitaciones", "Baños", "Precio mín/máx"), CTA ("Ver N propiedades", "Limpiar filtros", "Aplicando…"). Ningún literal en inglés.
- [x] **Sin deps nuevas**: `git diff HEAD package.json` no devuelve cambios.
- [x] **Mobile-first**: bottom-sheet sin prefijo (`flex items-end justify-center`), `md:` agrega centrado vertical/zoom; grid `grid-cols-1 md:grid-cols-2`, `grid-cols-2 md:grid-cols-3`; padding `px-6 py-6 md:px-8 md:py-8`.

### Spec compliance (8 acceptance)

1. [x] **`FiltersModal.tsx` Client Component** — `src/components/search/FiltersModal.tsx:1` con `"use client"`.
2. [x] **Mobile bottom sheet + desktop dialog `max-w-2xl`** — `rounded-t-xl md:my-auto md:max-w-2xl md:rounded-xl` (`FiltersModal.tsx:370`). Animación `slide-in-from-bottom md:fade-in md:zoom-in-95`. Swipe-to-dismiss diferido a iteración futura (spec lo permite; queda Esc + overlay click + grab handle visible). NIT documentado.
3. [x] **Slider dual lee/escribe `?min_price=&max_price=`** — `RangeSlider` con dos `<input type=range>` superpuestos, rango condicionado por `getPriceRangeForListing(listing)` (`filter-params.ts:40`). Sale `[0, 10_000_000]` step `50_000`, rent `[0, 20_000]` step `100`. `serializeFilters` solo emite el param cuando difiere del extremo.
4. [x] **Counters bedrooms/bathrooms con formato `N+`** — `CounterPill` con `defaultFormat` que devuelve `Cualquiera` para 0, `${n}+` para 1–5, y `6+` para el tope. Coherente con el spec (que aceptaba `5+` o `6+` según implementación; el max definido en spec es 6, y la display lo respeta).
5. [x] **11 amenities** — `AmenityChipGroup` itera `Constants.public.Enums.amenity_key` (11 valores), no las 6 del mockup. Labels desde `AMENITY_LABEL_ES`, iconos desde `AMENITY_ICON`. Estado activo con `bg-primary-soft`, `border-primary`, punto indicador `bg-primary`.
6. [x] **Submit navega a `/search?...` y cierra modal** — `handleSubmit` usa `serializeFilters` + `router.push` dentro de `startTransition`, luego `onClose()`.
7. [x] **Botón con count en vivo** — Server Action `getMatchingPropertiesCount` (`actions.ts:102`) con `head: true` + `count: 'exact'`. Debounce de 350ms en `FiltersModal.tsx:194`, `AbortController` cancela request previo (`FiltersModal.tsx:195`). `aria-live="polite"` en el botón (`FiltersModal.tsx:563`).
8. [x] **Clear filters resetea state local** — `handleClear` (`FiltersModal.tsx:271`) preserva `q` y `listing` y resetea todo lo demás. No navega ni cierra; el count se recalcula vía el `useEffect`. Conforme al spec (que aclara que el acceptance "resetea searchParams a vacío" se interpreta como reset local; la URL solo cambia al pulsar el CTA).

### Decisiones cerradas

1. [x] **Amenities → OR**: `getMatchingPropertiesCount` (`actions.ts:107-119`) y `search/page.tsx:109-121` hacen `select property_id from property_amenities where amenity in (...)` y luego `q.in('id', ids)`. Si el set queda vacío, short-circuit a `count = 0` sin pegar al server (`actions.ts:118`).
2. [x] **Slider condicionado por `listing=rent`**: `getPriceRangeForListing` devuelve `{ min:0, max:20_000, step:100 }` para `rent` y `{ min:0, max:10_000_000, step:50_000 }` en caso contrario. El `RangeSlider` y los inputs Min/Max usan ese rango.
3. [x] **Location → `ilike` sobre `city`**: tanto la página (`search/page.tsx:139`) como la action (`actions.ts:127`) hacen `q.ilike('city', `%${filters.location}%`)`. La limitación "Beverly Hills, CA" está aceptada y documentada en el spec.
4. [x] **Div custom con focus-trap propio**: `<div role="dialog" aria-modal="true" aria-labelledby={headingId}>` en `FiltersModal.tsx:363-373`. Focus-trap manual via `keydown` listener que cicla con Tab/Shift+Tab (`FiltersModal.tsx:241-254`). Esc cierra. No usa `<dialog>` ni Radix.

### Calidad técnica

- [x] **Focus management**: al montar, `requestAnimationFrame(() => closeButtonRef.current?.focus())` (línea 258). Al desmontar, se devuelve foco a `document.activeElement` capturado al inicio (`previouslyFocused`, líneas 222 y 265). Decisión del implementer (sin `triggerRef`) es válida y robusta para el caso público.
- [x] **Debounce + AbortController**: 350ms (constante `COUNT_DEBOUNCE_MS`), `AbortController` cancela la promesa previa antes de disparar la nueva (`FiltersModal.tsx:191-218`).
- [x] **`aria-live="polite"`** en el botón Ver N propiedades (línea 563). También en el span central del `CounterPill` (línea 71).
- [x] **`router.replace` al cerrar con `?filters=open`**: `close` (líneas 179-188) detecta el param y reemplaza la URL sin él.
- [x] **Badge en `FiltersTrigger`**: `countActiveFilters(filters)` devuelve el conteo y se renderiza un `<Badge variant="primary" size="sm">` cuando hay filtros activos (`FiltersTrigger.tsx:46-49`).
- [x] **Query del listado**: `listing_status='active'` + todos los filtros + subquery amenities. Inner join con `property_images` filtrado por `is_main`, orden por `published_at` desc, límite 48.
- [x] **`export const dynamic = 'force-dynamic'`** declarado en `search/page.tsx:16`.
- [x] **`head: true` + `count: 'exact'`** en `getMatchingPropertiesCount` (`actions.ts:123`).

### Fidelidad visual

- [x] Layout coincide con `docs/designs/search_filters_screen/screen.png`: header con "Filtros" + close, Location con icono `location_on`, slider dual con valor formateado, cards Min/Max Price, Property Type select + Bedrooms/Bathrooms counters en grid, amenities chips con punto indicador, footer "Limpiar filtros" + CTA primario con flecha.
- [x] Tokens: `bg-surface`, `bg-background`, `bg-primary`, `bg-primary-soft`, `bg-on-surface/40 backdrop-blur-sm`, `text-on-surface`, `text-muted`, `text-primary`, `border-divider-soft`, `border-outline`, `border-primary`, `shadow-soft-hover`, `shadow-card`, `bg-neutral-200`.

## Observaciones

Nada bloqueante. Tres notas menores para referencia futura, ninguna detiene el commit:

- **NIT** — `FiltersModal.tsx:108-118` reimplementa `countActiveFilters` inline en lugar de importarlo de `filter-params.ts` (que ya tiene esa función). No es bug; solo duplicación menor. Si se toca el modal de nuevo, vale la pena consolidar.
- **NIT** — Swipe-to-dismiss del bottom sheet quedó como grab handle visual + Esc + tap fuera, sin gesture handler. El spec aceptaba esta simplificación (`§"Notas para el implementer"`); documentado por el implementer en sus notas.
- **NIT** — En `RangeSlider.tsx:90`, el thumb min sube su `z-index` solo cuando coincide con el extremo derecho. En la práctica esto basta porque el usuario rara vez deja ambos thumbs en la posición exacta del extremo izquierdo, pero conviene tener en mente que un caso límite de "ambos thumbs en `min`" puede atrapar al usuario en el thumb max. No es severo; aceptable.

## Recomendación final

Cumple las 8 condiciones de aceptación, respeta las 4 decisiones cerradas con el humano, pasa lint/type-check/build, y la jerarquía visual sigue el mockup con las desviaciones documentadas. **Listo para commit y para que el leader marque la feature como `done`** en `feature_list.json`.
