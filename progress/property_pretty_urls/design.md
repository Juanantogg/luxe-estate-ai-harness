# Design spec — property_pretty_urls

> Feature `requires_approval: true`. **Decisiones cerradas con el humano
> antes del spec** (no re-discutir): formato `title-city-suffix4`, slug
> inmutable, índice único TOTAL (no parcial), redirect 308 UUID→slug,
> extensión `unaccent`, truncado a 80 chars por corte de palabra, slug
> read-only en form edit (no en create). Detalle de cómo se realizan en
> §3.

---

## 1. Resumen ejecutivo

Hoy las URLs de detalle de propiedad son `/property/<uuid>` (p. ej.
`/property/8f3c1a2b-...-...`). Son largas, opacas y dañan UX/SEO. Esta
feature las migra a `/property/<slug>` donde `slug = "<title>-<city>-<suffix4>"`
(p. ej. `casa-luxe-polanco-a3f2`), con el `suffix4` derivado de los 4
primeros hex chars del UUID — garantiza unicidad sin lookup pre-insert y
ata el slug a la fila origen.

El slug se genera 100% en DB vía trigger BEFORE INSERT (idempotente: si
ya viene seteado lo respeta). Es **inmutable** post-creación: editar el
title o la city de una property NO regenera el slug. Mantenemos
compatibilidad redirigiendo `/property/<uuid>` → `/property/<slug>` con
**308 Permanent Redirect**, para no romper favoritos, notificaciones
(`property_id` UUID en payload), emails o links externos cacheados. El
índice único sobre `slug` es total (no parcial sobre `listing_status`),
así un slug archivado queda reservado eternamente y no genera confusión
si la property se reactiva. Sin cambios de RLS — `properties` ya cubre
`for select to anon where listing_status = 'active'` y la consulta nueva
solo cambia el filtro `eq('id', ...)` por `eq('slug', ...)`.

---

## 2. Migración SQL — `supabase/migrations/0028_properties_slug.sql`

Número elegido: **0028** (la última aplicada es `0027_profiles_sync_on_email_update.sql`).

> **Nota para el implementer**: el leader aplica esta migración vía MCP
> (`apply_migration`). El implementer NO debe ejecutar SQL — solo deja el
> archivo creado y bien comentado, y bloquea su PR a que el leader confirme
> que la migración corrió en remoto + regeneró `src/types/database.ts` con
> `generate_typescript_types`. Si el implementer corre `pnpm dev` antes de
> que la migración esté aplicada, el endpoint cargará 500 porque la columna
> `slug` no existe.

### 2.1 Estructura del archivo

```sql
-- 0028_properties_slug.sql
-- URLs amigables para properties: agrega columna `slug`, función
-- `generate_property_slug`, trigger BEFORE INSERT idempotente, backfill
-- determinístico e índice único TOTAL. El slug es inmutable post-INSERT:
-- el trigger nunca se dispara en UPDATE.

-- (1) Extensión unaccent para normalizar acentos (áéíóúüñç...).
create extension if not exists unaccent;

-- (2) Columna slug (nullable temporalmente para permitir el backfill;
--     al final de la migración se hace NOT NULL).
alter table public.properties
  add column if not exists slug text;

-- (3) Función generadora. Pura, sin side effects, IMMUTABLE para que
--     PG pueda cachear resultados con los mismos args. SECURITY INVOKER
--     porque solo lee args y no toca tablas — no necesita privilegios
--     elevados.
create or replace function public.generate_property_slug(
  p_title text,
  p_city text,
  p_id uuid
)
returns text
language plpgsql
immutable
security invoker
set search_path = public, extensions
as $$
declare
  v_combined text;
  v_normalized text;
  v_truncated text;
  v_cut_position int;
  v_suffix text;
begin
  -- Concatenar title + ' ' + city (la ciudad puede repetir contexto del title,
  -- pero la presencia de city ayuda a la legibilidad y SEO).
  v_combined := coalesce(p_title, '') || ' ' || coalesce(p_city, '');

  -- 1) lowercase + unaccent (saca acentos y diacríticos)
  v_normalized := lower(unaccent(v_combined));

  -- 2) reemplazar cualquier char NO alfanumérico por '-'
  --    (esto incluye espacios, signos, emojis residuales).
  v_normalized := regexp_replace(v_normalized, '[^a-z0-9]+', '-', 'g');

  -- 3) colapsar '-' repetidos (ya cubierto por '+' arriba, pero defensivo)
  --    y trim de bordes.
  v_normalized := trim(both '-' from v_normalized);

  -- Edge case: title+city solo tenía chars no normalizables → cadena vacía.
  if v_normalized = '' then
    v_normalized := 'property';
  end if;

  -- 4) Truncar a 80 chars POR CORTE DE PALABRA.
  --    Si length <= 80, ya está. Si no, cortar en el último '-' antes
  --    del char 80; si no hay '-', cortar duro en el char 80.
  if length(v_normalized) <= 80 then
    v_truncated := v_normalized;
  else
    v_cut_position := position('-' in reverse(substring(v_normalized from 1 for 80)));
    if v_cut_position > 0 then
      -- v_cut_position cuenta desde la derecha de los primeros 80 chars;
      -- el corte real es a (80 - v_cut_position).
      v_truncated := substring(v_normalized from 1 for (80 - v_cut_position));
    else
      v_truncated := substring(v_normalized from 1 for 80);
    end if;
    -- Trim bordes por si quedó un '-' al final del truncado.
    v_truncated := trim(both '-' from v_truncated);
    if v_truncated = '' then
      v_truncated := 'property';
    end if;
  end if;

  -- 5) Suffix-4: primeros 4 hex chars del UUID. Garantiza unicidad
  --    sin pre-lookup. UUID v4 tiene ~16^4 = 65k combinaciones,
  --    así que la colisión real ocurre solo si OTRA property con MISMO
  --    title+city normalizado comparte los mismos 4 chars iniciales del
  --    UUID — probabilidad despreciable, ver Riesgo R1 §8.
  v_suffix := substring(replace(p_id::text, '-', '') from 1 for 4);

  return v_truncated || '-' || v_suffix;
end;
$$;

-- (4) Trigger BEFORE INSERT, idempotente: solo setea slug si vino NULL.
--     NO toca UPDATE — slug es inmutable post-creación.
create or replace function public.properties_set_slug_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.slug is null then
    new.slug := public.generate_property_slug(new.title, new.city, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists properties_set_slug on public.properties;
create trigger properties_set_slug
  before insert on public.properties
  for each row execute function public.properties_set_slug_on_insert();

-- (5) Backfill determinístico: ORDER BY created_at para que un re-run
--     produzca el mismo orden de procesamiento (irrelevante con índice
--     único TOTAL ya que cada slug es único, pero ayuda al debug).
update public.properties
  set slug = public.generate_property_slug(title, city, id)
  where slug is null;

-- (6) Hacer la columna NOT NULL y agregar índice único TOTAL.
--     Total (no parcial) por decisión del humano: slugs de properties
--     archivadas se reservan eternamente para evitar reuso accidental
--     o confusión con un eventual "restore" futuro.
alter table public.properties
  alter column slug set not null;

create unique index if not exists properties_slug_key
  on public.properties(slug);
```

### 2.2 Decisiones técnicas justificadas

**`IMMUTABLE` vs `STABLE`** para `generate_property_slug`. Es estrictamente
`IMMUTABLE`: dadas las mismas entradas (`p_title`, `p_city`, `p_id`)
siempre devuelve el mismo slug, sin tocar tablas ni `now()`. Marcarla
`IMMUTABLE` permite a Postgres usarla en índices funcionales o cachear
en planes — overhead nulo y futureproof.

**`SECURITY INVOKER`** para ambas funciones. No leen tablas, no necesitan
permisos elevados. Coherente con la guidance de Supabase + nuestro propio
patrón (mig 0022 `properties_sync_sold_at` también es INVOKER). No
otorgamos EXECUTE explícito a `authenticated` ni `anon` porque ninguna
policy RLS las invoca y no se exponen como RPC: solo las usa el trigger
internamente (que las invoca con el rol del transactor) y el backfill
SQL one-shot (corre como `service_role` desde la migración).

**`search_path = public, extensions`** en `generate_property_slug` porque
`unaccent()` vive en el schema `extensions` por defecto en Supabase. Sin
ese path, la función no encuentra `unaccent` y falla. El trigger queda
con `search_path = public` simple (no usa unaccent directo, solo llama a
la función helper). Patrón heredado de mig 0022/0023.

**Backfill seguro respecto a colisiones.** Como `properties_slug_key` se
crea **después** del UPDATE, dos slugs idénticos durante el backfill no
romperían el UPDATE. Pero el `CREATE UNIQUE INDEX` posterior FALLARÍA si
hay duplicados. Riesgo real solo si dos properties tienen idéntico
`title + city` Y los 4 primeros hex de sus UUIDs colisionan — improbable
pero documentado en R1 §8. **Mitigación operativa**: si la migración
falla con `duplicate key value violates unique constraint` durante el
CREATE INDEX, el leader debe regenerar manualmente el slug del ofensor
(p. ej. `update properties set slug = generate_property_slug(title, city,
id) || '-bis' where id = '...'`) y re-aplicar. Por eso esta migración va
con `requires_approval: true` — alguien debe estar mirando.

### 2.3 Verificación post-migración (advisor)

Tras `apply_migration`, el leader debe correr `get_advisors(type:
'security')` y verificar que la única nueva señal aceptable es WARN
`function_search_path_mutable` SOLO si olvidó el `set search_path` (no
debería). Cualquier ERROR es BLOCKER y debe revertirse con una migración
0029 limpia.

---

## 3. Rutas y archivos a modificar

### 3.1 Rename del directorio del segmento dinámico

| Antes                                           | Después                                           |
| ----------------------------------------------- | ------------------------------------------------- |
| `src/app/(app)/property/[id]/page.tsx`          | `src/app/(app)/property/[slug]/page.tsx`          |
| `src/app/(app)/property/[id]/schedule/page.tsx` | `src/app/(app)/property/[slug]/schedule/page.tsx` |

Cambios dentro de cada page:

- `interface ...Props { params: Promise<{ id: string }> }`
  → `params: Promise<{ slug: string }>`.
- `const { id } = await params;` → `const { slug } = await params;`.
- Quitar el `UUID_REGEX` y su `notFound()`. La nueva validación es
  semántica: si la query por slug no devuelve fila, `notFound()`.
- `getPropertyDetail(supabase, id, ...)` → nueva firma
  `getPropertyDetail(supabase, { slug }, ...)` (ver §4 query helper).
- `redirectNext={`/property/${property.id}`}` y
  `href={`/property/${property.id}`}` migran a usar el helper
  `getPropertyUrl(property)` de §4.
- En `schedule/page.tsx`: el `redirect(`/login?next=...`)` interno
  reconstruye el `next` con el slug ya leído.

**Importante**: Next 16 sigue exigiendo `await params` y `await
searchParams` — ya están así, no se cambia ese patrón.

### 3.2 Redirect UUID → slug (308 permanente)

**Decisión: route handler en el page mismo, NO en middleware ni en una
ruta paralela `[id]`.** Mecanismo elegido:

Dentro de `src/app/(app)/property/[slug]/page.tsx`, al inicio del
component (antes del fetch normal):

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (UUID_RE.test(slug)) {
  // Es un UUID, no un slug. Buscar la fila por UUID, leer su slug y
  // redirigir 308 permanente.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .select('slug')
    .eq('id', slug)
    .maybeSingle();
  if (error || !data) notFound();
  permanentRedirect(`/property/${data.slug}`);
}
```

(`permanentRedirect` de `next/navigation` devuelve 308. Es la API
estándar Next 16 para esto, distinta de `redirect()` que devuelve 307.)

El mismo bloque se replica al inicio de `[slug]/schedule/page.tsx` con
target `/property/${data.slug}/schedule`.

**Tradeoffs considerados** (decididos por el designer):

| Opción                                        | Pros                                                                                                                                | Contras                                                                                                                                                                                                      | Elegida |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **A. Detección regex en el mismo page**       | Cero rutas extra, cero duplicación de matchers en middleware. UUID-vs-slug es ambigüedad estructural del path, no de la app entera. | Cada request a `/property/<algo>` paga un branch + posiblemente 1 query extra. Despreciable: una `select slug from properties where id = ...` con índice PK es <2ms.                                         | **SÍ**  |
| B. Middleware con `proxy.ts`                  | Centraliza la lógica; el page solo recibe slugs.                                                                                    | El middleware ya está cargado y vive en el edge — agregar una query Supabase ahí complica la latencia de TODA la app, incluyendo rutas que no son de property. Anti-patrón en Next 16.                       | NO      |
| C. Ruta paralela `[id]/page.tsx` que redirige | Separación clara de responsabilidades.                                                                                              | Next 16 con `[id]` y `[slug]` como hermanos en el mismo directorio del file router es ambiguo: el matcher gana al alfabéticamente primero. Hay que renombrar uno con catch-all, complicando la mental model. | NO      |

Razón final A: la regex UUID es barata, la query de lookup también
(`id` PK con índice nativo), y mantiene la lógica adjacente al
consumidor real.

### 3.3 Actualizar `src/lib/supabase/proxy.ts`

Línea 61 hoy: `/^\/property\/[^/]+\/schedule\/?$/.test(pathname)`. El
regex `[^/]+` ya matchea tanto UUIDs como slugs (cualquier cosa sin `/`).
**No requiere cambio**. Pero debe documentarse con un comentario que el
matcher es deliberadamente agnóstico a UUID-vs-slug porque el redirect
ocurre en el page, no en el middleware.

### 3.4 Comentarios JSDoc / strings a actualizar

`grep` adicional para call sites cosméticos (no rompen, pero quedan
mentirosos):

- `src/components/property/AgentBadge.tsx:26` — comentario menciona
  `/property/[id]`. Cambiar a `/property/[slug]`.
- `src/components/property/PriceAndAgentCard.tsx:18,22` — íd.
- `src/components/property/FavoriteButton.tsx:16` — íd.
- `src/components/layout/Footer.tsx:5` — íd.
- `src/components/dashboard/PropertyManagementRow.tsx:35` — íd.
- `src/lib/properties/actions.ts:23` — íd.
- `src/app/(app)/layout.tsx:8` — comentario menciona `/property/[id]`.

Los call sites funcionales (los que construyen URLs) se cubren en §4.

---

## 4. Helper `getPropertyUrl` — `src/lib/properties/urls.ts`

Archivo nuevo. Mínimo:

```ts
/**
 * Construye la URL del detalle de una property. Centraliza el patrón
 * `/property/<slug>` para que un cambio futuro (p. ej. `/p/<slug>` por
 * SEO o `/property/<city>/<slug>`) sea un solo edit.
 *
 * Acepta cualquier objeto con `slug` para tolerar las proyecciones
 * acotadas de los listados (PropertyCardData, PropertyForDetail,
 * PropertyForManagement, etc.).
 */
export function getPropertyUrl(property: { slug: string }): string {
  return `/property/${property.slug}`;
}

/**
 * Variante que arma la subruta de schedule. Mismo argumento, mismo
 * dominio.
 */
export function getPropertyScheduleUrl(property: { slug: string }): string {
  return `/property/${property.slug}/schedule`;
}
```

Sin tests unitarios — el helper es trivial y el smoke test §9 lo cubre
end-to-end.

### 4.1 Call sites a migrar (graps de `/property/${`)

Tabla completa, derivada de `grep -rn "/property/" src/`:

| Archivo                                              | Línea | Patrón actual                                                                          | Migración                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/property/[id]/page.tsx`               | 99    | `redirectNext={`/property/${property.id}`}`                                            | `redirectNext={getPropertyUrl(property)}` (post-rename a `[slug]`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/app/(app)/property/[id]/schedule/page.tsx`      | 57    | `href={`/property/${property.id}`}`                                                    | `href={getPropertyUrl(property)}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/app/(app)/property/[id]/schedule/page.tsx`      | 37    | `redirect(`/login?next=${encodeURIComponent(`/property/${id}/schedule`)}`)`            | `redirect(`/login?next=${encodeURIComponent(`/property/${slug}/schedule`)}`)`— el`slug` ya está en scope tras el rename.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/property/AgentBadge.tsx`             | 52    | ``const loginHref = `/login?next=${encodeURIComponent(`/property/${propertyId}`)}`;``  | Cambiar prop `propertyId` a `propertySlug` (rename + tipo) y usar `getPropertyUrl({ slug: propertySlug })` para construir el `next`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/components/property/PropertyCard.tsx`           | 114   | `href={`/property/${property.id}`}`                                                    | `href={getPropertyUrl(property)}`. Requiere que `PropertyCardData` exponga `slug` — verificar tipo y agregarlo si falta.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/property/PropertyCard.tsx`           | 238   | `href={`/property/${property.id}`}`                                                    | Igual.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/components/property/PropertyCard.tsx`           | 313   | `href={`/property/${property.id}/visit`}`                                              | **Bug colateral**: el segmento real es `/schedule`, no `/visit` (introducido en `favorites_list_screen` aceptado como deuda). **Decisión humana 2026-05-27**: arreglar dentro de esta feature. Cambiar a `getPropertyScheduleUrl(property)` — el helper devuelve `/schedule` y el bug queda cerrado en el mismo PR.                                                                                                                                                                                                                                                                            |
| `src/components/property/PriceAndAgentCard.tsx`      | 35    | ``const loginNext = `/login?next=${encodeURIComponent(`/property/${property.id}`)}`;`` | `... encodeURIComponent(getPropertyUrl(property))`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/components/property/PriceAndAgentCard.tsx`      | 94    | `href={isAuthenticated ? `/property/${property.id}/schedule` : loginNext}`             | `href={isAuthenticated ? getPropertyScheduleUrl(property) : loginNext}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/visits/VisitScheduler.tsx`           | 199   | `href={`/property/${propertyId}`}`                                                     | Cambiar prop `propertyId` (UUID) por `propertySlug` (string) y usar `getPropertyUrl({ slug: propertySlug })`. Verificar que el page padre pasa el slug.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/components/dashboard/PropertyManagementRow.tsx` | 63    | `href={`/property/${property.id}`}`                                                    | `href={getPropertyUrl(property)}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/components/profile/VisitCard.tsx`               | 119   | `href={`/property/${property.id}/schedule?reschedule=${visit.id}`}`                    | `href={`${getPropertyScheduleUrl(property)}?reschedule=${visit.id}`}`. Requiere que `property` en este context tenga `slug`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/visits/actions.ts`                          | 154   | ``revalidatePath(`/property/${parsed.data.propertyId}/schedule`);``                    | El input `parsed.data.propertyId` SIGUE siendo UUID (los inputs de actions están versionados). Mejor: **NO migrar este `revalidatePath`** — Next acepta el redirect 308 al re-render. **O**, cambiar la action a aceptar slug además de UUID (scope creep). **Decisión**: dejar la action recibiendo UUID y aceptar que `revalidatePath('/property/<uuid>/schedule')` revalide el path original; el redirect lo resuelve a slug en el siguiente request. Trade-off menor: una revalidación se pierde la primera vez que un user comparte un link con UUID.                                     |
| `src/lib/visits/actions.ts`                          | 170   | íd.                                                                                    | íd.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/properties/actions.ts`                      | 80    | `revalidatePath(`/property/${propertyId}`);`                                           | **Crítico**: estas actions internas ya conocen el UUID en el server. Para hacer revalidación correcta del path real, hay que **leer también el slug** y revalidar `/property/<slug>`. Edit el call: traer `slug` del select y revalidar ambos por defensa: `revalidatePath('/property/' + uuid); revalidatePath('/property/' + slug);`. (El path UUID ya no existe como page, pero Next ignora silenciosamente la revalidación de un path sin matcher, así que no rompe.) **Patrón a aplicar**: helper interno `revalidatePropertyPaths(supabase, propertyId)` que hace la traducción una vez. |
| `src/lib/properties/actions.ts`                      | 95    | íd.                                                                                    | Usar `revalidatePropertyPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/properties/actions.ts`                      | 265   | íd.                                                                                    | Usar `revalidatePropertyPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/properties/actions.ts`                      | 589   | íd.                                                                                    | Usar `revalidatePropertyPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/properties/actions.ts`                      | 965   | íd.                                                                                    | Usar `revalidatePropertyPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/properties/actions.ts`                      | 1059  | íd.                                                                                    | Usar `revalidatePropertyPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/lib/notifications/derive.ts`                    | 41    | `return row.property_id ? `/property/${row.property_id}` : null;`                      | Ver §6 (decisión: redirect 308 maneja esto sin cambiar el derive — los notif payloads siguen con UUID).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Detalle de tipos a tocar: `PropertyCardData` en `src/lib/properties/types.ts`
(o donde viva), `PropertyForDetail`, `PropertyForManagement` deben incluir
`slug: string`. El select de cada query debe agregar `, slug` explícito.
La regeneración de tipos via MCP `generate_typescript_types` después de
la migración pondrá `slug` en `Database['public']['Tables']['properties']`,
pero los tipos derivados (proyecciones manuales) hay que ampliarlos a
mano.

### 4.2 Cambio en `getPropertyDetail` y `getPropertyForEdit`

Hoy reciben `id: string`. Tras la migración la firma cambia para aceptar
**lookup polimórfico**:

```ts
// src/lib/properties/queries.ts
export type PropertyLookup = { id: string } | { slug: string };

export async function getPropertyDetail(
  supabase: SupabaseDb,
  lookup: PropertyLookup,
  opts: { isAuthenticated: boolean } = { isAuthenticated: false },
): Promise<PropertyForDetail | null> {
  const select = ...;
  let query = supabase.from('properties').select(select);
  query = 'slug' in lookup ? query.eq('slug', lookup.slug) : query.eq('id', lookup.id);
  const { data, error } = await query.maybeSingle();
  // resto igual
}
```

**Razón**: el page público busca por `slug`; el handler de redirect UUID
busca por `id` para resolver el slug; las Server Actions (que reciben
UUID en su input ya validado) buscan por `id`. Unificar evita duplicar
la query.

`getPropertyForEdit` (línea ~608) se mantiene con `id: string` —
el dashboard sigue trabajando con UUIDs internos y no se beneficia de
slug.

---

## 5. PropertyForm — slug read-only en modo edit

### 5.1 Create

**Sin cambios.** El form no muestra el slug. El user no lo elige. La DB
lo autogenera vía trigger.

### 5.2 Edit

Agregar un campo **read-only** que muestre el slug actual de la
property, debajo del campo `title` dentro de `BasicInfoSection.tsx` (o
al final de la sección — ver D5 abajo).

**Decisión D5 — ubicación del slug read-only**: **debajo del campo
`title`**, dentro de `BasicInfoSection`. Razón:

1. Asociación semántica: el slug se deriva del title; verlo al lado
   refuerza el modelo mental "esto se generó de aquello".
2. Evita una card extra que infle el form en mobile.
3. Patrón ya usado en el repo (helper text inline debajo del input es
   recurrente — `helperText` prop de `Input` en `src/components/ui/Input.tsx`).

**Estructura JSX propuesta** (dentro de `BasicInfoSection`, después del
input `title`):

```tsx
{
  mode === 'edit' && initial?.slug ? (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted" htmlFor="property-slug-display">
        URL pública
      </label>
      <div
        id="property-slug-display"
        className="flex items-center gap-2 rounded-md border border-divider-soft bg-surface-soft px-3 py-2 text-sm text-on-surface"
      >
        <Icon name="link" size="xs" className="shrink-0 text-muted" />
        <code className="truncate font-mono text-xs">/property/{initial.slug}</code>
      </div>
      <p className="text-xs text-muted">
        La URL no cambia aunque edites el título. Generada al crear la propiedad.
      </p>
    </div>
  ) : null;
}
```

Notas:

- **NO es `<input readonly>`**: usar input forzaría a participar en el
  form/Zod schema, lo que viola la decisión #7. Es una "display card".
- **Zod schema NO se toca** (`form-schemas.ts`). El slug no es un campo
  de form: es metadata.
- `PropertyForm` debe pasar `mode` y `initial` a `BasicInfoSection` (ya
  recibe `values`/`errors`/`onChange`; sumar `mode` + `initialSlug` opcional
  o pasar `initial` entero). **Mejor**: nueva prop opcional
  `initialSlug?: string | null` en `BasicInfoSectionProps` para no
  acoplar el subcomponente al tipo `PropertyForEdit`.
- Copy en español ya escrito arriba. "URL pública" es el label más
  reconocible (no "slug", el user no entiende).
- Cero hex literales. `text-muted`, `border-divider-soft`, `bg-surface-soft`,
  `text-on-surface` — todos tokens ya en `globals.css`.

### 5.3 Cambio adicional: incluir `slug` en `PropertyForEdit`

`getPropertyForEdit` debe agregar `slug` a su SELECT y al tipo
`PropertyForEdit` (línea ~537 de `queries.ts`). Una línea cada uno.

---

## 6. Notification payloads — qué cambia y qué NO

**Decisión: NO agregar columna `property_slug` a `notifications`.** Los
payloads de notif siguen referenciando `property_id` UUID. Razones:

1. **Costo de la desnormalización**: agregar `property_slug` a la tabla
   `notifications` requiere migración + trigger de generación + backfill
   - considerar reactividad cuando se edite (aunque dijimos que slug es
     inmutable, hoy el productor del notif aún sería responsable de
     poblarlo). 4-5 puntos de complejidad.
2. **Beneficio real**: cero. El dropdown ya hace `await` del derive helper
   al renderizar. Resolver UUID→slug ahí es 1 query extra (`select slug
from properties where id in (...)`) que se puede batchear para los 10
   items del panel — sub-10ms.
3. **El redirect 308 ya cubre el caso**: `derive.ts:41` hoy devuelve
   `/property/${row.property_id}` (UUID). Cuando el user clickea, Next
   sirve el page con UUID, el page hace `permanentRedirect` a slug. El
   user ve una redirección instantánea (sub-50ms en cliente). **Cero
   cambios en notif para que funcione.**

**Plan futuro (no en este PR)**: si se observa lag perceptible o se
quiere optimizar, agregar campo `link` text a `notifications` que se
popula en el trigger con la URL final. Pero **NO ahora** — overkill.

**Cambio mínimo en `derive.ts`**: comentario actualizado para reflejar
que el path resultante puede ser un UUID y que el browser resuelve el
308 transparentemente. Cero cambio funcional:

```ts
// new_property | price_drop | favorite_update:
// row.property_id es UUID — el page /property/[slug] detecta UUIDs y
// hace permanentRedirect 308 al slug real. Cliente sigue navegando
// como antes.
return row.property_id ? `/property/${row.property_id}` : null;
```

---

## 7. Tipos TypeScript

Tras `apply_migration` (lo hace el leader), regenerar con MCP:

```
mcp__supabase__generate_typescript_types  →  src/types/database.ts
```

Después de regenerar, `Database['public']['Tables']['properties']['Row']`
incluye `slug: string`. Pero los tipos derivados manuales hay que
ampliar:

- `PropertyForDetail` (en `queries.ts`) — agregar `slug: string`.
- `PropertyForEdit` (en `queries.ts:537`) — agregar `slug: string`.
- `PropertyCardData` (verificar dónde vive — `src/lib/properties/types.ts`
  o similar) — agregar `slug: string`.
- `PropertyForManagement` (si existe en dashboard) — agregar `slug: string`.

Cada uno requiere también ampliar el SELECT correspondiente para que
Supabase devuelva la columna.

---

## 8. Riesgos identificados

| #   | Riesgo                                                                                                                                     | Severidad | Mitigación                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Colisión de suffix4**: dos properties con idéntico `title + city` normalizado Y mismos 4 primeros hex chars del UUID. ≈1/65k por pareja. | Bajo      | Improbable con dataset MVP (<200 properties). Si pasa en el backfill, el `CREATE UNIQUE INDEX` falla y la migración se aborta limpia. El leader regenera manualmente el slug del ofensor (sufijar `-bis` o usar 5 chars). En producción futura: si el catálogo crece, evaluar suffix8 en una migración nueva, o lookup-then-retry en el trigger. Documentado para no sorprender al leader.         |
| R2  | **Backfill con title/city raros** (vacíos, solo emojis, idiomas no-latinos).                                                               | Bajo      | La función tiene fallback `'property'` si la normalización produce string vacío. Con dataset actual (50 properties seed, todas con titles latinos), riesgo cero. Validar manualmente post-backfill con `select id, title, city, slug from properties order by length(slug)` — slugs anormalmente cortos delatan inputs raros. Reviewer revisa este query como parte de su pase.                    |
| R3  | **URLs cacheadas externas que dejan de funcionar.**                                                                                        | Mitigado  | El redirect 308 las cubre. Los crawlers (Google, etc.) verán el 308 y actualizarán su índice en el próximo crawl. Documentar en R3 que el 308 debe sobrevivir al menos 6 meses para garantizar reindex.                                                                                                                                                                                            |
| R4  | **Advisor de seguridad** marca `function_search_path_mutable` o similar tras la migración.                                                 | Bajo      | El `set search_path = public, extensions` está explícito en `generate_property_slug` y `set search_path = public` en el trigger helper. Validar post-`apply_migration` con `get_advisors`. Si surge ERROR (no WARN), bloquea el merge y se emite migración 0029 correctiva.                                                                                                                        |
| R5  | **Tests E2E rotos por las URLs UUID hardcoded.**                                                                                           | N/A       | No hay tests E2E en el repo hoy. Cero riesgo.                                                                                                                                                                                                                                                                                                                                                      |
| R6  | **Action `revalidatePath` con UUID legacy** (`actions.ts`).                                                                                | UX bajo   | Hoy las actions usan `revalidatePath(`/property/${uuid}`)`. Tras la migración el path real es `/property/${slug}`. Solución plana: leer slug + revalidar ambos. Sin esto, el page no se invalida tras un edit y el user ve datos viejos por un render. Implementer DEBE aplicar `revalidatePropertyPaths` helper. Es el bug más fácil de pasar por alto.                                           |
| R7  | **Estado intermedio: migración aplicada pero código no deployeado.**                                                                       | Op        | La columna `slug` existe en DB pero los pages siguen llamando `eq('id', ...)`. **Esto NO rompe nada** — la columna nueva no interfiere con queries existentes. Inversamente, si el código se deployea ANTES de aplicar la migración, los pages `[slug]` crashean con "column slug does not exist". **Orden obligatorio**: migración primero, deploy después. Documentado en §10 plan de ejecución. |
| R8  | **Helpers RPC accidentales**: si `generate_property_slug` quedara invocable como RPC por anon, un atacante podría hacer hashing libre.     | Muy bajo  | No otorgamos EXECUTE a `anon` ni `authenticated`. Default de PG es revoke a public para funciones en schema `public` declaradas SECURITY INVOKER. Verificar con `get_advisors`.                                                                                                                                                                                                                    |
| R9  | **Conflicto con `[id]` legacy en imports/tipos**: algún archivo declara tipo `{ id: string }` esperando UUID en URL params.                | Bajo      | El rename del directorio fuerza el cambio del tipo de params (Next valida en build). El reviewer verifica que `pnpm type-check` pase.                                                                                                                                                                                                                                                              |
| R10 | **Re-ordenamiento del file router cuando `[slug]` y `[id]` coexisten**: si el rename queda incompleto.                                     | Bajo      | El plan §10 elimina el directorio `[id]` en el mismo PR. Si el implementer deja `[id]` huérfano por error, el reviewer lo cacha en lint/build.                                                                                                                                                                                                                                                     |

---

## 9. Smoke tests (para `progress/smoke-tests.md`)

El leader debe agregar al archivo central tras el merge:

### `property_pretty_urls` (cerrada YYYY-MM-DD)

- [ ] Como anon: navegar a una URL UUID legacy
      (`/property/<uuid-de-una-active>`) → URL del browser cambia a
      `/property/<slug>` con 308 (verificar en devtools Network).
      Detalle se renderiza normal.
- [ ] Como anon: navegar directo a `/property/<slug>` → 200, sin
      redirect (verificar en devtools).
- [ ] Como anon: navegar a `/property/<slug-de-archivada>` → 404
      (la RLS `for select to anon where listing_status = 'active'` la
      filtra). Verificar con un slug obtenido directo de DB de una
      property archivada.
- [ ] Como agent: editar una property propia → la sección "URL pública"
      del form muestra el slug actual read-only. Cambiar el title +
      Guardar → la URL pública mostrada NO cambia (slug inmutable).
      Volver al dashboard, click en el title → URL navegada usa el slug.
- [ ] Como agent: crear property nueva → el form NO muestra "URL
      pública". Tras guardar como `published`, abrir desde el dashboard
      → la URL del browser tiene formato esperado
      `casa-...-ciudad-<4hex>`.
- [ ] Como user con notif pendiente que referencia property (p. ej.
      `new_property`): abrir dropdown, click → navega primero al UUID,
      luego 308 al slug. Verificar en Network tab que se ve el 308 (no
      es solo un client-side redirect).
- [ ] Como agent: agendar visita a property A → al recibir notif de
      tipo `visit_confirmed` (otro user), click → navegación final
      termina en `/property/<slug>`.
- [ ] `/property/<slug>/schedule` carga 200 para user no-owner; para
      owner redirige a dashboard. Mismo comportamiento que hoy con UUID.
- [ ] Revisar `progress/smoke-tests.md`: ningún test viejo asume UUID
      en path (los pasos antiguos están escritos genéricos
      "navegar a property", no fijan URL — bajo riesgo).

---

## 10. Plan de ejecución para el implementer

Orden recomendado, en commits separados si es posible (para revert
fácil si algo falla):

1. **Leader aplica la migración 0028 vía MCP** y regenera
   `src/types/database.ts`. El implementer NO procede hasta confirmación.
2. **Implementer crea `src/lib/properties/urls.ts`** con
   `getPropertyUrl` y `getPropertyScheduleUrl`. Es un archivo nuevo,
   sin imports rotos, type-check pasa solo. Commit 1.
3. **Amplía tipos derivados** (`PropertyForDetail`, `PropertyForEdit`,
   `PropertyCardData`, `PropertyForManagement`) con `slug: string` y
   añade `slug` al SELECT correspondiente en `queries.ts`. Type-check
   debe pasar — los call sites todavía usan `.id` (no rompe). Commit 2.
4. **Amplía `getPropertyDetail`** a aceptar `PropertyLookup = { id } |
{ slug }`. Los call sites actuales (que pasan `id` raw) se adaptan
   o se actualizan en el siguiente paso. Commit 3 (puede unirse al 2).
5. **Rename del directorio**: `src/app/(app)/property/[id]/` →
   `[slug]/`. Actualiza ambos `page.tsx` con el nuevo param + lookup
   por slug + detección UUID + `permanentRedirect`. Commit 4. **Aquí el
   build empieza a fallar si quedan call sites con `property.id`** —
   ese es el guard.
6. **Migra todos los call sites** de §4.1 a `getPropertyUrl` /
   `getPropertyScheduleUrl`. Renombra props
   `propertyId`→`propertySlug` donde corresponde (AgentBadge,
   VisitScheduler). En `PropertyCard:313` aprovechar el cambio para
   pasar a `getPropertyScheduleUrl(property)` (fixea el bug del segmento
   `/visit` → `/schedule` dentro del mismo PR — decisión humana
   2026-05-27, ver §4.1). Commit 5.
7. **Helper `revalidatePropertyPaths(supabase, propertyId)`** en
   `src/lib/properties/actions.ts` (interno, sin export). Reemplaza
   las 6 ocurrencias de `revalidatePath(`/property/${...}`)` en
   `actions.ts` por una llamada al helper. El helper lee el slug y
   revalida ambos paths defensivamente. Commit 6.
8. **PropertyForm slug read-only** en modo edit (§5). Sumar prop
   opcional `initialSlug` a `BasicInfoSection`, pasarla desde
   `PropertyForm`. Commit 7.
9. **Actualizar comentarios JSDoc** (§3.4) — search & replace cosmético
   `/property/[id]` → `/property/[slug]`. Commit 8.
10. **`pnpm build` + `pnpm type-check` + `pnpm lint`**. Hooks de
    `.claude/settings.json` ya lo corren tras cada Edit/Write. El
    reviewer hace pase final.
11. **Reviewer marca aprobado**, leader cambia `feature_list.json`
    status → `done`, agrega smoke tests §9 a `progress/smoke-tests.md`,
    y mergea.

**Tiempo mínimo en estado inconsistente**: el commit 5 (rename de
directorio + adaptación de los 2 pages) es el más crítico — entre el
inicio y el fin de ese commit el build está roto. Mantenerlo atómico
(no commit intermedio dentro). Los demás commits son aditivos o
cosméticos.

---

## 11. Criterios de aceptación verificables (para reviewer humano)

- [ ] Migración `0028_properties_slug.sql` existe, aplicada en remoto,
      `get_advisors` sin ERRORs nuevos.
- [ ] Columna `properties.slug` es `text not null` con índice único
      total (verificar con `\d+ properties` en psql o equivalente MCP).
- [ ] `select slug from properties` no devuelve duplicados ni NULLs.
- [ ] `src/app/(app)/property/[slug]/page.tsx` existe; `[id]/` no.
- [ ] `src/app/(app)/property/[slug]/schedule/page.tsx` existe.
- [ ] `src/lib/properties/urls.ts` existe y se usa en TODOS los call
      sites listados en §4.1 (grep `'/property/${' src/` solo
      devuelve resultados dentro del propio helper o el route handler
      de redirect — cero hardcodes ad-hoc).
- [ ] `PropertyForm` en modo edit muestra "URL pública" read-only;
      en modo create NO muestra nada relacionado a slug.
- [ ] `src/types/database.ts` incluye `slug: string` en `properties.Row`.
- [ ] `pnpm build`, `pnpm lint`, `pnpm type-check` verde.
- [ ] Smoke tests §9 marcados por el humano (al menos los 4 primeros
      del bloque deben ejecutarse ANTES del merge — el resto puede
      quedar pendiente como deuda controlada).

---

## 12. Alternativas consideradas

> Bloque obligatorio por `requires_approval: true`.

### Alt-A — Slug regenerado en cada UPDATE de title

**Descripción**: el trigger se dispara también en `BEFORE UPDATE` cuando
`OLD.title IS DISTINCT FROM NEW.title`. El slug se actualiza y la URL
del browser pasa a reflejar el title nuevo.

**Pros**: URLs siempre coherentes con el contenido.
**Contras**: rompe favoritos cacheados, links compartidos en redes,
emails, notificaciones existentes. Requiere mantener una tabla
`property_slug_history` para 308-redirigir los slugs viejos. 3x el
trabajo, complica el modelo mental.

**Rechazada** (decisión humana cerrada antes del spec): slug inmutable
gana por simplicidad y estabilidad de links.

### Alt-B — Slug sin suffix4, con lookup-then-retry para unicidad

**Descripción**: `slug = title-city`. Si ya existe, sufijar `-2`, `-3`...
hasta encontrar libre. Función en trigger hace `loop ... exit when not
exists ...`.

**Pros**: slugs más limpios para el caso común (95% sin sufijo numérico).
**Contras**: pre-insert lookup obligatorio (latencia + posible contención
en alta concurrencia). El sufijo `-2` no aporta información, solo
desempata. Y si dos properties con mismo title+city son del mismo agent,
se vuelven confusas (`casa-luxe-polanco`, `casa-luxe-polanco-2` — ¿cuál
es cuál?).

**Rechazada**: suffix4 hex es invisible visualmente (4 chars al final, los
users no los leen) y NO requiere pre-lookup. Mejor compromiso.

### Alt-C — Slug por concat `title-id-completo`

**Descripción**: `slug = title-<uuid-completo>`. Ej. `casa-luxe-polanco-8f3c...-12caracteres`.

**Pros**: cero colisiones, sin función especial.
**Contras**: URL larga, ilegible. Anula el propósito del rediseño (UX/SEO).

**Rechazada**: contradice el objetivo de la feature.

**Recomendación final**: la decisión ya cerrada (title + city + suffix4)
es el sweet spot. **Aprobar el spec.**
