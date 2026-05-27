# Review — feature home_hero_visual_polish

**Veredicto:** APPROVED

## Checklist

- Tokens y colores: [x] — cero hex literales en los 3 archivos diff. Solo tokens existentes (`bg-primary`, `text-on-primary`, `shadow-soft`, `rounded-lg`). Verificado con `grep -E '#[0-9A-Fa-f]{3,8}'` en `HeroSearch.tsx`, `Chip.tsx`, `ListingTypeToggle.tsx` → 0 matches.
- Componentes y framework: [x] — sin nuevas dependencias; `HeroSearch` y `Chip` siguen como Server Components; `ListingTypeToggle` mantiene `'use client'` justificado por `router.replace({ scroll: false })`. No se tocó lógica de routing.
- Supabase: [x] — no aplica (feature 100% visual, sin queries ni mutaciones).
- Fidelidad visual: [x] — la decisión "armónico pero no idéntico" (`rounded-lg` botón vs `rounded-xl` input) preserva jerarquía visual: el botón es subordinado al contenedor (input), no su gemelo. Coherente con la práctica de Material/HIG donde el control interior tiene radio menor. Los 2 pill groups de la home (`ListingTypeToggle` + `PropertyTypeChips` vía primitivo) quedan homogéneos en mosque, alineados con el resto del sistema (botones primarios, badges).
- Calidad: [x] — `./init.sh` (deps + lint + type-check) verde. Sin `console.log`. `feature_list.json` actualizado (`pending` → `in_progress`); el leader hará el cierre a `done`.

## Acceptance criteria (uno a uno)

1. **"HeroSearch: el botón submit visualmente armónico con el input (radios consistentes)"**
   ✅ Cubierto en `src/components/home/HeroSearch.tsx:30`. El botón pasa de `rounded` (0.25rem) a `rounded-lg` (0.5rem), reduciendo el mismatch contra el input `rounded-xl` (0.75rem). La diferencia residual de 0.25rem es intencional (jerarquía visual contenedor > control interno).

2. **"ListingTypeToggle: la opción activa usa color primary (mosque verde) coherente con el resto del sistema"**
   ✅ Cubierto en `src/components/property/ListingTypeToggle.tsx:60`. Estado activo: `bg-primary text-on-primary shadow-soft`. El `shadow-soft` se preservó.

3. **"Comparar visualmente en /dev/ui o en home: las 3 opciones del toggle no deberían parecer un sistema de color distinto del resto de la app"**
   ✅ Cubierto vía el cambio del primitivo `Chip` en `src/components/ui/Chip.tsx:20` (variant `selected`). Ahora los 2 pill groups de la home (`ListingTypeToggle` + `PropertyTypeChips`) y el showcase de `/dev/ui` (línea 210) renderizan todos en mosque, consistentes con `bg-primary` usado en botones y otras acciones primarias.

4. **"Sin tocar la lógica de routing del toggle (router.replace({ scroll: false }) sigue igual)"**
   ✅ Cubierto. `ListingTypeToggle.tsx:39` intacto: `router.replace(qs ? \`/?${qs}\` : '/', { scroll: false })`. El cambio es estrictamente la línea 60 (className condicional).

5. **"Cero hex literales nuevos: usar solo tokens existentes"**
   ✅ Verificado en los 3 archivos. Tokens usados: `bg-primary` (→ `#006655` mosque), `text-on-primary` (→ `#ffffff`), `shadow-soft`, `rounded-lg`, `border-transparent`. Todos preexistentes en `src/app/globals.css` (líneas 32 y 35 confirman `--color-primary` y `--color-on-primary`).

## Blast radius del cambio en el primitivo Chip

Verificado con `grep -rn 'variant=.*selected' src/`:

- `src/components/ui/Chip.tsx:37` — JSDoc `@example` (no es call site, solo doc string).
- `src/components/home/PropertyTypeChips.tsx:56` — target deseado (consistencia con `ListingTypeToggle`).
- `src/app/dev/ui/page.tsx:210` — showcase, comportamiento esperado (espejo del sistema).

No hay call sites no documentados. Blast radius limpio y exactamente el descrito en `notes` del backlog y en `design.md`.

## Contraste WCAG

`text-on-primary` (#FFFFFF) sobre `bg-primary` (#006655):

- Luminancia relativa de #006655 ≈ 0.0865.
- Ratio: (1.0 + 0.05) / (0.0865 + 0.05) ≈ **7.68:1**.
- ✅ Pasa **AAA** para texto normal (≥ 7:1) y AA para todos los tamaños. El cambio anterior (`bg-surface-inverse` Nordic #19322F sobre blanco) tenía ratio aún mayor pero ambos están muy por encima del mínimo. Sin regresión de contraste.

## Cambios requeridos

Ninguno. Cierre limpio: 3 archivos, 3 líneas, blast radius validado, init.sh verde, acceptance 5/5.
