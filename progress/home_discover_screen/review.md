# Review — home_discover_screen

**Veredicto**: APROBADO CON OBSERVACIONES
**Fecha**: 2026-05-22
**Reviewer**: reviewer (agente)

## Resumen

Implementación completa y muy fiel al spec (incluido el addendum §18 D1-D7).
`./init.sh` rápido pasa verde (deps + lint + type-check). Cero hex literales
en JSX, RLS anon presente como migración versionada y verificada por el
leader, separación Server/Client correcta, optimistic UI bien resuelto y
shell público funcionando. Hallazgos no bloqueantes: pequeño desvío visual
en una etiqueta de spec, duplicación de formatter en `PriceTag` y un
`console.error` que el propio spec ya declara como placeholder de Toast.

## Hallazgos críticos (bloqueantes)

Ninguno.

## Observaciones (no bloqueantes)

1. **`PriceTag.tsx:19-24` duplica el formateo del compact.** Crea su propio
   `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`
   en lugar de reusar `formatPrice(amount, listingType)` (que ya existe en
   `src/lib/properties/format.ts`). El comportamiento es idéntico para `sale`
   y casi idéntico para `rent` (compact pinta `/mes` en un `<span>` aparte
   para estilizarlo). Sugerencia: extraer un `formatPriceParts(amount, listingType)`
   que devuelva `{ base, suffix }` y usarlo en ambos lugares, o exponer
   `formatPriceAmount(amount)` sin sufijo y mantener el `<span>/mes</span>`
   inline. Code smell, no rompe nada.

2. **`PropertyCard.tsx:84-91` — `Link` absoluto con `focus:outline-none`
   sin reemplazo visible.** El `<article>` lleva
   `focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2`
   (línea 82-83 y 192-193), lo cual cubre la a11y porque el ring del padre
   aparece cuando el link recibe foco. Está OK funcionalmente, pero deja el
   patrón frágil: si alguien borra el `focus-within` del wrapper, el foco
   queda invisible. Considerar `focus-visible:outline-none` (más narrow) o
   anclar el comentario explicando la dependencia.

3. **`FavoriteButton.tsx:52` — `console.error('[FavoriteButton]', …)`** es
   el único `console.*` del nuevo código. El spec §5.1 ya lo declara como
   placeholder hasta que exista un Toast component, así que es deuda
   reconocida. Convendría dejar un `// TODO(toast):` con contexto explícito
   para que no parezca debug suelto en futuros greps.

4. **`PropertyCard.tsx:125` — overlay `from-black/60 to-transparent
opacity-60`.** Aceptado por el spec (§12 "Excepciones — negros
   decorativos"). Lo destaco solo para que el commit log o un comment
   referencie la decisión; si alguien hace grep de `black/` en el futuro,
   debería entender por qué vive ahí.

5. **`PropertyTypeChips.tsx:37` — orden de clases atípico.** Mezcla
   `hide-scroll` entre utilities arbitrarias y responsive utilities. Lint no
   se queja, pero por consistencia con el resto del repo conviene agrupar:
   layout → spacing → color → utilities custom → responsive. Estilo.

6. **`queries.ts:200` — `if (error) return new Set();`** silencia el error
   de Supabase sin loguear. Para favoritos cae bien (fail-open evita
   romper la home), pero se pierde visibilidad si la query empieza a
   fallar (ej. cambio de RLS). Sugerencia: `console.warn` con el `error`
   antes del `return`, en línea con lo que ya hace `TopNav` para
   notificaciones (líneas 187-189).

7. **`HomePageSkeleton.tsx` — no incluye los headers de sección con
   subtítulo ni el divider de los chips.** El skeleton es un poco más
   minimalista que el render real. Aceptable para `loading.tsx` (no debe
   ser pixel-perfect), solo dejo nota.

8. **Fidelidad visual del PNG.** El mockup pone el badge "NEW ARRIVAL"
   sobre la card derecha; el código lo deriva por `published_at < 7 días`,
   así que solo aparecerá si el seed tiene una propiedad reciente. No es
   bug, es comportamiento esperado dada la regla §3.4 — pero el reviewer
   humano podría confundirse al comparar contra el PNG. Documentado.

9. **`feature_list.json`** sigue en `in_progress`. El leader debe pasarlo
   a `done` cuando cierre el commit; no es trabajo del implementer.

## Verificaciones positivas

- **Cero hex literales** en `src/app/(app)/`, `src/components/property/`,
  `src/components/home/`, `src/lib/properties/` (grep limpio).
- **`await searchParams` / `await params`** correcto en
  `src/app/(app)/page.tsx:49`, `src/app/(app)/search/page.tsx:12`,
  `src/app/(app)/property/[id]/page.tsx:13`. `await headers()` ya estaba
  bien en `TopNav.tsx:169`.
- **`'use client'`** solo en `FavoriteButton`, `ListingTypeToggle` y
  `MobileNavDrawer` (que ya lo tenía). `HeroSearch` correctamente Server
  con form GET nativo (funciona sin JS).
- **Server Action `toggleFavorite`** valida con zod, devuelve discriminated
  union, no expone detalles internos, revalida `/`, `/favorites`,
  `/property/${id}` en ambas ramas (insert/delete).
- **Queries sin N+1**: `getUserFavoriteIds` usa `IN (...)` con los IDs ya
  cargados. `Promise.all` paraleliza featured + new in market en page.tsx:65.
- **Migración 0013** matchea el SQL del spec §18 D5, drop+create
  idempotente, solo abre SELECT de propiedades `active` y sus imágenes a
  `anon`. NO toca `profiles`, `favorites`, `visits`, `messages`,
  `notifications`. Convención `NNNN_` respetada.
- **TopNav anónimo (§18 D2)**: bifurcación correcta en `TopNav.tsx:245-293`,
  `redirect` defensivo solo para `variant !== 'app'` (línea 159), guard de
  `unreadCount` con `if (user)` (línea 176), CTAs "Iniciar sesión" siempre
  visible y "Registrarse" con `hidden sm:inline-flex` (línea 281).
- **Layout `(app)/` (§18 D3)**: sin `redirect`, pasa `session ?? null` al
  TopNav, comentario explicando el cambio de modelo.
- **Heart anon (§18 D4)**: `aria-label` correcto ("Inicia sesión para
  guardar" cuando `!isAuthenticated`), `router.push('/login?next=/')`,
  `aria-pressed={isAuthenticated ? optimistic : undefined}` (sin
  `aria-pressed` cuando no aplica — correcto).
- **Placeholders `/search` y `/property/[id]`**: Server Components,
  renderizan sin sesión, con link de vuelta a la home.
- **CLAUDE.md "Shell público + protección por middleware"** describe
  fielmente el modelo implementado: layout deja de redirigir, middleware
  es la única defensa, RLS como última línea. Coherente con el código.
- **Tokens y opacidades sobre tokens** (`bg-primary/20`, `bg-surface/90`,
  `text-primary/80`) — todos sobre tokens válidos, ninguno arbitrario.
- **`hide-scroll`** correctamente agregada como `@layer utilities` en
  `globals.css:91-101`.
- **`./init.sh`** rápido pasa verde (deps + lint + type-check).
- **Naming**: kebab/PascalCase consistente con el resto del repo.
- **Imports**: todos via alias `@/`, sin paths relativos cruzados, sin
  imports muertos.

## Sugerencias para el commit

```
feat(home): Discover screen con PropertyCard, favoritos y shell público (home_discover_screen)

Implementa la home `/` con hero + search GET nativo, chips de filtro,
Featured Collections (max 2) y New in Market paginado server-side.
Agrega PropertyCard (variants featured/compact), FavoriteButton con
useOptimistic + Server Action toggleFavorite, ListingTypeToggle y
LoadMoreLink. Convierte `(app)/` en shell público: TopNav soporta
session=null con CTAs login/signup, el layout deja de redirigir y la
protección queda 100% en el middleware. Migración 0013 abre SELECT
de properties active y sus imágenes a anon.
```
