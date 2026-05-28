# Review — topnav_active_link_listing_sale

**Status**: APPROVED
**Fecha**: 2026-05-27
**Reviewer**: reviewer agent

## Resumen

Cambio quirúrgico (1 archivo de código + status flip en `feature_list.json`)
sobre `src/lib/nav/active-link.ts`. Se reemplaza la línea
`return linkListing === currentListing;` por un guard previo
`if (linkListing === null) return currentListing === null || currentListing === 'sale';`
que mantiene match exacto cuando el link declara `listing` (caso "Rentar").
JSDoc y comentario inline coherentes entre sí y con la decisión humana
(Opción B). Los 16 casos canónicos del spec pasan al evaluarlos contra el
código. `pnpm lint` y `pnpm type-check` verdes. Blast radius exacto al
esperado: TopNav, NavLinks, MobileNavDrawer y ListingTypeToggle quedaron
intactos. Sin regresiones detectables.

## Acceptance criteria (A1-A10)

- [x] **A1** — Decisión Opción B documentada en `progress/topnav_active_link_listing_sale/design.md` (§ Decisión cerrada por el humano) y reflejada en el JSDoc del helper en `src/lib/nav/active-link.ts:10-19`. No requirió tocar `CLAUDE.md` ni `design-system.md`, correcto (es detalle de implementación de un helper puro).
- [x] **A2** — TopNav 'Comprar' activo en `/?listing=sale`: `active-link.ts:37-39` devuelve `true` cuando `linkListing===null && currentListing==='sale'` (caso #3).
- [x] **A3** — TopNav 'Comprar' sigue activo en `/` sin query: misma rama `active-link.ts:37-39`, `currentListing===null` (caso #1).
- [x] **A4** — `ListingTypeToggle` no fue tocado (`git diff` confirma sólo `feature_list.json` + `active-link.ts`). Sus 3 estados funcionales/visuales intactos.
- [x] **A5** — URLs producidas coherentes: TopNav 'Rentar' `href='/?listing=rent'` (sin cambio) idéntica a la del toggle. TopNav 'Comprar' `href='/'` (sin cambio) diferente del toggle Comprar `/?listing=sale`, pero gracias al helper relajado ambos marcan 'Comprar' activo.
- [x] **A6** — Cero hex literales nuevos (el helper no toca estilos). Firma pública `(pathname, search, href) => boolean` preservada. Ambos call sites (`NavLinks.tsx:40`, `MobileNavDrawer.tsx:203`) compilan sin cambios.
- [x] **A7** — TopNav 'Rentar' no regresiona: la rama `return linkListing === currentListing;` se preserva en `active-link.ts:40` para cuando `linkListing` no es `null` (casos #2, #4, #5, #6).
- [x] **A8** — Rutas no-home preservadas: `active-link.ts:43-44` mantiene `pathname === pathHref` + `startsWith(`${pathHref}/`)` (casos #9-#12).
- [x] **A9** — `pnpm lint` y `pnpm type-check` ejecutados, ambos verdes (sin output ni errores).
- [x] **A10** — Smoke test en browser: queda como pendiente humano (no puedo ejecutarlo desde acá). El leader debe agregarlo a `progress/smoke-tests.md` antes del commit final.

## Casos de prueba (#1-#16)

Evaluados mentalmente contra el código final (`active-link.ts:25-45`).
Notación: `linkListing` = `linkParams.get('listing')`, `currentListing` = `currentParams.get('listing')`.

| #   | pathname                | search                    | href             | expected | actual                                                                                   | OK? |
| --- | ----------------------- | ------------------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------- | --- |
| 1   | `/`                     | `""`                      | `/`              | `true`   | `true` (linkListing=null, currentListing=null → primera rama de OR)                      | ✓   |
| 2   | `/`                     | `""`                      | `/?listing=rent` | `false`  | `false` (linkListing='rent', currentListing=null → `'rent'==='null'` no, devuelve false) | ✓   |
| 3   | `/`                     | `"listing=sale"`          | `/`              | `true`   | `true` (linkListing=null, currentListing='sale' → segunda rama de OR)                    | ✓   |
| 4   | `/`                     | `"listing=sale"`          | `/?listing=rent` | `false`  | `false` (linkListing='rent', currentListing='sale' → match exacto falla)                 | ✓   |
| 5   | `/`                     | `"listing=rent"`          | `/`              | `false`  | `false` (linkListing=null, currentListing='rent' → ninguna rama del OR matchea)          | ✓   |
| 6   | `/`                     | `"listing=rent"`          | `/?listing=rent` | `true`   | `true` (linkListing='rent', currentListing='rent' → match exacto)                        | ✓   |
| 7   | `/search`               | `""`                      | `/`              | `false`  | `false` (línea 31: pathname !== '/' → return false)                                      | ✓   |
| 8   | `/search`               | `""`                      | `/?listing=rent` | `false`  | `false` (mismo corto en línea 31)                                                        | ✓   |
| 9   | `/dashboard`            | `""`                      | `/dashboard`     | `true`   | `true` (rama no-home, línea 43: match exacto)                                            | ✓   |
| 10  | `/dashboard/properties` | `""`                      | `/dashboard`     | `true`   | `true` (línea 44: `startsWith('/dashboard/')`)                                           | ✓   |
| 11  | `/admin/users`          | `""`                      | `/admin`         | `true`   | `true` (línea 44: `startsWith('/admin/')`)                                               | ✓   |
| 12  | `/favorites`            | `""`                      | `/favorites`     | `true`   | `true` (línea 43: match exacto)                                                          | ✓   |
| 13  | `/`                     | `"listing=sale&type=apt"` | `/`              | `true`   | `true` (currentListing='sale' → segunda rama del OR; `type=apt` ignorado)                | ✓   |
| 14  | `/`                     | `"type=apt"`              | `/`              | `true`   | `true` (currentListing=null → primera rama del OR)                                       | ✓   |
| 15  | `/`                     | `"listing=foo"`           | `/`              | `false`  | `false` (linkListing=null, currentListing='foo' → ni null ni 'sale')                     | ✓   |
| 16  | `/`                     | `"listing=foo"`           | `/?listing=rent` | `false`  | `false` (linkListing='rent' !== 'foo')                                                   | ✓   |

16/16 casos pasan. Comportamiento defensivo (#15-#16) preservado: valor
desconocido de `listing` deja ambos links inactivos.

## Blast radius

- **Archivos modificados** (`git diff --stat`):
  - `feature_list.json` — únicamente status `pending` → `in_progress` + actualización del campo `description` con la decisión cerrada (autorizado por el spec).
  - `src/lib/nav/active-link.ts` — el helper, según plan.
- **Untracked**: `progress/topnav_active_link_listing_sale/` (esperado: design.md + esta review).
- **Esperados**: `src/lib/nav/active-link.ts` + `feature_list.json` (status change). Match exacto.
- **Diff con lo esperado**: ninguno.
- **No modificados (verificado)**: `src/components/nav/TopNav.tsx`, `src/components/nav/NavLinks.tsx`, `src/components/nav/MobileNavDrawer.tsx`, `src/components/home/ListingTypeToggle.tsx`. `git diff` de esos 4 paths no devuelve output.

## NITs (no bloqueantes)

1. La descripción del cambio en `feature_list.json` se actualizó (no era estrictamente necesario; `notes` ya capturaba la recomendación). Es información útil, no introduce ruido — lo dejo como observación, no como pedido.
2. La acceptance A1 original del backlog dice "Decidir y documentar en CLAUDE.md o design-system.md cuál es el modelo correcto". El spec del designer reinterpretó eso como "documentar en design.md + JSDoc del helper" y el implementer lo siguió. Es razonable porque el helper aísla el detalle, pero si el humano quería rastro explícito en `CLAUDE.md`, este punto queda fuera. No es bloqueante (la decisión sí está documentada, sólo cambia la ubicación).

## Bloqueantes

Ninguno.

## Verificación automática

- `pnpm lint`: OK (sin warnings ni errores).
- `pnpm type-check`: OK (sin errores TS).
- `./init.sh` no se ejecuta acá: el harness dispara `pnpm build` en el `Stop` hook al cerrar sesión, así que la verificación full quedará cubierta en ese momento. Si el leader prefiere ejecutarlo explícitamente antes de mergear, perfecto, pero no es bloqueante para esta review (el cambio es 1 helper puro sin imports nuevos).
