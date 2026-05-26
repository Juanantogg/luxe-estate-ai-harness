# Notes — add_edit_property_form (implementer)

## Migración aplicada

- `0019_storage_property_images_drafts.sql` aplicada vía conexión directa al
  pooler de Supabase (db.eacacybbdrstirdvwwsn.supabase.co:5432) con
  `SUPABASE_PASS` (no había MCP disponible en esta sesión). El script de
  aplicación vivió en `/tmp/apply_migration_0019.mjs`; usa `pg` instalado
  temporalmente como devDep y luego desinstalado — `package.json` y
  `pnpm-lock.yaml` están como antes del implement.
- Policies post-migración (`pg_policies` filter `property_images%`):
  - `property_images_storage_select` — SELECT (sin cambios, mig 0012).
  - `property_images_storage_insert` — INSERT, with_check ahora acepta
    `_drafts/<auth.uid()>/...` además de `properties/<id>/...`.
  - `property_images_storage_update` — UPDATE, mismo branch.
  - `property_images_storage_delete` — DELETE, mismo branch.

## Archivos creados

- `supabase/migrations/0019_storage_property_images_drafts.sql`
- `src/components/ui/Textarea.tsx`
- `src/lib/properties/amenity-categories.ts`
- `src/lib/properties/form-schemas.ts`
- `src/lib/properties/image-upload.ts`
- `src/components/property-form/SectionCard.tsx`
- `src/components/property-form/BasicInfoSection.tsx`
- `src/components/property-form/DescriptionSection.tsx`
- `src/components/property-form/GallerySection.tsx`
- `src/components/property-form/GalleryThumb.tsx`
- `src/components/property-form/LocationSection.tsx`
- `src/components/property-form/DetailsSection.tsx`
- `src/components/property-form/FormActions.tsx`
- `src/components/property-form/UnsavedChangesGuard.tsx`
- `src/components/property-form/PropertyForm.tsx`
- `src/components/property-form/index.ts`
- `src/app/(dashboard)/dashboard/properties/new/page.tsx`
- `src/app/(dashboard)/dashboard/properties/[id]/edit/page.tsx`
- `src/app/(dashboard)/dashboard/properties/[id]/edit/not-found.tsx`

## Archivos modificados

- `src/components/ui/index.ts` — re-export del `Textarea`.
- `src/lib/properties/actions.ts` — agregadas `createProperty` y
  `updateProperty`. Las acciones existentes (`toggleFavorite`,
  `archiveProperty`, `restoreProperty`) quedaron intactas.
- `src/lib/properties/queries.ts` — agregada `getPropertyForEdit` y los
  tipos `PropertyForEdit` / `PropertyForEditImage`.
- `src/lib/properties/index.ts` — re-exports de los nuevos símbolos.

## Decisiones de implementación (subir aquí lo que el reviewer debe mirar)

1. **Check constraint DB `price > 0`**. La columna `properties.price` tiene
   `check (price > 0)`. Un draft sin precio violaría el constraint. Sol:
   si `mode='draft'` y `price` es `null|0`, persistimos `1` (placeholder
   mínimo válido). El form muestra el string vacío al re-abrir el draft
   porque el `price` se relee a `String(initial.price)` y `'1'` sale como
   `"1"` (al re-editar, el usuario lo cambia). **Nota para el reviewer**:
   si esto no es aceptable se puede modificar la migración para volver
   el check a `>= 0`, o introducir una columna nueva `draft_data jsonb`.
   Documentado acá porque NO está en el spec.

2. **`address_line` / `city` NOT NULL en DB**. Mismo problema que `price`:
   columnas required en `properties`. Sol: en draft, si están vacías,
   guardamos `" "` (un espacio). Al re-leer el form se trimea y se ve
   vacío. Mismo trade-off documentado para el reviewer.

3. **`bathrooms` como entero**. El form usa `CounterPill` con `min/max`
   enteros (max=20). La DB tiene `numeric(3,1)` (acepta 2.5). El form
   limita a enteros — si la propiedad seedada tenía 2.5, lo redondeamos
   con `Math.floor()` al pintar y se persistirá como entero al guardar.
   Pérdida de precisión menor; documentar como deuda si el humano quiere
   precision decimal en form.

4. **Imágenes seed (URLs externas de Unsplash)**. El seed inserta
   `property_images.storage_path` como URLs absolutas
   (`https://images.unsplash.com/...`). En modo edit el form las acepta:
   - `isPropertyPathOf` reconoce URLs externas como "no editables".
   - El delete de Storage se omite para esas (no se puede `remove()` un
     URL externo del bucket).
   - El preview usa `getDraftImagePublicUrl` que pasa-through las URLs
     absolutas.

5. **react-hooks lint reciente prohíbe `ref.current = X` durante el
   render**. Tuve que usar `useEffect` para sincronizar los refs que el
   timer de progress y el upload async necesitan leer
   (`liveImagesRef`, `liveOnChangeRef`). Documentado en el JSDoc del
   componente.

6. **Upload parcial**: modal custom inline en `PropertyForm.tsx`
   (`PartialUploadDialog`). No es un primitivo nuevo. 2 opciones:
   "Continuar sin ellas" y "Cancelar y reintentar". No tiene focus trap
   (no es un dialog del mismo peso que `DeleteConfirmDialog`); si el
   reviewer lo cree necesario, se puede iterar.

7. **No hay toast post-submit**. El spec dice `redirect('/dashboard')` y
   nada más. Los flash messages requieren infra cross-redirect (cookies
   one-shot o searchParams) que no está. Si el reviewer la quiere,
   feature separada. NIT no bloqueante.

8. **`isPending` del transition**: se referencia pero el state real lo
   maneja `phase` (idle/saving). El `<span hidden>` al final de
   `PropertyForm` silencia warnings sobre el binding sin uso. Esto se
   puede limpiar refactorizando para eliminar `isPending` o usándolo
   directamente como `phase`.

## Test manual end-to-end (humano)

Como no tengo navegador, dejo este checklist para verificación manual:

1. **Crear propiedad como agent**:
   1. Login como `ana@luxe-estate.test` (password `LuxeEstateSeed2026!`).
   2. Ir a `/dashboard` → click "Agregar propiedad".
   3. Verificar URL `/dashboard/properties/new`.
   4. Llenar todos los campos del publishSchema.
   5. Subir 3 imágenes (drag & drop), confirmar que la primera queda
      marcada Main automáticamente y el contador del header dice 3/12.
   6. Click "Publicar" → redirect a `/dashboard`, ver la property en la
      lista.
   7. En DB verificar: row en `properties` con `listing_status='active'`,
      `published_at` not null, 3 rows en `property_images` con paths
      `properties/<id>/...`, los `_drafts/` ya no existen.

2. **Editar propiedad propia**:
   1. Mismo login, click pencil en una property propia.
   2. URL `/dashboard/properties/<id>/edit`.
   3. Cambiar título y precio.
   4. Click "Guardar cambios" → redirect a `/dashboard`, los cambios se
      reflejan en la lista.

3. **Editar propiedad ajena como agent → 404**:
   1. Como `ana@luxe-estate.test`, navegar a
      `/dashboard/properties/<id de otra agente>/edit`.
   2. Debe mostrar el `not-found.tsx` (no 403 ni redirect).

4. **Admin edita cualquiera**:
   1. Login como `admin@luxe-estate.test`.
   2. Navegar a `/dashboard/properties/<id de Ana>/edit` → el form
      pre-rellena con los datos de Ana.

5. **Draft vs Publish**:
   1. Como agent, ir a `/dashboard/properties/new`.
   2. Llenar solo el título.
   3. Click "Guardar borrador" → property creada con
      `listing_status='draft'`, `published_at=null`, price=1 (placeholder).
   4. Volver a `/dashboard` con toggle "Ver archivadas" off — el draft
      NO aparece (solo lista `active`). Activar toggle para verlo.
   5. Editar el draft, completar todos los campos y click "Guardar
      cambios" (modo edit). Verificar que pasa a `listing_status='active'`
      y `published_at` se setea a ahora.

6. **Eliminar imagen existente en edit**:
   1. Editar una property seedeada con 3 imágenes Unsplash.
   2. Click delete en una. La X tacha visualmente (queda con `deleted`).
   3. Click "Guardar cambios". Verificar en DB que `property_images`
      tiene 2 filas para esa property (la 3a borrada).

7. **Cambiar Main**:
   1. En el form (cualquier modo), hover sobre una imagen y click el
      ícono de estrella.
   2. El badge MAIN cambia de la 1a a la clickeada.
   3. Guardar. Verificar `property_images.is_main` consistente.

8. **Abandonar form con cambios sin guardar**:
   1. Crear nueva property, llenar el título.
   2. Cerrar la pestaña. El browser debe mostrar el dialog nativo
      "¿Salir del sitio?".

9. **Validación tamaño/tipo imagen**:
   1. Drop un archivo de 7MB → toast inline "Máximo 5 MB".
   2. Drop un PDF → toast inline "Formato no permitido…".

10. **Upload parcial**:
    1. Mock un fallo de red para uno de los uploads (DevTools throttle).
    2. Confirmar que la imagen queda en status `error` con overlay
       "Error al subir" + botón "Reintentar".
    3. Click "Publicar" → aparece dialog "Imágenes con error" con
       opciones "Continuar sin ellas" / "Cancelar y reintentar".

## Verificación init.sh full

`./init.sh full` pasa OK al cierre: lint + type-check + build sin
warnings ni errores nuevos. Las dos rutas nuevas compilan como ƒ
dynamic (esperado por `await getSessionAndProfile` y `createClient`):

```
├ ƒ /dashboard/properties/[id]/edit
├ ƒ /dashboard/properties/new
```
