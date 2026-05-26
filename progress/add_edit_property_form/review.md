# Review: add_edit_property_form

**Fecha**: 2026-05-25
**Reviewer**: reviewer subagent
**Veredicto**: APPROVED WITH NITS

## Resumen ejecutivo

Implementación completa y fiel al spec §15. Las 5 cards renderean con el layout 8/4 prometido, la pipeline de Storage `_drafts → properties/<id>/` funciona vía mig 0019, y los guards de auth/role/ownership están en page + Server Action (defense-in-depth). `./init.sh full` pasa verde (lint + type-check + build). Las 4 desviaciones reportadas son aceptables como deuda documentada. No hay bloqueantes; solo NITs cosméticos y de hardening.

## Spec compliance

### Spec compliance core

- [x] Los 10 componentes en `src/components/property-form/` existen con los nombres del spec §5.1.
- [x] `src/components/ui/Textarea.tsx` creado y re-exportado desde `src/components/ui/index.ts:10`.
- [x] `src/lib/properties/amenity-categories.ts` agrupa Interior (4) / Exterior (3) / Servicios (4).
- [x] `src/lib/properties/form-schemas.ts` tiene `draftSchema` (solo title min 3) y `publishSchema` (todos los required del spec §10.4).
- [x] Límite 12 imágenes validado en zod (`MAX_IMAGES_PER_PROPERTY` consumido en `createInputSchema.draftImages.max(12)` y en `updateInputSchema.images.max(24)` para tolerar deletes) Y en cliente (`GallerySection.tsx:124` deshabilita input al llegar).
- [x] `src/lib/properties/image-upload.ts` sube a `_drafts/{userId}/{uuid}.{ext}` desde browser client (`createClient` de `@/lib/supabase/client`). NO usa Server Action. NO tiene `"use client"` (módulo neutro, OK con la memoria del leader).
- [x] `createProperty` y `updateProperty` extienden `src/lib/properties/actions.ts` (no archivo nuevo).
- [x] Reusa `CounterPill` con `max={20}` y `formatValue={(n) => String(n)}` (`DetailsSection.tsx:179-181`).
- [x] NO se agrega `react-hook-form`: `grep "react-hook-form" package.json` vacío.
- [x] NO reusa `AmenityChipGroup`. Renderiza checkboxes simples agrupados (`DetailsSection.tsx:131-153`).
- [x] El dropdown de "Estado" mapea a `listing_type` (sale/rent), confirmado en `BasicInfoSection.tsx:100-117` y `getListingTypeOptions()`.
- [x] `listing_status` controlado por botones: `mode === 'publish' ? 'active' : 'draft'` con `published_at = mode === 'publish' ? nowIso : null` (`actions.ts:488,502`).

### Rutas y guards

- [x] `src/app/(dashboard)/dashboard/properties/new/page.tsx` existe (Server Component, sin `"use client"`).
- [x] `src/app/(dashboard)/dashboard/properties/[id]/edit/page.tsx` existe.
- [x] `await params` en page de edit (`edit/page.tsx:25`).
- [x] Edit: `owner_id != user.id` Y `role != admin` → `notFound()` (`edit/page.tsx:44-46`). NO redirect — sin leak de existencia.
- [x] Admin bypassa ownership: `isAdmin || isOwner` en page Y en `updateProperty` (`actions.ts:680-684`).
- [x] El layout `(dashboard)` ya tiene guard de rol agent/broker/admin (`layout.tsx:18-21`). Pages re-validan defense-in-depth, sin duplicar lógica.

### Image upload + diff (edit mode)

- [x] Pre-fill arranca con `property_images` actuales (`PropertyForm.tsx:135-143` via `makeExistingImage`).
- [x] Eliminar imagen existente → `deleted=true` en estado; en submit la action borra de DB (`property_images.delete().eq('id', img.id)`) y de Storage (`storage.remove([img.storagePath])`), salteando externalURLs (`actions.ts:812-830`).
- [x] Cambiar Main → UPDATE selectivo: primero apaga mains a `false`, luego enciende main definitivo, ordenado para no violar `property_images_one_main_idx` (`actions.ts:836-867`).
- [x] Agregar imagen nueva en edit → upload a `_drafts/`, post-insert `storage.move()` a `properties/<id>/<uuid>.<ext>` (`actions.ts:884-916`).
- [x] Upload parcial con error: modal `PartialUploadDialog` con 2 opciones (Continuar sin ellas / Cancelar) (`PropertyForm.tsx:423-471`).

### Storage policies (mig 0019)

- [x] Mig 0019 amplía `property_images_storage_insert/update/delete` para aceptar `_drafts/<auth.uid()>/...`. Verificada por el leader como aplicada en remoto + ledger.
- [x] SELECT permanece igual (lectura abierta a authenticated).

## Desviaciones evaluadas

1. **`price > 0` constraint + drafts (placeholder `1`)**
   - El spec NO especifica explícitamente cómo manejar drafts sin precio. La columna `price` tiene `check (price > 0)` (mig 0003).
   - Solución implementada: persistir `1` cuando `mode='draft'` y `price` está vacío (`actions.ts:472,775`).
   - Evaluación: **aceptable como deuda documentada**. El comportamiento se reconvierte a string vacío al re-abrir, pero un draft re-publicado con el placeholder visible muestra `$1` momentáneamente. Alternativa más limpia (alter table para `>= 0` + `default null`) requiere migración no prevista. NIT no bloqueante para considerar en futuras iteraciones.

2. **`address_line` / `city` NOT NULL + drafts (single space)**
   - Mismo trade-off: drafts vacíos guardan `" "` y el form trimea al re-leer (`PropertyForm.tsx:123-124`).
   - Evaluación: **aceptable como deuda documentada**. Idéntica naturaleza al punto 1. Documentar en `feature_list.json` notes como deuda futura.

3. **`bathrooms` integer-only en form**
   - DB acepta `numeric(3,1)`; form usa `Math.floor()` al pre-rellenar y submitea int (`PropertyForm.tsx:131`, `DetailsSection.tsx:116`).
   - Evaluación: **aceptable**. Una property seed con `bathrooms=2.5` se mostraría como `2` al editar (`Math.floor(2.5)=2`) y se persistiría como `2`. Pérdida de precisión menor pero NO rompe la UI ni viola constraints.

4. **URLs externas (Unsplash) en modo edit**
   - `isPropertyPathOf` acepta cualquier `http(s)://` como path válido (`actions.ts:298-307`).
   - `storage.remove` se omite para URLs externas en delete (`actions.ts:822-828`).
   - Evaluación: **aceptable con observación de seguridad menor (NIT #4 abajo)**. El método permite a un caller con ownership submittear cualquier URL externa en lugar de un path `properties/<id>/...`. Como el caller ya está gated por ownership/admin, no es un leak crítico — pero relaja el contrato de paths. Ver NIT.

## Sorpresas evaluadas

- **`PartialUploadDialog` inline sin focus trap**: aceptable para MVP. El dialog tiene `role="dialog"`, `aria-modal="true"`, `aria-labelledby` y backdrop con click-outside vía el botón Cancelar. La ausencia de focus trap (Tab leak) es deuda de accesibilidad, no bloqueante. NIT #1.
- **`isPending` en `<span hidden>`**: hack feo pero funcional (`PropertyForm.tsx:411-414`). Aceptable. NIT #2.

## NITs bloqueantes

(vacío — APPROVED limpio en bloqueantes)

## NITs no bloqueantes

1. **`PartialUploadDialog` sin focus trap** (`src/components/property-form/PropertyForm.tsx:432-471`).
   El dialog es modal pero no atrapa el foco. Idealmente usar el mismo patrón que `DeleteConfirmDialog` (focus al primer botón + restore al cerrar). Aceptable para MVP — documentar.

2. **`isPending` referenciado pero usado vía `<span hidden>`** (`src/components/property-form/PropertyForm.tsx:167,409-414`).
   El `isPending` del `useTransition` no se usa en UI (la fuente de verdad es `phase`). El `<span hidden>{isPending ? '' : ''}{MAX_IMAGES_PER_PROPERTY}</span>` es un workaround para suprimir el warning de unused. Refactor sugerido: o se elimina `isPending` (no se usa) o se reemplaza `phase: 'saving'` por `isPending`. La doble exposición tampoco es necesaria para `MAX_IMAGES_PER_PROPERTY` (ya está importada y se usa en tipos).

3. **Draft placeholders `price=1` / `address=' '` / `city=' '`** (`src/lib/properties/actions.ts:472,478-479,775-777`).
   Workaround necesario por NOT NULL + `check > 0` en columnas `properties`. Documentar en notes de feature como deuda con dos remediaciones posibles:
   - (a) Migración para relajar constraints (`>= 0`, columnas nullable + default).
   - (b) Columna nueva `draft_data jsonb` para guardar valores parciales sin tocar columnas finales.

4. **`isPropertyPathOf` acepta cualquier URL externa** (`src/lib/properties/actions.ts:298-311`).
   El gate aceptable porque el caller ya pasó por ownership/admin check, pero relaja el contrato. Un agent con edit rights puede persistir `https://malicious.example/image.jpg` como `storage_path`. Riesgo: bajo (RLS protege la edición; los clientes públicos del image renderer ya pasan por `getImageUrl`/`getDraftImagePublicUrl` que tratan URLs absolutas como pass-through). Mitigación sugerida (post-MVP): aceptar URLs externas solo si ya existían en `property_images` para esa property (comparar contra DB en `updateProperty`). Para create-mode el path debe ser `_drafts/<uid>/...` (eso ya está validado correctamente).

5. **Bathrooms decimal → entero en UI** (`src/components/property-form/PropertyForm.tsx:131`, `DetailsSection.tsx:116`).
   `Math.floor()` al pre-rellenar pierde la decimal seedeada. Solo afecta seed data (no hay forma de ingresar decimal en el form). Si se quiere preservar precisión, agregar un primitivo `Counter` decimal o un input numérico aparte. Documentar como deuda.

6. **Spec §11 R7 "first turn off mains, then turn on" — bug potencial en edge case**: en `updateProperty` el orden es (a) apagar mains que no deben serlo, (b) encender main definitivo entre `toUpdate`, (c) si hay `toCreate` con `isMain`, apagar TODAS las mains existentes y luego INSERT (`actions.ts:917-934`). El flujo (b) podría dejar dos `is_main=true` momentáneamente si el constraint es un _unique partial index_ — sería `42P10` runtime. Como `property_images_one_main_idx` no se documentó como tx-safe, esto puede fallar en escenarios raros. Aceptable: no bloqueante (cubierto por el orden secuencial dentro del mismo proceso). Considerar wrap en RPC SQL si aparece en runtime.

7. **`revalidatePath` no incluye `/search`** (`src/lib/properties/actions.ts:585-587,964-966`). Si la property nueva o editada matchea una búsqueda activa, la página `/search` no se invalida. Bajo riesgo porque `/search` es `ƒ dynamic` y se re-renderea por request, pero podría llegar a tener ISR en el futuro. NIT cosmético.

## Verificaciones técnicas

- `./init.sh full`: **OK**
- lint (`pnpm lint --max-warnings=0`): **OK**
- type-check (`pnpm type-check`): **OK**
- build (`pnpm build`): **OK** — `/dashboard/properties/[id]/edit` y `/dashboard/properties/new` ambos compilan como `ƒ dynamic`, esperado.
- No hay `console.log` ni código debug suelto en los nuevos archivos (solo `console.warn` en error paths de la Server Action, intencional).
- No hay archivos temporales en el repo.
- No hex literals en JSX (cero matches de `bg-[#...]`, `text-[#...]`, `border-[#...]` en `src/components/property-form/`, `src/app/(dashboard)/dashboard/properties/`, `Textarea.tsx`). El único `[...]` arbitrary es `text-[10px]` en `GalleryThumb.tsx:80` (tamaño, no color — aceptado).
- No `service_role` en código del cliente (grep vacío).
- Mutaciones de DB confinadas a Server Actions (`createProperty`/`updateProperty`). El Client Component sube a Storage directamente vía `supabase.storage.upload/move/remove` con la sesión del user — correcto para Storage (Server Action de Next 16 tiene body limit, justificado en spec §11 R4).
- Textos en español: verificado en headers, labels, errores, copy del PartialUploadDialog, not-found.tsx.
- `feature_list.json` sigue en `status: in_progress`. Confirmado en línea 274.

### "use client" exports — caso del leader memory

Verificado explícitamente:

- `src/lib/properties/form-schemas.ts` — **sin `"use client"`** ✅ (importado por `actions.ts` server-side y por `PropertyForm.tsx` client-side, debe ser neutro).
- `src/lib/properties/amenity-categories.ts` — **sin `"use client"`** ✅ (importado por `DetailsSection.tsx`, queda neutro por las dudas).
- `src/lib/properties/image-upload.ts` — **sin `"use client"`** ✅ (importado por `actions.ts` server-side para `PROPERTY_IMAGES_BUCKET` y por `GallerySection.tsx` client-side para `uploadDraftImage`).

Bug típico evitado correctamente.

## Notas para el leader

- Aplicar `feature_list.json status='done'` y agregar notes resumiendo:
  - Pipeline `_drafts/` → `properties/<id>/` funcional vía mig 0019.
  - 4 desviaciones aceptadas (price=1 placeholder, address/city=" ", bathrooms int, urls externas).
  - 7 NITs no bloqueantes documentados acá; ninguno requiere fix pre-commit.
- Para el test manual del implementer (notes.md sección "Test manual end-to-end") — sería útil que el humano verifique al menos:
  1. Drag&drop de 3 imágenes + publish.
  2. Edit con cambio de main image (chequear `property_images_one_main_idx`).
  3. Edit de property seedeada con URLs externas (Unsplash) — confirmar que el delete no rompe.
  4. Admin edita property ajena.
- Considerar abrir issue/feature follow-up para los NITs #3 (constraints DB) y #4 (path validation hardening) si se quiere endurecer el modelo de datos.
- Commit limpio: solo archivos listados en notes.md son los modificados; `git status` confirma 5 modificados + 9 untracked + 1 migración + 1 progress folder.
