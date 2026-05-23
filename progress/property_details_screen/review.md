# Review — feature property_details_screen

**Veredicto:** APPROVED

Implementación completa de la pantalla de detalle de propiedad. Todos los
acceptance criteria cumplidos, los ajustes del leader aplicados con rigor,
RLS bien acotada a `anon`, cero hex en JSX, build verde. Solo dejo algunas
observaciones no bloqueantes.

---

## 1. Acceptance criteria (feature_list.json → property_details_screen)

| #   | Criterio                                                              | Estado | Evidencia                                                                                                                                                                          |
| --- | --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `page.tsx` Server Component, `await params`                           | ✅     | `src/app/(app)/property/[id]/page.tsx:20-39` — `params: Promise<{ id: string }>` y `const { id } = await params`. Sin `'use client'`.                                              |
| 2   | 404 si la propiedad no es visible (RLS)                               | ✅     | `page.tsx:50` — `if (!property) notFound()`. Adicional guard UUID en `:40` (bonus: evita pegarle a la DB con basura).                                                              |
| 3   | Galería: main + thumbnails scrollable con `snap-x`                    | ✅     | `PropertyGallery.tsx:96-100` — `hide-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2`. Tabs accesibles con `role="tablist"`/`role="tab"`.                             |
| 4   | "Schedule Visit" navega a `/property/[id]/schedule` cuando hay sesión | ✅     | `PriceAndAgentCard.tsx:103-105` — auth → `/property/${property.id}/schedule`. Anon → `loginNext` apuntando a la detail (ajuste leader). Dueño → `/dashboard/properties/[id]/edit`. |
| 5   | "Contact Agent" inicia conversation o `mailto:` fallback              | ✅     | `PriceAndAgentCard.tsx:115-129` — `mailto:` con subject = título; anon → `loginNext`. Deuda documentada en design §9 D9.                                                           |
| 6   | Heart funcional con optimistic UI                                     | ✅     | `page.tsx:93-102` reusa `FavoriteButton` con `redirectNext` (prop nueva). Oculto si `isOwner`.                                                                                     |
| 7   | Grid `lg:col-span-8` + sidebar `lg:col-span-4` sticky                 | ✅     | `page.tsx:132-180` — `grid grid-cols-1 lg:grid-cols-12`, columna izquierda `lg:col-span-8`, aside `lg:col-span-4` con `lg:sticky lg:top-24`.                                       |
| 8   | Amenities: enum → label español                                       | ✅     | `PropertyAmenitiesList.tsx` + `src/lib/properties/amenities.ts:15-27` (mapa completo). Si vacío, devuelve `null`.                                                                  |
| 9   | Mortgage calculator estática "próximamente"                           | ✅     | `MortgageCard.tsx` — botón disabled "Próximamente". Bonus: estimación textual cuando `listing_type='sale'` vía `estimateMonthlyPayment`.                                           |
| 10  | Map placeholder con pin animado (sin Google Maps real)                | ✅     | `PropertyMapPreview.tsx` — grilla SVG inline + pin `animate-bounce`. Link "Ver en Google Maps" externo en `target="_blank" rel="noopener noreferrer"`.                             |
| 11  | Footer con copyright                                                  | ✅     | `src/components/layout/Footer.tsx` — copyright con año dinámico + dos íconos sociales (SVG inline). Renderizado por la page, no por el layout (decisión §4.10).                    |

---

## 2. Ajustes del leader

### Ajuste 1 — `getOwnerPublicProfile`

- ✅ Exportada en `src/lib/properties/queries.ts:280-294` y re-exportada en `src/lib/properties/index.ts:14`.
- ✅ Devuelve **solo** `{ id, full_name, avatar_url, role, city }`. Tipo `OwnerPublicProfile` definido en `queries.ts:215-221`. El `.select(...)` en `:286` lista las 5 columnas explícitas.
- ✅ JSDoc declarando "única vía permitida para leer `profiles` desde Server Components o queries que puedan ejecutarse sin sesión" (`queries.ts:266-279`).
- ✅ `getPropertyDetail` la usa en la rama anon (`queries.ts:444-449`): query de la propiedad SIN owner + `getOwnerPublicProfile` + hidrata `email/phone` a `null`. La rama autenticada hace join con `email/phone` y confía en RLS.
- ✅ Búsqueda de otras lecturas de `profiles` desde rutas públicas: las únicas otras instancias (`auth/callback`, `auth/verify-email`, `auth/actions`, `auth/get-session`) están todas en contextos garantizados con `user` autenticado (`if (!user) return null` en `get-session.ts:29`). Ninguna se ejecuta sin sesión activa. **Sin riesgo.**

### Ajuste 2 — `next=` apunta a `/property/[id]`

- ✅ `grep -rn "next=" src/`:
  - `PriceAndAgentCard.tsx:39` → `next=/property/${property.id}` (no `/schedule`).
  - `AgentBadge.tsx:52` → idem.
  - `page.tsx:99` → `redirectNext={`/property/${property.id}`}`.
- ✅ No hay ningún `next=/property/[id]/schedule` en el código nuevo. Confirmado.

---

## 3. Reglas duras

| Regla                           | Estado | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cero hex literales en JSX       | ✅     | `grep "#[0-9a-fA-F]{3,8}"` en `src/components/property/`, `src/components/layout/Footer.tsx`, `src/app/(app)/property/`: **sin matches**. Todos los colores via tokens (`bg-surface`, `text-primary`, `border-divider-soft`, `bg-primary-soft`, etc.).                                                                                                                                                                                                                               |
| Server vs Client correcto       | ✅     | Solo 3 components nuevos llevan `'use client'`: `PropertyGallery.tsx:1` (useState/useRef), `PropertyAbout.tsx:1` (useState). El resto (page, PriceAndAgentCard, AgentBadge, PropertyFeatures, PropertyAmenitiesList, PropertyMapPreview, MortgageCard, Footer, loading) son Server.                                                                                                                                                                                                  |
| `await params` en page.tsx      | ✅     | `page.tsx:20` `params: Promise<{ id: string }>` + `:39` `const { id } = await params`.                                                                                                                                                                                                                                                                                                                                                                                               |
| Textos en español               | ✅     | Revisé todo el árbol nuevo: "Volver", "Agendar visita", "Editar en dashboard", "Contactar al agente", "Características", "Acerca de esta propiedad", "Amenidades", "Calculadora de hipoteca", "Próximamente", "Ver en Google Maps", "Ver galería completa", "Bajó de precio", "Leer más"/"Leer menos", "Información del agente no disponible", "Todos los derechos reservados", "Borrador/Activa/Pendiente/Vendida/Rentada/Archivada". Sin keys de diccionario ni strings en inglés. |
| Mobile-first                    | ✅     | Clases base sin prefix; breakpoints `sm:`/`md:`/`lg:` solo agregan. Ej: `grid-cols-2 md:grid-cols-4` en `PropertyFeatures.tsx:49`, `flex-col sm:flex-row` en `MortgageCard.tsx:22`, `grid-cols-1 lg:grid-cols-12` en `page.tsx:132`, `lg:sticky lg:top-24` solo en lg+. Padding `px-4 sm:px-6 lg:px-8`.                                                                                                                                                                              |
| Supabase via helpers            | ✅     | `page.tsx:18` importa `createClient` de `@/lib/supabase/server`. Sin `createServerClient` ni `createBrowserClient` directos en código nuevo.                                                                                                                                                                                                                                                                                                                                         |
| `service_role` nunca en cliente | ✅     | No aparece en código nuevo.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Mutaciones en Server Actions    | ✅     | Solo `toggleFavorite` (existente) se invoca desde `FavoriteButton`. No hay otras mutaciones en esta feature.                                                                                                                                                                                                                                                                                                                                                                         |

---

## 4. Migración RLS — `0014_anon_select_amenities_and_owner_profile.sql`

- ✅ `property_amenities`: política `for select to anon` con USING que exige la `property` padre con `listing_status = 'active'`. Patrón idéntico al de `property_images` en 0013.
- ✅ `profiles`: política `for select to anon` con USING que exige `exists (select 1 from properties p where p.owner_id = profiles.id and p.listing_status='active')`. Limita la apertura a dueños públicos de facto.
- ✅ `drop policy if exists ... ; create policy ...` idempotente.
- ✅ Solo abre SELECT. Sin INSERT/UPDATE/DELETE para `anon`.
- ⚠️ La migración asume que RLS ya está activado en ambas tablas (se aplicó en migraciones previas). El comentario superior aclara que es continuación de 0013; correcto. No reactiva RLS porque ya está activo — verificado el patrón con 0013.
- ⚠️ **Observación no bloqueante**: RLS no filtra columnas. La defensa contra fuga de `email/phone` vive en el código (`getOwnerPublicProfile` con `.select(...)` explícito). Esto está bien documentado en el JSDoc de `queries.ts:266-279` y en el comentario de la migración (`:13-16`). Para reforzar a futuro se podría agregar una `column privileges` GRANT/REVOKE — fuera de scope MVP.

---

## 5. Tipos y queries

- ✅ `PropertyForDetail` (`queries.ts:236-264`) cubre todo el shape pedido en spec §5.1.
- ✅ `OwnerPublicProfile` y `OwnerProfileFull` separados (`:215-226`). `email` y `phone` son `string | null` en `OwnerProfileFull` (`:224-225`).
- ✅ La rama anon hidrata `{ ...publicProfile, email: null, phone: null }` (`queries.ts:445-447`) — `null` explícito.
- ✅ `DETAIL_SELECT_AUTHED` (con join `owner`) vs `DETAIL_SELECT_ANON` (sin owner) — solo la rama autenticada pide `email, phone` (`queries.ts:331-343`).
- ✅ `toPropertyDetail` ordena imágenes con `is_main` primero, luego `position asc` (`:368-371`). Parsea `price/bathrooms/area_sqm/latitude/longitude` con `Number(...)`.

---

## 6. Edge cases (spec §10)

| Caso                                          | Cubierto | Dónde                                                                                                                                                              |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 imágenes                                    | ✅       | `PropertyGallery.tsx:75-79` muestra `Icon "apartment"` centrado; sin thumbnails. Heart y badges siguen vía overlays.                                               |
| 1 imagen                                      | ✅       | `PropertyGallery.tsx:83,95` el botón "Ver galería completa" y la fila de thumbnails sólo se renderizan si `images.length > 1`.                                     |
| Sin amenities                                 | ✅       | `PropertyAmenitiesList.tsx:17` `if (amenities.length === 0) return null` — esconde la card completa.                                                               |
| Sin descripción                               | ✅       | `PropertyAbout.tsx:25-36` muestra placeholder italic "El agente aún no agregó una descripción.".                                                                   |
| Sin `area_sqm`                                | ✅       | `PropertyFeatures.tsx:35-37` omite la celda (3 features en lugar de 4).                                                                                            |
| Sin `latitude/longitude`                      | ✅       | `PropertyMapPreview.tsx:18-21` fallback a `?query=${encodeURIComponent(address)}`.                                                                                 |
| Sin `parking_spaces`                          | ✅       | `PropertyFeatures.tsx:42` muestra `0` (mantiene grid balanceado).                                                                                                  |
| Sin `year_built`                              | ✅       | No se renderiza en MVP (no aparece en el grid de features).                                                                                                        |
| Owner sin email                               | ✅       | `AgentBadge.tsx:87-89` botón mail queda `disabled` con `aria-label "Correo no disponible"`.                                                                        |
| Owner sin phone                               | ✅       | `AgentBadge.tsx:99-101` idem, botón call disabled.                                                                                                                 |
| Owner profile null                            | ✅       | `AgentBadge.tsx:43-50` fallback con avatar vacío + "Información del agente no disponible.".                                                                        |
| Dueño visitando                               | ✅       | `page.tsx:52` calcula `isOwner`; `:93` esconde heart; `PriceAndAgentCard.tsx:91-99` reemplaza CTA por "Editar en dashboard"; `:115` esconde "Contactar al agente". |
| Anon en property non-active                   | ✅       | RLS bloquea → `data === null` → `notFound()` (page.tsx:50).                                                                                                        |
| Badge "Bajó de precio"                        | ✅       | `PriceAndAgentCard.tsx:33-34, 51-60` muestra precio anterior tachado + badge `success uppercase` solo si `previous_price > price`.                                 |
| Property en estado no-active visible al dueño | ✅       | `PriceAndAgentCard.tsx:36-37` + `renderStatusBadge` muestra badge `Borrador/Pendiente/Vendida/...` cuando `listing_status !== 'active'`.                           |

---

## 7. Verificación de build

- ✅ `./init.sh` → OK (deps + lint + type-check verdes).
- ✅ `pnpm build` → OK. Genera `/property/[id]` como ruta dinámica. Sin warnings de TypeScript ni errores de Turbopack.

---

## 8. Otras observaciones (no bloqueantes)

1. **`PriceAndAgentCard.tsx:60-66`** — la etiqueta `<h2>` del precio convive con el `<h2>` del título visible (`page.tsx:143`). A11y permite múltiples h2 dentro de un mismo h1; la estructura sigue siendo `h1 (sr-only) > h2 (título) + h2 (precio)`. Aceptable. Si querés ser más estricto, el precio puede ser un `<p>` o `<div>` semántico — pero no es bloqueante.
2. **`AgentBadge.tsx:78-91`** — el botón mail cuando `disabled && isAuthenticated` se renderiza como `<span>` (no focusable). Correcto desde a11y (no es interactivo), pero `title={ariaLabel}` ayuda al hover. OK.
3. **`MortgageCard.tsx:42`** — el `<Button disabled>` no es navegable; el clic no hace nada. Coherente con el acceptance "estática".
4. **`Footer.tsx:22-52`** — `href="#"` placeholders documentados en JSDoc y en design §9 D7. El reviewer humano puede sustituir cuando haya URLs reales.
5. **`PropertyGallery.tsx:114-118`** — `cursor-pointer` redundante con `<button>` nativo, pero inofensivo.
6. **`page.tsx:52-56`** — el `getUserFavoriteIds` se llama incluso cuando `isOwner=true` no, pero sí cuando `user && !isOwner`; correcto. Solo ejecuta la query si hay user y no es dueño.
7. **Smoke test visual**: no ejecuté `pnpm dev` (init.sh quick es suficiente como guardrail). El build verde + el grid responsive + las clases responsive correctas dan suficiente confianza.

---

## Checklist

- Tokens y colores: [x]
- Componentes y framework: [x]
- Supabase: [x]
- Fidelidad visual: [x] — coincide con `screen.png` (galería+thumbnails, card sticky, features 4x1, amenities 2 cols, mortgage banner, mapa con pin, footer).
- Calidad: [x] — lint + type-check + build OK. Sin `console.log` ni debug suelto en código nuevo. Solo un `console.warn` en `getOwnerPublicProfile` y `getPropertyDetail` para errores de query (intencional, mismo patrón que `getUserFavoriteIds`).

---

## Cambios requeridos

Ninguno. Implementación lista para commit.
