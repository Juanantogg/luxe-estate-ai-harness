# Review — feature home_exclude_featured_from_new_in_market

**Veredicto:** APPROVED

## Resumen del diff

Un único hunk en `src/lib/properties/queries.ts:162-165` (closure
`fetchPage` dentro de `getNewInMarketProperties`): agrega
`q = q.eq('is_featured', false);` con comentario que explica el contrato
semántico complementario entre "Colecciones destacadas" y "Nuevas en el
mercado". No hay otros cambios en código fuente; `feature_list.json`
quedó con `status: in_progress` (lo cerrará el leader).

## Acceptance criteria — uno a uno

1. **"el query excluye properties con is_featured=true"**
   → ✅ `src/lib/properties/queries.ts:165` aplica
   `q = q.eq('is_featured', false)` dentro de `fetchPage`. Excluye también
   filas con `is_featured = null` por semántica de PostgREST `.eq`, pero
   la columna tiene `default false NOT NULL` en el schema (la usa
   `getFeaturedProperties` con `.eq('is_featured', true)` sin defensa de
   null), así que no hay riesgo de "filas fantasma".

2. **"La home pública muestra cada property al menos en 1 sección
   (featured XOR new in market)"**
   → ✅ `getFeaturedProperties` (línea 109) ya pedía `is_featured = true`.
   Con el nuevo `.eq('is_featured', false)` en `getNewInMarketProperties`,
   los dos conjuntos son mutuamente excluyentes a nivel SQL. La home
   (`src/app/(app)/page.tsx:66-74`) los compone con `Promise.all` y no
   hay deduplicación posterior, lo cual ya no es necesaria.

3. **"El fallback `includeOlderIfEmpty` se preserva"**
   → ✅ El filtro vive **dentro** del closure `fetchPage`
   (`queries.ts:152-176`), por lo que se aplica tanto en
   `fetchPage(true)` (con ventana de 30 días) como en `fetchPage(false)`
   (sin ventana). Ver línea 178 (primera llamada) y 182 (fallback). Si
   el filtro se hubiera puesto fuera del closure, el fallback podría
   reintroducir featured y revivir el bug — el implementer hizo
   exactamente la elección correcta y lo documentó en
   `progress/.../design.md:44-66`.

4. **"El filtro NO se aplica si el user navega con filtros activos
   (listingType o propertyType) — mantenerlo opcional como flag o solo
   en el caso 'sin filtros' es decisión de implementación"**
   → ✅ El backlog explícitamente delega esta decisión al implementer y
   el spec del implementer (`design.md:13-17`) registra la decisión del
   leader: **aplicar siempre**. Razonamiento: "destacadas = curado",
   "nuevas = el resto"; si filtros + no-featured = ∅, mejor empty state
   que duplicar las dos featured globales. La elección es coherente con
   la nota del backlog ("Mi recomendación: SIEMPRE").

5. **"Smoke test: navegar a `/` → ninguna property se repite"**
   → ✅ Garantizado por construcción (acceptance #2). Smoke test manual
   pendiente del humano (recomendación: agregarlo a
   `progress/smoke-tests.md`).

## Checklist

- Tokens y colores: [x] no toca JSX ni estilos.
- Componentes y framework: [x] no introduce client/server boundaries
  nuevos; solo modifica un query helper server-side.
- Supabase: [x] usa el cliente inyectado (`SupabaseDb`) y `@supabase/ssr`
  vía el helper existente del caller. Sin instanciación directa, sin
  service_role, sin nuevas tablas/RLS.
- Fidelidad visual: [x] N/A — bug fix lógico que estabiliza el
  contrato visual de la home (cada property aparece en una única
  sección, como sugiere el mockup).
- Calidad: [x] `./init.sh` verde (deps + lint + type-check). El
  comentario es claro y explica el "por qué", no el "qué".

## Análisis de efectos colaterales

`grep getNewInMarketProperties src/` devuelve sólo dos call sites:

- `src/app/(app)/page.tsx:68` — la home pública (el único caso real).
- `src/lib/properties/index.ts:18` — re-export del barrel.

No hay otros consumidores (admin dashboard, búsqueda, etc. usan otras
helpers o consultas directas). El cambio queda completamente acotado al
camino de renderizado de la home, sin riesgo de regresión en otras
pantallas.

### Regresiones esperables — razonamiento sobre filtros activos

Con `?listing=rent` o `?type=apartment`:

- Antes del fix: si las 2 featured matcheaban el filtro, aparecían
  duplicadas (bug). Si no matcheaban, no.
- Después del fix: las featured nunca aparecen en "Nuevas en el
  mercado", matcheen el filtro o no. Si las únicas matches del filtro
  eran las featured, la sección queda vacía → la home renderiza el
  empty state existente (`hasFilters` rama en `page.tsx`). El leader
  cerró esta decisión explícitamente y es coherente con la semántica
  "destacadas curadas vs nuevas".

Posible matiz futuro (no bloqueante): si en producción se observa que
el empty state de "Nuevas en el mercado" se dispara con frecuencia bajo
filtros estrictos, valdría la pena re-evaluar si la sección "Colecciones
destacadas" debe respetar también los query filtros (`listing_type`,
`property_type`). Hoy no lo hace — siempre trae las 2 featured globales —
así que un usuario con `?listing=rent` puede ver una featured de venta
arriba y empty abajo. No es regresión del bug fix; es comportamiento
preexistente que conviene anotar para un eventual follow-up.

## NITs (no bloqueantes)

Ninguno. El fix es mínimo, está bien comentado, y el spec
(`progress/.../design.md`) documenta el razonamiento de ubicación
("dentro del closure, antes de los condicionales") con la justificación
correcta sobre el fallback.

## Conclusión

Bug fix quirúrgico de una línea, con comentario explicativo, ubicado en
el lugar correcto para garantizar que el fallback `includeOlderIfEmpty`
también lo respete. Cubre los 5 acceptance criteria. `init.sh` verde.
APROBADO.
