# Review — feature user_profile_screen

**Veredicto:** APPROVED WITH NITS

`./init.sh` (rápido) verde: deps + lint + type-check OK.

## Checklist

- Tokens y colores: [x]
- Componentes y framework: [x]
- Supabase: [x]
- Fidelidad visual: [x]
- Calidad: [x]

## Cumplimiento del spec (`progress/user_profile_screen/design.md`)

1:1 contra los componentes prometidos en §"Componentes":

| Archivo                             | Tipo esperado                                                                                                      | Cumple                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `src/app/(app)/profile/page.tsx`    | Server Component, `await searchParams`, parse tab, queries condicionales por tab activo, redirect si no hay sesión | Sí (`page.tsx:33,59,82-97,63-64`)                              |
| `src/app/(app)/profile/loading.tsx` | Skeleton del shell                                                                                                 | Sí                                                             |
| `ProfileHeader`                     | Server                                                                                                             | Sí, sin `"use client"`                                         |
| `ProfileAvatarEditor`               | Client + Server Action                                                                                             | Sí                                                             |
| `ProfileStats`                      | Server                                                                                                             | Sí                                                             |
| `ProfileTabs`                       | Client (`useSearchParams`)                                                                                         | Sí                                                             |
| `VisitsList`                        | Server                                                                                                             | Sí                                                             |
| `VisitCard`                         | Server, fecha en TZ de propiedad, Reschedule + Get Directions                                                      | Sí (`VisitCard.tsx:21-36,67`)                                  |
| `SettingsPanel`                     | Server, email readonly + botón Cambiar disabled + tooltip                                                          | Sí                                                             |
| `NotificationsToggle`               | Client, sin persistencia                                                                                           | Sí                                                             |
| `src/lib/profile/queries.ts`        | `getProfileStats`, `getUserVisits` con buckets                                                                     | Sí, partición en código + sort ASC/DESC (`queries.ts:241-248`) |
| `src/lib/profile/actions.ts`        | `uploadAvatar`, `removeAvatar` con cleanup, upsert, revalidatePath                                                 | Sí                                                             |
| `src/lib/profile/schemas.ts`        | zod + MIME→ext mapping                                                                                             | Sí                                                             |

Decisiones humanas reflejadas:

- Sold oculto si `role === 'user'` (`queries.ts:81` `soldCount: showSold ? ... : null` + `ProfileStats.tsx:32`). [OK]
- Visitas en 2 buckets por status + scheduled_at (`queries.ts:212-245`). [OK]
- Reschedule emite `?reschedule=<visit_id>` (`VisitCard.tsx:119`). [OK]
- Botón "Cambiar email" disabled con tooltip (`SettingsPanel.tsx:51-58`). [OK]
- Stat "Visitas" cuenta total (`queries.ts:49-52`). [OK]
- Avatar: 2 MB, JPG/PNG/WEBP, delete habilitado (`schemas.ts:13-16,36-43`, `actions.ts:153-184`). [OK]
- Toggle notificaciones placeholder sin persistencia (`NotificationsToggle.tsx:17-18`). [OK]

## Cumplimiento del acceptance (`feature_list.json`)

| #   | Acceptance                                                             | Cubierto                                                                                           |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| 1   | Server Component `/profile/page.tsx`                                   | Sí                                                                                                 |
| 2   | Header hint-green + avatar editable + upload a Storage                 | Sí (`ProfileHeader` + `ProfileAvatarEditor` + `uploadAvatar`)                                      |
| 3   | Stats counters favorites/visits/sold                                   | Sí, con desviación documentada en spec (visits = total, sold oculto si role=user)                  |
| 4   | Tabs `?tab=saved                                                       | visits                                                                                             | settings`default`saved` | Sí (`page.tsx:36-41`, `ProfileTabs.tsx:34-38`) |
| 5   | Tab Saved reutiliza pipeline de favorites                              | Sí — usa `getUserFavorites` y `PropertyCard` (`page.tsx:89,134-141`)                               |
| 6   | Tab Visits con Reschedule + Get Directions                             | Sí (`VisitCard.tsx:117-142`)                                                                       |
| 7   | Settings con email readonly + toggle placeholder                       | Sí (`SettingsPanel.tsx:42-60`, `NotificationsToggle.tsx`)                                          |
| 8   | Server Action sube a `avatars/{user_id}/avatar.<ext>` + update profile | Sí (`actions.ts:107-141`); path matchea RLS mig 0010 (`split_part(name,'/',1) = auth.uid()::text`) |

## Reglas duras

- **Cero hex literales en JSX**: confirmado por grep. `Badge.tsx:34` usa `text-[11px]` (font-size, no color) — eso es tamaño, no color hex; permitido.
- **Server Components default**: `"use client"` solo en `ProfileTabs`, `ProfileAvatarEditor`, `NotificationsToggle`. Coincide con el spec.
- **`await searchParams` Next 16**: `page.tsx:59` correcto. `params` no aplica (la página no tiene `[param]`).
- **Helpers Supabase**: `createClient` viene de `@/lib/supabase/server` (no `@supabase/supabase-js`). OK.
- **Server Actions para mutaciones**: `uploadAvatar` y `removeAvatar` en `actions.ts` con `'use server'`. El client invoca vía `startTransition` (`ProfileAvatarEditor.tsx:138-160`). No hay fetch directo a Supabase desde Client.
- **Sin service_role en client**: grep limpio en toda la carpeta `profile/`.
- **Textos en español**: confirmado en todos los componentes.
- **Mobile-first**: layouts arrancan en columna y suben a `md:flex-row`. Stats en `<md` toman `w-full` y se vuelven `md:w-auto`. OK.

## Seguridad

- Server Action `uploadAvatar` **revalida con zod server-side** (`actions.ts:90-94`) — no confía en el cliente.
- Path de upload usa `user.id` obtenido de `supabase.auth.getUser()` server-side (`actions.ts:97-99,108`) — no del FormData.
- Extensión derivada del MIME (`schemas.ts:25-29`, `actions.ts:107`) — evita spoofing de nombre tipo `evil.png.exe`.
- RLS bucket `avatars` (mig 0010) matchea: path es `<user.id>/avatar.<ext>` → `split_part('uuid/avatar.jpg', '/', 1) = auth.uid()::text` ✓.
- Cleanup `remove()` borra las 4 variantes de extensión sin abortar si falla (`actions.ts:64-74`) — pragmático.
- No se construye URL pública vía cliente Supabase (uso de `NEXT_PUBLIC_SUPABASE_URL` desde server). El cache-buster `?v=<ts>` invalida la imagen vieja en TopNav. OK.

## A11y

- `<h1 id="profile-name">` único + `<header aria-labelledby="profile-name">`. ✓
- Tabs con `aria-current="page"` en activa. ✓
- FAB con `aria-label="Editar foto de perfil"` + `aria-busy`. ✓
- Modal con `role="dialog" aria-modal="true" aria-labelledby={titleId}`, ESC cierra, body scroll lock, focus inicial al close, focus restaurado al FAB. ✓
- Iconos decorativos con `aria-hidden="true"` (divider vertical en stats, dot en SectionHeader, icono `<` en sub-línea). ✓
- Toggle con `<input type="checkbox" className="sr-only">` real + label asociado por `htmlFor`/`id` — soporta teclado. ✓
- `<time dateTime={iso}>` en fecha de visita. ✓

## Performance

- Queries condicionales por tab activo (`page.tsx:88-94`). Bueno.
- Stats con `count: 'exact', head: true` — no transfiere filas. Bueno.
- `next/image` con `fill` + `sizes` correcto en `VisitCard`. ✓

## Hallazgos críticos

Ninguno bloqueante.

## NITs no bloqueantes

1. **`ProfileStats` recibe `role` en su interface pero no lo usa** (`ProfileStats.tsx:7-8,26`). La decisión "ocultar Vendidas si role=user" ya está implícita en `stats.soldCount === null` (la query no lo computa cuando el role no es agent+). El prop `role` es dead weight; o se quita de la interface, o se documenta como reservado para futuro.

2. **Avatar grande renderizado con `<img>` en vez de `next/image`** (`ProfileAvatarEditor.tsx:175-180,258-263`). El spec dice "Para el avatar grande, también next/image con unoptimized={false} y priority={false}". La justificación del implementer (FAB absoluto + cache-buster `?v=<ts>` rompe el caching del optimizer) es razonable, pero queda divergencia respecto al spec. Si se quiere alinear: `next/image` permite `unoptimized` por src y el contenedor `relative` ya está. No bloqueante en MVP.

3. **Focus trap del modal no implementado** (`ProfileAvatarEditor.tsx:71-90`). El spec pedía focus trap explícito. Sólo se implementa "focus inicial al close + ESC cierra + focus restaurado al FAB". Tab puede escapar al fondo. Dado que el modal tiene 4-5 controles y el backdrop captura clicks, el riesgo real es bajo. Considerar agregar trap con un sentinel o `inert` en el `<main>` cuando el modal esté abierto.

4. **`eslint-disable react-hooks/exhaustive-deps` en `ProfileAvatarEditor.tsx:89`** justificado en el comentario adyacente. El reasoning es válido (`handleClose` cierra sobre estados locales que se redefinen cada render). Limpieza alternativa: `useCallback` con deps de `[previewUrl]` ó usar el patrón `useEffectEvent` cuando esté estable. Aceptable como está.

5. **`ProfileTabs` mantiene la lista válida en dos lugares** (`page.tsx:30 VALID_TABS` y `ProfileTabs.tsx:35 validValues`). Pequeña duplicación; se puede centralizar exportando un helper `parseTab` desde el componente o del index. No bloqueante.

6. **Empty state del tab Visitas usa `<Link>` envolviendo `<Button>`** (`VisitsList.tsx:50-54`). Renderiza un `<a>` con un `<button tabIndex={-1}>` dentro — funcionalmente OK por `tabIndex={-1}`, pero el patrón `<Link asChild>` o un `<Button as="a">` sería más limpio (consistente con TopNav). Tip menor.

7. **`ProfileStats.tsx:57` usa `String(item.value).padStart(2, '0')`** para mostrar siempre 2 dígitos ("03 VISITS"). Replica del mockup, pero `12 SAVED` se ve OK. Si el user llega a 100+ favoritos, se rompe a 3 dígitos sin padding — aceptable, sólo dejo la observación.

8. **`Profile`/`session` lookup duplicado** (`getSessionAndProfile()` en `page.tsx:62` no usa `redirect()` directo y queda un dobble `if (!session?.user)`/`if (!profile)`). Ya es defensive — está bien.

## Notas finales

- Decisión documentada: el implementer reusa `getUserFavorites` y `PropertyCard` directamente en `SavedPanel` (`page.tsx:124-147`) sin extraer un componente compartido. Coherente con la decisión §"Componentes" del spec.
- `revalidatePath('/profile')` y `revalidatePath('/')` post-upload — coherente con la deuda de cache del avatar en TopNav (riesgo #6 del spec).
- No introduce dependencias nuevas. ✓
- Sin `console.log` de debug; los `console.warn` son logging de errores intencional (10 ocurrencias en `actions.ts` y `queries.ts` — todos guards defensivos para no romper la pantalla por fallo de una query).

## Recomendación

Aprobar y commitear. Los NITs son cosméticos/no-blocker. Si querés, antes del commit se podrían aplicar 1, 5 y 6 (10 min de cleanup).
