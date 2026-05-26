# Review — feature property_management_dashboard

**Veredicto:** APPROVED

## Checklist

- Tokens y colores: [x] — grep `'#[0-9a-fA-F]{3,8}'` sobre `src/components/dashboard`, `src/app/(dashboard)` y `src/lib/dashboard` devuelve 0 hits. Toda clase color usa tokens (`bg-primary`, `bg-primary-soft`, `text-on-surface`, `text-muted`, `bg-surface`, `bg-surface-soft`, `bg-warning-soft`, `text-warning`, `bg-danger-soft`, `text-danger`, `border-divider`, `border-divider-soft`, `bg-neutral-50/100/300`). Cero ad-hoc orange/gray del mockup HTML.
- Componentes y framework: [x] — `page.tsx`, `loading.tsx`, `error.tsx` viven en `src/app/(dashboard)/dashboard/` (forma correcta para servir `/dashboard` con route group `()`); spec actualizado coincide. Server Components por defecto: `DashboardStatCard`, `DashboardEmptyState`, `DashboardPagination`, `PropertyManagementRow`, `EditPropertyLink`, la `page.tsx`. `'use client'` solo en componentes con interactividad real (6 archivos: `ArchivedToggle`, `DashboardFilters`, `DeleteConfirmDialog`, `DeletePropertyButton`, `PendingVisitRow`, `RestorePropertyButton`). `await searchParams` correcto en `page.tsx`. Sin dependencias nuevas.
- Supabase: [x] — `createClient` solo desde `@/lib/supabase/server` en Server Actions; ningún Client Component instancia clientes. Mutaciones (`archiveProperty`, `restoreProperty`, `cancelVisit`) son Server Actions con `'use server'`, guards de owner/admin server-side y validación zod. La migración 0018 activa SECURITY DEFINER con `set search_path = public` (mismo patrón que mig 0017). RLS de `visits` (mig 0007) cubre el caso: `agent_id = auth.uid()` (= owner por trigger `validate_visit_agent`) puede actualizar. Sin `service_role` en código del cliente.
- Fidelidad visual: [x] — mockup `screen.png` revisado: header "Mis propiedades" + sublabel, 3 stat cards (Total/Activas/Pendientes con iconos `apartment`/`check_circle`/`pending` y tonos primary/success/warning), tabla con thumbnail 80×112 + título-link + dirección + meta beds/baths/sqm, columna Precio con sublabel "Renta mensual" para `rent`, badge derivado de `getStatusBadgeProps`, acciones Edit/Delete (o Restaurar si archivada). Footer paginación con "Mostrando X a Y de Z resultados" + Anterior/Siguiente. Mobile colapsa a cards stacked (`flex flex-col gap-3 p-4 md:hidden`). Normalización Haven → LuxeEstate cubierta por el `TopNav` del layout.
- Calidad: [x] — `./init.sh full` corrió y terminó verde (deps + lint + type-check + build). `/dashboard` aparece como `ƒ` dynamic en el build output. Sin `console.log/debug` (solo `console.warn` en error paths legítimos, mismo patrón que `scheduleVisit`). Sin `TODO/FIXME/XXX`. Textos en español. `feature_list.json` correctamente en `in_progress` (leader marca `done` post-review).

## Decisiones cerradas (R1–R7) — verificadas

- **R1 (Total incluye archivadas):** `getDashboardStats` query "total" no filtra por `listing_status`. ✓
- **R2 (orden `updated_at desc`):** `listManagementProperties` aplica `.order('updated_at', { ascending: false, nullsFirst: false }).order('id', ...)` (tie-break por id es nit positivo, evita orden no-determinístico). ✓
- **R3 (toggle archivadas + restaurar):** `ArchivedToggle` controla `?archived=1`. `RestorePropertyButton` aparece solo cuando `isArchived` y setea `listing_status='active'` con guards de owner/admin + check `not_archived`. ✓
- **R4 (título clickeable, archived/draft no):** `PropertyManagementRow.titleNode` usa `<Link target="_blank" rel="noopener noreferrer">` solo para `active|pending|sold|rented` (set `PUBLIC_STATUSES`); para `draft/archived` renderiza `<span title="No disponible públicamente">`. `aria-label` incluye "(se abre en otra pestaña)" e icono `open_in_new` con `aria-hidden="true"`. ✓
- **R5 (admin global):** `viewerMode = isAdmin ? 'admin' : 'agent'`; `scope = 'all'` para admin (no filtra por owner_id). Tabla agrega columna "Propietario" en md+ (col-span-2, avatar + nombre) y chip "por {owner_name}" en mobile. Stats globales. ✓
- **R7 (bloqueo por visits pendientes + cancelación individual):** flujo verificado en `DeletePropertyButton` → `getPendingVisitsForArchive` → `DeleteConfirmDialog` modo bloqueado/simple. `cancelVisit` con guards (admin/agent, status válido, no `past_visit`), trigger 0018 notifica al user afectado. Defense-in-depth en `archiveProperty` (paso 5) rechaza con `pending_visits` si el cliente se saltea el dialog. ✓

## Bloqueantes

Ninguno.

## NITs (no bloqueantes)

1. **`DeletePropertyButton` swallow del error de fetch en silencio.** Cuando `getPendingVisitsForArchive` falla, el componente captura `fetchError` (línea 47) pero nunca lo renderiza — pasa `pendingVisits=[]` al dialog y el agent termina en modo "simple" sin saber que la lectura falló. El dialog confía en que el server-side guard de `archiveProperty` atrape el caso, lo cual funciona, pero el feedback al usuario podría ser mejor (mostrar el `fetchError` como banner dentro del dialog). Spec §"Componentes > DeletePropertyButton" lo permite implícitamente; queda como deuda menor para mejorar UX de errores raros.
2. **N+1 mínimo en `archiveProperty/restoreProperty/cancelVisit`.** Cada action hace SELECT del profile (`role`) por separado al SELECT de property/visit, sumando 2 round-trips. Aceptable porque RLS es la última línea, pero podría consolidarse en una sola query con join o cachear el rol en la sesión. Mismo patrón ya vive en `scheduleVisit`, no es regresión específica de esta feature.
3. **`revalidatePath('/visits')` en `cancelVisit` no aplica.** La ruta `/visits` no existe (el dashboard del agent no la usa; el perfil del user vive en `/profile`). La línea es inocua pero limpiarla o documentar "ruta futura" evitaría confusión a futuro lectores. El equivalente útil ya está cubierto (`/profile`, `/dashboard`).
4. **`ArchivedToggle` usa `bg-neutral-300` directo.** Es token semántico válido y existe en `globals.css`, pero el "off state" de un switch suele mapearse a `border-outline` / `bg-divider-soft` para coherencia con otros toggles del proyecto. Si en el futuro se introduce un `Switch` primitivo, conviene migrar. Pequeña deuda visual.
5. **Spec actualizado de path coherente con realidad.** El path final `src/app/(dashboard)/dashboard/page.tsx` (con `loading.tsx` y `error.tsx` hermanos) está reflejado en el spec §"Datos > Page contract" y en el `dynamic.md` post-hoc — sin desviación. Confirmado: archivos existen, build muestra `ƒ /dashboard` como dynamic, no hay colisión con `(app)/page.tsx`.

## Verificaciones finales

- `./init.sh full` pasa (deps + lint + type-check + build). `/dashboard` listado como `ƒ` dynamic en el build output.
- Migración 0018 aplicada en remoto por el leader (advisor: 2 WARN nuevos análogos a 0017, trade-off conocido y documentado en `CLAUDE.md`). El archivo SQL coincide línea por línea con el bloque "Migraciones requeridas" del spec.
- `progress/property_management_dashboard/design.md` corregido (path `(dashboard)/dashboard/page.tsx`) coherente con el código.
- Limpieza: 0 console.log/debug, 0 TODO/FIXME, 0 archivos temporales en `progress/<feature>/` (solo `design.md` y este `review.md`).
