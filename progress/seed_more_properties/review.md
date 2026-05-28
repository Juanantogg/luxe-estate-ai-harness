# Review — feature seed_more_properties

**Veredicto:** APPROVED

## Acceptance ítem por ítem (§8 backlog + design)

### A1 — Properties ~40-50 con variedad

✓ **Cumple sobrado.** `scripts/seed.ts` define **49 properties** (12 existentes + 37 nuevas).

Conteo por `propertyType` (verificado con `grep`):

- `house`: 12 ≥ 10 ✓
- `apartment`: 11 ≥ 10 ✓
- `villa`: 10 ≥ 5 ✓
- `penthouse`: 10 ≥ 5 ✓
- `condo`: 3 (variedad extra)
- `townhouse`: 3 (variedad extra)

Mix listing_type: `sale` 34 / `rent` 15 — mix razonable ✓
Featured (`isFeatured: true`): 9 ≥ 4 ✓ (líneas 144, 168, 278, 386, 521, 777, 800, 845, 999)
Ciudades únicas: 16 distintas en `PROPERTIES[]` (Beverly Hills, Vancouver, Seattle, Portland, Bend, Miami, Palo Alto, New York, Copenhagen, San Diego, Austin, Aspen, Boston, San Francisco, Whistler, Scottsdale) ≥ 5 ✓

Cuenta DB verificada por el leader vía MCP: 49 properties, mismo desglose.

### A2 — Idempotencia preservada

✓ **Properties (§4.1)**: patrón intacto en `scripts/seed.ts:1393-1398` — `select id where owner_id=? AND title=? maybeSingle`. Re-corrida no inserta nada nuevo (3 corridas reportadas por implementer, 0 duplicados en DB).

✓ **Property_images (§4.2)**: fix aplicado en `seedPropertyImages` (líneas 1463-1505). Verificado abajo en sección dedicada.

✓ **Amenities (§4.3)**: solo se insertan en branch de property nueva (`scripts/seed.ts:1442-1447`), dentro del `if (!existing)`. Re-corrida no duplica.

### A3 — 5-7 imágenes por property con URLs estables Unsplash

✓ Superado: `IMAGES_PER_PROPERTY = 6` (`scripts/seed.ts:1356`) dentro del rango acordado.
✓ DB verificada por el leader: 294 property_images = 49 × 6, exactamente 1 main por property, 0 corrupción.
✓ 5 IDs 404 detectados y reemplazados durante la implementación, documentados en `scripts/seed-notes.md:92-106`.

### A4 — Documentar en notes.md cómo elegir IDs y qué hacer si URL se rompe

✓ `scripts/seed-notes.md` (113 líneas, archivo nuevo) cubre:

- "Cómo agregar IDs nuevos" (líneas 11-19)
- "Cómo agregar IDs orientados por property_type" (líneas 21-28)
- "Qué hacer si una URL se rompe" (líneas 30-45) con paso `curl -I` y mecanismo de refresh forzado
- "Convenciones de uso" (líneas 47-57)
- "Idempotencia" (tabla por tabla, líneas 59-74)
- "Sanity check tras re-run" (queries SQL, líneas 76-90)
- "Histórico de reemplazos por 404" con tabla de los 5 IDs (líneas 92-106)
- Variables de entorno (líneas 108-112)

### A5 — Humano corre `pnpm db:seed` y ve 40+ properties en la home

✓ Script disponible en `package.json:"db:seed": "tsx scripts/seed.ts"`. Implementer corrió 3 veces sin desviaciones. Leader confirmó 49 properties en DB (48 `active` + 1 `pending`), de las cuales >40 son visibles en la home pública.

## Fix obligatorio §4.2

✓ **Aplicado correctamente.** `scripts/seed.ts:1463-1505`:

1. Lee imágenes existentes con `position, is_main` (línea 1469-1473).
2. Si `existingCount >= IMAGES_PER_PROPERTY` → skip con log (línea 1477-1480). **Idempotencia estricta.**
3. Detecta si ya hay main (`hasMain`, línea 1482) y calcula `startPosition` (línea 1483).
4. Genera plan completo con `pickImagesFor` y descarta los primeros `existingCount` (línea 1488-1489). **Posiciones consecutivas a partir de startPosition.**
5. `is_main: !hasMain && i === 0` (línea 1495) → **nunca duplica is_main** cuando se completa parcialmente.
6. Inserta solo las filas faltantes con `position: startPosition + i` (línea 1496).

Comportamiento confirmado por el leader vía MCP: 49 mains exactos, 0 properties con conteo ≠ 6, 0 positions duplicadas. La lógica es correcta para el caso operacional normal (positions previas contiguas).

## Otras validaciones del protocolo

✓ **Unicidad de títulos**: `grep -E "^\s+title:" scripts/seed.ts | sort | uniq -d` devuelve vacío.
✓ **Pool Unsplash ≥48 IDs únicos**: 49 IDs en `UNSPLASH_PHOTO_IDS` (líneas 1257-1307), sin duplicados internos (`uniq -c | awk '$1>1'` vacío dentro del bloque).
✓ **`Tribeca Studio` con `bedrooms: 1`**: confirmado en `scripts/seed.ts:604`.
✓ **Owners válidos**: solo se usan los 5 emails seedeados (`david`, `marcus`, `michael.ross`, `sarah.jenkins`, `sarah`). No se inventan emails.
✓ **No toca `src/`**: `git diff --name-only` lista solo `feature_list.json` y `scripts/seed.ts`. Sin nuevas dependencias (`package.json` no en diff).
✓ **No hay scripts ad-hoc residuales**: `ls scripts/` solo `seed.ts` y `seed-notes.md`. Los `_purge.mts` / `_normalize.mts` no están en disco.
✓ **Cero hex literales nuevos**: N/A (seed, no JSX).
✓ **Sin TODO/FIXME/HACK** en `scripts/seed.ts`.
✓ **`init.sh` (rápido)**: lint + type-check OK (corrido ahora, verde).
✓ **Textos en español**: descripciones de las 37 nuevas properties son consistentes con el patrón de las 12 existentes (descripciones en español, nombres propios/direcciones en inglés — patrón previo respetado).

## NITs no bloqueantes

1. **`scripts/seed.ts:1369-1373`** — la prevención de hero-duplicado salta 7 posiciones, pero si por casualidad `(propertyIndex * 6 + i + 1 + 7) % 49` cae OTRA VEZ en el hero, el bucle no reintenta. Probabilidad muy baja (1/49) y el seed corre sin error en práctica. Si se quisiera robustecer, conviene un loop `while (id === heroId)` con jumps distintos. **No bloquea**: la verificación en DB ya pasó.

2. **`scripts/seed-notes.md:18-19`** — dice "No es necesario ajustar `IMAGES_PER_PROPERTY` — la rotación se calcula con módulo". Cierto para la rotación, pero técnicamente _agregar_ IDs nuevos al pool sí permite poner `IMAGES_PER_PROPERTY` más alto sin choque. Es matiz redaccional, no afecta operación.

3. **`scripts/seed-notes.md:99-104`** — la tabla de reemplazos no incluye la fecha exacta de la verificación con `curl -I` para los nuevos IDs. Es trivial pero ayudaría a futuras auditorías. Opcional.

4. **Pool `EXTERIOR_BY_TYPE` no contempla `condo` ni `townhouse`** (`scripts/seed.ts:1312-1354`). Documentado en `seed-notes.md:26-28` como decisión consciente con fallback a pool general. Las 6 properties de esos tipos heredan el hero del pool general, perfectamente funcional. Mencionado solo para que el lector futuro no se sorprenda.

## Riesgos abiertos (para vigilancia del humano)

1. **Operacional, no del seed (mencionado por el leader)**: si en el futuro se borran filas con positions intermedias (e.g. via DELETE manual sin compactar), una próxima corrida del seed insertará con `position: existingCount + i`, lo que puede generar duplicados sobre las positions intermedias preexistentes (porque `existingCount` cuenta filas, no busca el max(position)+1). El comportamiento actual asume positions previas contiguas. **No hay que tocar nada hoy**, solo recordarlo si el humano borra imágenes a mano.

2. **Smoke browser-based pendiente** (no es trabajo del reviewer):
   - Visual: cargar `/` y validar que "Load more" rinde >40 cards y se agota cómodamente.
   - Galería del detail: abrir 2-3 properties y validar las 6 imágenes (variedad temática, hero acorde al tipo).
   - Detail de una property con tipo `condo`/`townhouse`: confirmar que el fallback al pool general no genera hero raro.

3. **Quota Unsplash en prod**: como ya cubre `next.config.ts:remotePatterns`, y `next/image` cachea, no es problema en desarrollo. Si Vercel sirve la home pública con muchas URLs frescas tras un deploy, podría haber breve degradación. Aceptado (documentado en design.md §6 R3).

## Resumen

Implementación cumple **todos** los acceptance ítems del backlog y el spec. Fix §4.2 de `seedPropertyImages` aplicado correctamente: idempotencia + invariante `is_main` preservados, completa hasta `IMAGES_PER_PROPERTY` sin duplicar. Pool de 49 IDs únicos, 5 reemplazos por 404 documentados con trazabilidad. Sin desviaciones de scope (solo `scripts/`, sin dependencias nuevas, sin tocar `src/`). `init.sh` rápido OK.
