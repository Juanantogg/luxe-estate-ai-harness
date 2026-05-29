# Review — feature property_pretty_urls

**Veredicto:** APPROVED

Spec `design.md` cumplido en sus 11 secciones. `./init.sh` (deps + lint + type-check)
verde; `pnpm build` verde con el árbol de rutas mostrando `/property/[slug]` y
`/property/[slug]/schedule` (cero `/property/[id]`). Helper centralizado, redirect 308,
slug inmutable, columna NOT NULL con índice único TOTAL en remoto (49 slugs, sin
NULLs ni duplicados según el header del archivo de migración) — todo coherente.

---

## Criterios §11 — uno por uno

| #   | Criterio                                                                                                         | Resultado                   | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Migración `0028_properties_slug.sql` existe, aplicada en remoto, `get_advisors` sin ERRORs nuevos                | OK                          | `supabase/migrations/0028_properties_slug.sql` líneas 7-9 documentan que se aplicó vía MCP el 2026-05-27: "49 properties, 0 NULL, 49 slugs unicos, min_len=24 max_len=43. get_advisors: 0 WARN nuevos". No puedo re-correr MCP desde acá; lo doy por confiable.                                                                                                                                                                                                                                                                                                    |
| 2   | `properties.slug` es `text not null` con índice único total                                                      | OK                          | Migración líneas 93-97: `alter column slug set not null;` + `create unique index if not exists properties_slug_key on public.properties(slug);` (sin `where`, índice TOTAL). `src/types/database.ts:293` confirma `slug: string` (no nullable) en `Row`.                                                                                                                                                                                                                                                                                                           |
| 3   | `select slug from properties` sin duplicados ni NULLs                                                            | OK (confiando en migración) | Header de la migración reporta verificación post-aplicación. No verificable desde el sandbox de revisión sin MCP; queda como smoke test de DB ya cubierto por §9 del spec.                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | `src/app/(app)/property/[slug]/page.tsx` existe; `[id]/` no                                                      | OK                          | `ls src/app/(app)/property/` devuelve solo `[slug]`. Rename atómico confirmado. El único `[id]` restante es `src/app/(dashboard)/dashboard/properties/[id]/edit`, fuera de scope (dashboard sigue usando UUID por diseño).                                                                                                                                                                                                                                                                                                                                         |
| 5   | `src/app/(app)/property/[slug]/schedule/page.tsx` existe                                                         | OK                          | Archivo presente, con `params: Promise<{ slug: string }>` (`await`-ed en línea 30), detección UUID + `permanentRedirect` 308 al slug (líneas 36-44).                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | `src/lib/properties/urls.ts` existe y se usa en TODOS los call sites; grep `'/property/${'` sin hardcodes ad-hoc | OK                          | `getPropertyUrl` / `getPropertyScheduleUrl` definidos en `urls.ts` y exportados desde `src/lib/properties/index.ts:38`. Grep `"\`/property/\${"`(template literal) sobre`src/`solo devuelve resultados dentro del propio`urls.ts`, los redirects de los pages (308), `actions.ts`(helper interno`revalidatePropertyPaths`), `visits/actions.ts`(revalidación UUID legacy, decisión explícita §4.1) y`notifications/derive.ts` (UUID legacy delegando al 308, decisión explícita §6). Cero hardcodes ad-hoc en componentes / pages que armen el href de navegación. |
| 7   | `PropertyForm` en modo edit muestra "URL pública" read-only; create NO muestra nada relacionado a slug           | OK                          | `PropertyForm.tsx:345` pasa `initialSlug={mode === 'edit' ? initial?.slug : undefined}`. `BasicInfoSection.tsx:64-80` renderiza el bloque solo si `initialSlug` es truthy, con copy `URL pública` + `<code>/property/{initialSlug}</code>` + helper en español, todo con tokens (`text-muted`, `border-divider-soft`, `bg-surface-soft`, `text-on-surface`). En create `initialSlug` es `undefined`, así que el bloque no aparece.                                                                                                                                 |
| 8   | `src/types/database.ts` incluye `slug: string` en `properties.Row`                                               | OK                          | Línea 293: `slug: string;` en `Row`. `Insert.slug?: string` (línea 328) con comentario explicando el trigger; `Update.slug?: string` (línea 360). Tipos regenerados post-mig 0028 (header línea 7).                                                                                                                                                                                                                                                                                                                                                                |
| 9   | `pnpm build`, `pnpm lint`, `pnpm type-check` verde                                                               | OK                          | `./init.sh` verde (3/3). `pnpm build` compila, prerendera 15 páginas estáticas y el árbol incluye `/property/[slug]` y `/property/[slug]/schedule`. Cero warnings/errors.                                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | Smoke tests §9 marcados por el humano                                                                            | PENDIENTE                   | Reviewer no marca smoke tests; eso lo cierra el leader/humano. La sección §9 está listada para ser copiada a `progress/smoke-tests.md`.                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Reglas duras del repo

| Regla                                                                | Resultado | Evidencia                                                                                                                                                                                          |
| -------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cero hex literales en JSX nuevo/modificado                           | OK        | Grep `bg-\[#`, `text-\[#`, `border-\[#` sobre los archivos tocados → 0 matches. El bloque de slug usa solo tokens del design-system.                                                               |
| `params` / `searchParams` con `await` (Next 16)                      | OK        | `[slug]/page.tsx:43` `const { slug } = await params;`. `[slug]/schedule/page.tsx:30` íd; línea 68 `await searchParams`.                                                                            |
| Sin `createClient` directo de Supabase                               | OK        | Ambos pages y el helper `revalidatePropertyPaths` usan `createClient` desde `@/lib/supabase/server`. No hay `@supabase/supabase-js` `createClient` instanciado a mano.                             |
| Server Components por default; `"use client"` solo donde corresponde | OK        | `[slug]/page.tsx` y `[slug]/schedule/page.tsx` son Server (no `'use client'`). `BasicInfoSection.tsx` ya era Client (form controlado). `urls.ts` es módulo neutro (puede import-arse desde ambos). |
| Mutaciones a Supabase en Server Actions, no en Client Components     | OK        | `revalidatePropertyPaths` vive en `actions.ts` (`'use server'` línea 1). El form sigue usando las actions existentes.                                                                              |
| RLS preservada — `properties` ya tenía policy `select to anon`       | OK        | Migración 0028 no toca RLS. El query nuevo `eq('slug', ...)` cae bajo la misma policy existente (decisión documentada §1 del spec).                                                                |
| Textos en español                                                    | OK        | "URL pública", "La URL no cambia aunque edites el título. Generada al crear la propiedad." Comentarios JSDoc en español.                                                                           |

---

## Findings adicionales (search por inconsistencias)

Verificaciones puntuales pedidas por el leader:

1. **¿Algún componente que sigue recibiendo `propertyId` para construir URL pero debería recibir
   `propertySlug`?** No. `AgentBadge` migró a `propertySlug` (línea 12 + 53). `VisitScheduler`
   conserva `propertyId` (lo necesita para el Server Action `scheduleVisit`) Y suma
   `propertySlug` para el href de "Cancelar" (línea 23-26, 206) — patrón correcto.

2. **¿Algún SELECT que olvide `slug` y rompa en runtime cuando se acceda a `.slug` en el render?**
   No. `PropertyForCard` (queries.ts:24 + SELECT_COLUMNS línea 43), `PropertyForDetail`
   (línea 313 + DETAIL_SELECT_AUTHED/ANON líneas 411/425), `PropertyForEdit` (línea 554 +
   EDIT_SELECT_COLUMNS línea 608), `PropertyForManagement` (`dashboard/queries.ts:29` +
   LIST_SELECT_BASE línea 71), y `VisitForCard.property.slug` (`profile/queries.ts:96`
   - select línea 198) — los 5 proyecciones manuales incluyen `slug` tanto en el tipo
     como en el SELECT.

3. **¿El redirect 308 cubre todos los casos?**
   - UUID viejo válido → `eq('id', slug).maybeSingle()` → 308 a `/property/<slug>`. OK.
   - UUID válido pero fila inexistente → `legacyError || !legacyRow` → `notFound()`. OK.
   - UUID inválido → no matchea `UUID_REGEX` → cae al lookup por slug normal → `notFound()`. OK.
   - Slug inexistente → `getPropertyDetail` devuelve null → `notFound()`. OK.
   - El bloque está replicado simétricamente en `[slug]/page.tsx` (con target `/property/<slug>`)
     y en `[slug]/schedule/page.tsx` (con target `/property/<slug>/schedule`).

4. **¿El helper `revalidatePropertyPaths` está sin export (interno)?**
   OK. `actions.ts:33` `async function revalidatePropertyPaths(...)` — sin `export`,
   sin aparecer en `index.ts`. Es interno al módulo.

5. **¿Algún `revalidatePath('/property/${...}')` quedó fuera del helper?**
   - `src/lib/properties/actions.ts`: 6 ocurrencias migradas al helper
     (líneas 112, 127, 297, 621, 997, 1091). Coincide con el conteo del spec §10 paso 7.
   - `src/lib/visits/actions.ts:154, 170`: dos `revalidatePath` con UUID conservados a
     propósito (decisión explícita §4.1 — el input de la action es UUID, el page hace
     redirect 308 el primer render). Comportamiento esperado.
   - `src/lib/notifications/derive.ts:41`: devuelve `/property/${row.property_id}` con
     UUID, también esperado (decisión §6 — el 308 lo resuelve transparentemente).

6. **Inmutabilidad post-INSERT.** Trigger `properties_set_slug` se crea solo
   `before insert` (línea 84), nunca en `update`. La función helper además solo
   asigna si `new.slug is null`. Editar title/city desde el form NO regenera slug.

7. **`PropertyLookup` discriminated union.** `queries.ts:492`
   `type PropertyLookup = { id: string } | { slug: string }` usado en `getPropertyDetail`
   con `'slug' in lookup` (línea 515) — TS-friendly y permite exigir exactamente una clave.

---

## NITs (no bloquean)

Ninguno significativo. Posibles micro-mejoras para una iteración futura
(no necesarias para mergear):

1. `[slug]/page.tsx:25` y `[slug]/schedule/page.tsx:16` duplican la constante
   `UUID_REGEX` literal. Si en el futuro aparece un tercer page público de
   property, mover a `src/lib/properties/urls.ts` como `export const UUID_REGEX`.
   Hoy son solo 2 instancias, no amerita el refactor.

2. `revalidatePropertyPaths` hace una query extra por mutation (lookup del
   slug). Para edits (`updateProperty`) el slug ya está en scope tras el
   select de la action; podría pasarse al helper como segundo arg
   opcional para ahorrar el round-trip. Costo actual: ~1ms por mutation —
   despreciable, fuera del scope de esta feature.

---

## Cambios requeridos

Ninguno.
