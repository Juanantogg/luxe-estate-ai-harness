# Design spec — add_edit_property_form

> Status: `requires_approval = true`. Este spec pasa por aprobación
> humana antes de implementarse. Las decisiones cerradas y los riesgos
> están enumerados explícitamente para facilitar el review.

## 1. Resumen

Formulario único `PropertyForm` que sirve dos rutas dentro del dashboard
del agente/broker/admin: `/dashboard/properties/new` (modo create) y
`/dashboard/properties/[id]/edit` (modo edit). Cinco cards
(Basic Info, Description, Gallery, Location, Details + Amenities)
distribuidas en grilla 8/4 a partir de `xl`, columna única en móvil.
Dos botones de submit (`Save Draft` / `Save Property`) con validación
zod diferenciada. Las imágenes se suben a Storage desde el browser
client; la Server Action mueve los archivos de `_drafts/{userId}/` a
`properties/{propertyId}/` tras un insert exitoso.

## 2. Referencia visual

- Mockup: `docs/designs/add_edit_property_form/screen.png`
- HTML: `docs/designs/add_edit_property_form/code.html`
- Normalizaciones obligatorias (ya documentadas en
  `docs/design-system.md` §"Desviaciones documentadas"):
  - Tipografía **Inter** (no Newsreader del HTML).
  - Paleta **mosque / nordic** (no el `#4fb5a4` del HTML).
  - Marca "Estates." del nav → ya pintada por `TopNav` global.
  - Radius default `0.5rem` (no `0.25rem` del HTML).

## 3. Decisiones cerradas (humano, antes del spec)

1. **Upload + DB en dos fases.** Imágenes se suben primero a
   `property-images/_drafts/{userId}/{uuid}.{ext}` mientras el agente
   trabaja. Tras `INSERT` exitoso de `properties`, la Server Action
   mueve los archivos a `property-images/properties/{propertyId}/{uuid}.{ext}`
   (vía `supabase.storage.move`) y persiste los `storage_path`
   finales en `property_images`. Si el insert falla, las imágenes
   quedan huérfanas en `_drafts/` — aceptado para MVP, documentado en
   §11 Riesgos como deuda con cleanup futuro.
2. **Edit de imágenes por diff explícito.** El form arranca con
   `property_images` actuales cargadas como thumbnails con X para
   eliminar y radio/star para marcar Main. La Server Action computa
   INSERT/DELETE/UPDATE selectivo comparando `imagesInForm` vs
   `imagesInDb`. Las imágenes eliminadas se borran de Storage (`remove`).
3. **Validación draft vs publish.**
   - `draftSchema`: solo `title` requerido (min 3).
   - `publishSchema`: title (3-200), price > 0, listing_type,
     property_type, address_line + city requeridos, area > 0,
     year 1800-2100, beds ≥ 0, baths ≥ 0, descripción min 50 chars,
     ≥ 1 imagen, ≥ 1 imagen marcada `is_main`.
   - Botón **Save Draft** → `draftSchema` + `listing_status='draft'`.
   - Botón **Save Property** → `publishSchema` + `listing_status='active'`
     - `published_at=now()`.
4. **Amenities agrupadas por categoría en código.** El enum
   `amenity_key` no tiene columna de categoría; el mapping vive en
   `src/lib/properties/amenity-categories.ts`. Grupos:
   - **Interior**: `air_conditioning`, `smart_home`, `central_heating`,
     `wine_cellar`.
   - **Exterior**: `pool`, `garden`, `patio`.
   - **Servicios**: `gym`, `wifi`, `parking`, `ev_charging`.
     (`ev_charging` se agrupa en Servicios porque es una instalación
     compartida; `wifi` también queda acá porque es un servicio
     contratado, no un atributo físico. Documentado en el helper.)

## 4. Tokens a usar

- **Fondo página**: `bg-background` (clear-day).
- **Cards**: `bg-surface`, `rounded-xl`, `shadow-soft`,
  `border border-divider-soft`.
- **Header de card** (banda de título con ícono burbuja): fondo
  `bg-surface-soft/40` con gradiente lateral a `transparent`
  (`bg-gradient-to-r from-surface-soft/40 to-transparent`). Ícono en
  círculo `bg-surface-soft` con `text-on-surface`.
- **Texto**: `text-on-surface` para título, `text-muted` para captions
  y caracteres `0 / 2000`.
- **Acento de acción**: `bg-primary` + `text-on-primary` para Save
  Property. `bg-surface border border-outline text-on-surface` para
  Save Draft.
- **Inputs**: `Input` primitivo existente (`src/components/ui/Input.tsx`).
  Borde `border-outline`, focus `ring-primary`. Para Select se usa
  `<select>` native con las mismas clases (no hay primitive aún;
  detalle en §5.3).
- **Dropzone**: `border-2 border-dashed border-outline`,
  `bg-neutral-50`, hover `bg-surface-soft/20 border-primary/40`.
- **Sticky bar móvil**: `bg-surface border-t border-divider shadow-soft`.
- **Estados**:
  - Required asterisk: `text-danger`.
  - Error message: `text-danger text-xs mt-1`.
  - Asterisco main badge: `bg-primary text-on-primary`.

## 5. Estructura de archivos

### 5.1 Nuevos

| Archivo                                                            | Rol                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------- |
| `src/app/(dashboard)/dashboard/properties/new/page.tsx`            | Server Component. Resuelve sesión + rol, renderiza `<PropertyForm mode="create" initial={null} />`.                                                                                                                                                                                        |
| `src/app/(dashboard)/dashboard/properties/[id]/edit/page.tsx`      | Server Component. Carga property + amenities + images con `getPropertyForEdit` (helper nuevo en `queries.ts`), guard de ownership/admin, renderiza `<PropertyForm mode="edit" initial={...} />`. `notFound()` si la property no existe o si el caller no puede editarla (no 403, no leak). |
| `src/app/(dashboard)/dashboard/properties/[id]/edit/not-found.tsx` | Mensaje "Propiedad no encontrada o sin permisos".                                                                                                                                                                                                                                          |
| `src/components/property-form/PropertyForm.tsx`                    | Client Component raíz que orquesta estado, validación, upload y submit. Mantiene `useReducer` o `useState` por sección + memoiza children (ver §11 R3).                                                                                                                                    |
| `src/components/property-form/SectionCard.tsx`                     | Card con header (ícono + título). Reutilizada por las 5 secciones.                                                                                                                                                                                                                         |
| `src/components/property-form/BasicInfoSection.tsx`                | Title, Price, Status (listing_type), Property Type.                                                                                                                                                                                                                                        |
| `src/components/property-form/DescriptionSection.tsx`              | Textarea con char counter (max 2000). Sin toolbar de formato (cosméticos del mockup, deuda documentada §12).                                                                                                                                                                               |
| `src/components/property-form/GallerySection.tsx`                  | Dropzone + grid de previews. Maneja upload paralelo a `_drafts/`.                                                                                                                                                                                                                          |
| `src/components/property-form/GalleryThumb.tsx`                    | Tile individual: thumbnail + botón X + radio Main + barra de progreso/error.                                                                                                                                                                                                               |
| `src/components/property-form/LocationSection.tsx`                 | Inputs address_line, city, state, country, postal_code + `<PropertyMapPreview />` reusado (`src/components/property/PropertyMapPreview.tsx`). No hay geocoding (§12).                                                                                                                      |
| `src/components/property-form/DetailsSection.tsx`                  | Area, year, beds/baths/parking counters + amenities por categoría.                                                                                                                                                                                                                         |
| `src/components/property-form/FormActions.tsx`                     | Botones Save Draft + Save Property (variante desktop = inline en header derecho; móvil = sticky bottom). Recibe `pending`, `phase` (`'idle'                                                                                                                                                | 'uploading' | 'saving'`). |
| `src/components/property-form/UnsavedChangesGuard.tsx`             | Client hook component. `useEffect` con `beforeunload` cuando `isDirty`. Para navegación SPA: intercept con `<Link>` modal (ver §11 R6).                                                                                                                                                    |
| `src/components/property-form/index.ts`                            | Barrel export.                                                                                                                                                                                                                                                                             |
| `src/lib/properties/amenity-categories.ts`                         | Helper con mapping `AmenityKey → 'interior' \| 'exterior' \| 'services'` + labels ES de cada categoría.                                                                                                                                                                                    |
| `src/lib/properties/form-schemas.ts`                               | `draftSchema`, `publishSchema`, tipos derivados (`PropertyFormValues`, `PropertyFormImage`).                                                                                                                                                                                               |
| `src/lib/properties/image-upload.ts`                               | Helpers cliente: `validateImageFile(file)`, `uploadDraftImage({ supabase, userId, file, onProgress })` → devuelve `{ storagePath, signedUrl?, error? }`.                                                                                                                                   |
| `supabase/migrations/0019_storage_property_images_drafts.sql`      | Política RLS de Storage para permitir INSERT/UPDATE/DELETE/SELECT en `_drafts/{auth.uid()}/...` y normalizar las policies existentes para aceptar el nuevo prefijo `properties/{property_id}/...` (que ya se usa hoy) y rechazar otros.                                                    |

### 5.2 Modificados

| Archivo                                                 | Cambio                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/properties/actions.ts`                         | Agregar `createProperty(input)` y `updateProperty(input)`. Reusan `revalidatePath('/dashboard')`. Detalle en §7.                                                                                                             |
| `src/lib/properties/queries.ts`                         | Agregar `getPropertyForEdit(supabase, id)` que devuelve la property con amenities + images en formato editable (incluye `id` de cada image para el diff).                                                                    |
| `src/lib/properties/index.ts`                           | Re-exports si aplica.                                                                                                                                                                                                        |
| `src/components/dashboard/EditPropertyLink.tsx`         | (Sin cambios; ya apunta a `/dashboard/properties/[id]/edit`.)                                                                                                                                                                |
| `src/components/ui/Textarea.tsx` _(nuevo si no existe)_ | Primitivo mínimo (label, helperText, error, character counter opcional) — se evalúa primero si conviene reusar `Input` con `as="textarea"`; recomendación: nuevo primitive porque ya está listado en design-system §"forms". |

### 5.3 No cambia

- `protectedPaths` en `src/lib/supabase/proxy.ts` ya incluye
  `/dashboard` → cubre `/dashboard/properties/new` y `.../edit`. No se
  agregan rutas nuevas.
- `next.config.ts` ya tiene Supabase Storage en `remotePatterns`.
- TopNav y guard de rol vienen del `(dashboard)/layout.tsx`.

### 5.4 Path convention de Storage — aclaración crítica

La migración 0010 espera paths con shape `properties/{property_id}/{file}`
(usa `split_part(name, '/', 2)` para extraer el property_id). El
prompt mencionaba `property-images/{propertyId}/...` (el nombre del
bucket en la URL pública), pero el path **dentro del bucket** debe
empezar con `properties/`. Esto es lo que ya valida el helper
`get-image-url.ts` y lo que las policies actuales aceptan.

Para soportar el draft prefix, la migración 0019 amplía las policies:

- `_drafts/{auth.uid()}/...` → permitido para INSERT/UPDATE/DELETE/SELECT
  por el propio user (independiente de ownership de cualquier property).
- `properties/{property_id}/...` → comportamiento actual (sin cambios).
- Cualquier otro prefijo → rechazado.

## 6. Layout y cards

### 6.1 Estructura general

```
<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
  <Header />            ← breadcrumb + título + botones (desktop only)
  <form class="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start pb-24 md:pb-0">
    <div class="xl:col-span-8 space-y-6 lg:space-y-8">
      <BasicInfoSection />
      <DescriptionSection />
      <GallerySection />
    </div>
    <div class="xl:col-span-4 space-y-6 lg:space-y-8">
      <LocationSection />
      <DetailsSection />  ← sticky en xl+ (top-24)
    </div>
  </form>
  <FormActions variant="mobile-sticky" /> ← solo `md:hidden`
</main>
```

- **Padding inferior 24 (`pb-24`)** en móvil para que la barra sticky
  no tape el último input. En `md+` se quita.
- **DetailsSection sticky** sólo en `xl+` (en pantallas más chicas el
  scroll natural funciona mejor).

### 6.2 Header

- **Breadcrumb**: `Propiedades > Nueva` o `Propiedades > Editar`. Los
  links son `<Link href="/dashboard">`. Estilo: `text-sm text-muted`
  con separador `chevron_right`.
- **Título**: H1 `text-3xl md:text-4xl font-bold text-on-surface
tracking-tight`. Texto:
  - create: "Agregar propiedad"
  - edit: "Editar propiedad"
- **Subtítulo**: `text-base text-muted` con copy
  "Completá los detalles para publicar tu propiedad. Los campos con \* son obligatorios."
- **Botones desktop**: ocultos en `<md`. En `md+` van a la derecha del
  título. Save Draft (`secondary`) + Save Property (`primary` con icon
  `save`).
- **Borde inferior**: `border-b border-divider pb-8 mb-8`.

### 6.3 Contenido de cada card

#### Card 1 — Basic Information (ícono `info`)

| Campo             | Tipo                          | Tamaño                 | Notas                                                                                                                                                                        |
| ----------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property Title \* | `Input` text                  | `col-span-full`        | placeholder "Penthouse moderno con vista al mar". maxLength=200.                                                                                                             |
| Price \*          | `Input` number con prefix `$` | `md:col-span-1` (de 3) | placeholder "0.00". min=0, step=1000.                                                                                                                                        |
| Status \*         | `<select>`                    | `md:col-span-1`        | Opciones: `En venta` (`sale`), `En alquiler` (`rent`). **Mapea a `listing_type`**, no a `listing_status`. El campo `listing_status` se setea por el botón (draft vs active). |
| Property Type \*  | `<select>`                    | `md:col-span-1`        | Opciones del enum `property_type` traducidas: Casa, Apartamento, Villa, Penthouse, Condominio, Townhouse, Comercial.                                                         |

Layout: `space-y-6` interno; sección de 3 cols con `grid grid-cols-1 md:grid-cols-3 gap-4`.

#### Card 2 — Description (ícono `description`)

- **Sin toolbar de formato.** El mockup la muestra (B / I / lista) pero
  el textarea es de plain text — los botones son decorativos. Decisión:
  no implementarlos en MVP, dejarlo plain. Deuda documentada en §12.
- **Textarea**: min-h `200px`, `resize-y`, maxLength=2000.
- **Char counter**: alineado a la derecha, `text-xs text-muted`. Se
  pinta en rojo (`text-danger`) si `length > 2000`. Si `length < 50`
  y el botón pulsado fue Save Property, el error de zod aparece debajo
  del textarea.

#### Card 3 — Gallery (ícono `image`)

Ver §8 para la anatomía detallada del componente. Estructura:

```
<SectionCard title="Galería" icon="image" trailing={<Badge>JPG, PNG, WEBP</Badge>}>
  <Dropzone />              ← drag & drop + click
  <ThumbnailsGrid />        ← grid responsive de previews
</SectionCard>
```

#### Card 4 — Location (ícono `place`)

| Campo           | Tipo                                                                                | Notas                                              |
| --------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Address line \* | `Input` text                                                                        | placeholder "Calle, número, colonia"               |
| City \*         | `Input` text                                                                        | placeholder "Ciudad de México"                     |
| State           | `Input` text                                                                        | placeholder "CDMX" (opcional)                      |
| Country         | `Input` text                                                                        | placeholder "México". Default value: "México".     |
| Postal code     | `Input` text                                                                        | placeholder "01000" (opcional)                     |
| Map preview     | `<PropertyMapPreview latitude={null} longitude={null} address={composedAddress} />` | Reusa el componente existente. Sin geocoding real. |

Layout: `space-y-4`, todos en col única dentro del card.

#### Card 5 — Details (ícono `straighten`)

- **Sub-grid 1**: Area (m²) + Year Built en `grid grid-cols-2 gap-3`.
- **Sub-grid 2**: Bedrooms / Bathrooms / Parking — 3 filas
  `flex justify-between items-center`. Cada fila reusa `CounterPill`
  (de `src/components/search/CounterPill.tsx`) con:
  - label visible con ícono Material (`bed`, `shower`, `directions_car`).
  - `min=0`, `max=20` (override el default 6 — propiedades reales).
  - `formatValue`: `(n) => String(n)` (queremos número crudo, no "3+").
  - Edge case: en `search_filters_modal` `CounterPill` muestra
    "Cualquiera" para `value === 0`. Acá necesitamos mostrar "0".
    Solución: pasar `formatValue={(n) => String(n)}` explícito.
- **Sub-sección Amenities** (debajo, separada por `<hr>`):
  - Título "Amenidades" (`text-sm font-semibold uppercase tracking-wider text-muted`).
  - **3 grupos** (Interior / Exterior / Servicios). Cada grupo:
    `<h4 class="text-xs font-medium text-muted mb-2 mt-4">Interior</h4>`
    seguido de `<div class="space-y-2">` de checkboxes.
    Cada checkbox = `<label class="flex items-center gap-2 cursor-pointer">`
    con `<input type="checkbox" class="h-4 w-4 accent-primary">` +
    `<span class="text-sm text-on-surface">Label ES</span>`.
  - **Reuso vs. nuevo componente**: NO usar `AmenityChipGroup` (genera
    pills cuadradas en grid 2/3 cols — no encaja con el sidebar
    angosto del mockup). Renderizar checkboxes simples agrupados.

### 6.4 Responsive breakpoints

| Breakpoint    | Cambios respecto al móvil base                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `<md` (móvil) | 1 col, sticky save bar abajo. Sin botones de save en el header. Sub-grids de 3 cols colapsan a 1. |
| `md` (768)    | Sub-grids 3-cols funcionan. Botones de save aparecen en el header. Sticky bar oculta.             |
| `xl` (1280)   | Split 8/4. `DetailsSection` se vuelve `sticky top-24`. Resto sigue normal.                        |

## 7. Server Actions

Ambas en `src/lib/properties/actions.ts` (extender el archivo, no crear
uno nuevo). Cada acción devuelve un discriminated union para que el
client pueda branch sobre `result.ok`.

### 7.1 `createProperty(input)`

**Firma**:

```ts
export type CreatePropertyInput = {
  mode: 'draft' | 'publish';
  values: z.input<typeof draftSchema> | z.input<typeof publishSchema>;
  draftImages: Array<{
    storagePath: string; // p.ej. "_drafts/<uid>/<uuid>.jpg"
    isMain: boolean;
    altText: string | null;
    position: number;
  }>;
};

export type CreatePropertyResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: {
        code: CreatePropertyErrorCode;
        message: string;
        fieldErrors?: Record<string, string>;
      };
    };
```

**Flujo**:

1. `await getUser()` → si no hay sesión, `unauthenticated`.
2. `await getProfileRole(user.id)` → si no es `agent | broker | admin`,
   `forbidden`.
3. Pick schema según `mode`. `safeParse(values)`. Si falla, devolver
   `invalid` + `fieldErrors` aplanados.
4. (publish only) Validar invariantes adicionales:
   - `draftImages.length >= 1`.
   - Exactamente 1 `isMain === true`.
   - Cada `storagePath` empieza con `_drafts/<user.id>/`.
     Si falla, devolver `invalid` con mensaje específico.
5. INSERT `properties` con `owner_id=user.id`,
   `listing_status = mode === 'publish' ? 'active' : 'draft'`,
   `published_at = mode === 'publish' ? new Date().toISOString() : null`.
   Devuelve `id`.
6. **Mover imágenes** secuencialmente (no paralelo — facilita rollback):
   para cada `draftImages[i]`:
   - `from = draftImages[i].storagePath`
   - `to = "properties/<id>/<uuid>.<ext>"` (extraer uuid/ext del from
     o regenerar uuid nuevo — preferir regenerar para que la URL final
     no exponga el userId).
   - `supabase.storage.from('property-images').move(from, to)`.
   - Si falla un move:
     - **Best-effort rollback** (R2 de §11): borrar de la DB la
       `properties` recién creada y devolver
       `{ ok: false, error: { code: 'image_move_failed', ... } }`.
     - Las imágenes que sí se movieron pueden quedar huérfanas en
       `properties/<id>/`; las borramos en best-effort vía
       `storage.remove([...moved])`. Si esto también falla, se loggea
       en consola server y se acepta la deuda.
7. INSERT en `property_images` (un row por imagen) con
   `property_id=id`, `storage_path=to`, `is_main`, `position`,
   `alt_text`.
8. INSERT en `property_amenities` (un row por amenity seleccionada).
9. `revalidatePath('/dashboard')`, `revalidatePath('/')` (home pública
   muestra activas), `revalidatePath('/property/${id}')`.
10. `return { ok: true, id }`. **El redirect lo hace el client**
    (`router.push('/dashboard?flash=created')`) — no devolvemos
    `redirect()` desde la action para poder mostrar el flash.

**Códigos de error**:

```ts
type CreatePropertyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'image_move_failed'
  | 'server';
```

### 7.2 `updateProperty(input)`

**Firma**:

```ts
export type UpdatePropertyInput = {
  id: string;
  mode: 'draft' | 'publish';
  values: ...;
  images: Array<{
    /** Si `id` existe → es una imagen ya en DB (puede mantenerse o eliminarse). */
    id?: string;
    storagePath: string; // _drafts/... para nuevas, properties/... para existentes
    isMain: boolean;
    altText: string | null;
    position: number;
    /** Marca para borrar. Si true, no se incluye en el UPSERT final. */
    deleted?: boolean;
  }>;
  amenities: AmenityKey[];
};
```

**Flujo**:

1. Auth + rol (igual que create).
2. Cargar property actual (solo `owner_id, listing_status`). Si no
   existe → `not_found`.
3. Ownership: `owner_id === user.id` OR `isAdmin(user)`. Sino,
   `not_found` (no `forbidden`, no leak — el page.tsx ya hace
   `notFound()` antes de llegar acá, pero la action es defense-in-depth).
4. Validar con schema según `mode`.
5. **Diff de imágenes**:
   - `toCreate = images.filter(i => !i.id && !i.deleted)` (nuevas en
     `_drafts/`). Hay que moverlas a `properties/{id}/`.
   - `toDelete = images.filter(i => i.id && i.deleted)` (existentes
     marcadas para borrar). Borrar de DB + Storage.
   - `toUpdate = images.filter(i => i.id && !i.deleted)` (existentes
     que pueden haber cambiado `isMain`, `position`, `altText`).
6. UPDATE `properties` con todos los campos del form.
7. Para cada `toCreate`: move y INSERT (idéntico a create §6).
   Rollback aplica solo a los inserts nuevos; los existentes no se
   tocan.
8. Para cada `toDelete`: DELETE de `property_images` por id +
   `storage.remove(storagePath)`.
9. Para cada `toUpdate`: UPDATE selectivo. Cuidado con la constraint
   `property_images_one_main_idx`: si se cambia el main, primero hay
   que `UPDATE ... SET is_main=false` en la actual, luego
   `UPDATE ... SET is_main=true` en la nueva (en una transacción si es
   posible — Supabase JS no soporta tx nativa, así que se hace
   secuencial y se acepta la pequeña ventana de inconsistencia).
10. **Diff de amenities**:
    - Leer las actuales con un SELECT.
    - `toInsert = nuevas - actuales`; INSERT en lote.
    - `toRemove = actuales - nuevas`; DELETE filtrando por
      `property_id` AND `amenity IN (...)`.
11. Si `mode === 'publish'` Y `listing_status` actual era `'draft'`:
    actualizar `listing_status='active'` y `published_at=now()`. Si ya
    estaba `active|pending|sold|rented`, mantener el estado. Si estaba
    `archived` y el modo es publish, también pasa a `active`.
12. revalidatePaths idénticos a create + `revalidatePath('/property/${id}')`.
13. `return { ok: true, id }`.

**Códigos de error**: idénticos a create + `not_found`.

### 7.3 ¿Por qué no transacción real?

Supabase JS client no expone transacciones cross-table desde el cliente.
Las opciones eran (a) escribir una función RPC SQL `create_property_full`
o (b) hacer best-effort en JS. Decisión: **(b) en MVP**, con rollback
explícito en caso de fallo de move. La función RPC se documenta como
mejora futura (§12).

## 8. Gallery component

### 8.1 Anatomía

```
<GallerySection>
  <Dropzone />                  ← border-dashed, click-or-drag
  <ThumbnailsGrid>
    {images.map(img => <GalleryThumb img={img} />)}
    {images.length < MAX && <AddMoreTile />}  ← deshabilitar si MAX (12 imgs propuestas)
  </ThumbnailsGrid>
</GallerySection>
```

### 8.2 Dropzone

- HTML: `<label>` con `<input type="file" multiple accept="image/jpeg,image/png,image/webp" class="sr-only">`.
- Soporta drag & drop: `onDragOver`, `onDragLeave`, `onDrop` con
  `e.dataTransfer.files`.
- Estado visual:
  - default: `border-outline bg-neutral-50 text-muted`.
  - dragging: `border-primary bg-surface-soft/40`.
  - subiendo (al menos 1 imagen en `phase === 'uploading'`):
    cursor-wait.
- Texto: "Arrastrá imágenes o hacé clic". Sub-copy
  `text-xs text-muted`: "Hasta 5 MB por imagen · JPG, PNG, WEBP".
- Ícono `cloud_upload` en círculo `bg-surface shadow-card text-primary`.

### 8.3 Validación cliente antes de subir

`validateImageFile(file)` en `src/lib/properties/image-upload.ts`:

```ts
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateImageFile(
  file: File,
): { ok: true } | { ok: false; reason: 'too_big' | 'wrong_type' | 'empty' };
```

Errores se muestran como toast inline en el card de Gallery
(`text-danger text-sm mt-2`). Si el batch droppeado tiene mezcla,
las válidas se aceptan y las inválidas se listan en el toast.

### 8.4 Upload flow

Por cada `File` válido el GallerySection:

1. Genera `uuid` (`crypto.randomUUID()`), extrae extensión del
   `file.type` (`'image/jpeg'` → `jpg`).
2. Path provisional: `_drafts/${userId}/${uuid}.${ext}`.
3. Crea un objeto local `pendingImage`:
   ```ts
   {
     localId: uuid,                 // para reconciliar con el upload
     file,                          // para preview con URL.createObjectURL
     previewUrl: URL.createObjectURL(file),
     storagePath: provisionalPath,
     isMain: images.length === 0,   // primera = main automática
     progress: 0,
     status: 'uploading',
     altText: null,
   }
   ```
4. `supabase.storage.from('property-images').upload(provisionalPath, file, { contentType: file.type, upsert: false })`.
   El cliente JS no expone progress events nativos para el upload — el
   `progress` se simula con un timer cosmético (10%/200ms hasta el 90%,
   se completa a 100% al `await` resolver). Documentar como deuda
   menor en §12.
5. Tras success: actualizar `status: 'ready'`. Tras error:
   `status: 'error'` + retain `file` para reintentar.
6. El `userId` viene del `useUser()` hook (ya existe en `src/lib/auth/`
   — verificar nombre exacto: probablemente `useSession` o se pasa por
   prop desde la page server-side).

### 8.5 GalleryThumb

```
<div class="relative aspect-square rounded-lg overflow-hidden shadow-card group">
  <img src={previewUrl ?? publicUrl} class="w-full h-full object-cover" />

  {status === 'uploading' && <ProgressBar />}
  {status === 'error' && <RetryOverlay />}

  <span class="absolute top-2 left-2">
    {isMain && <Badge variant="primary" size="xs">MAIN</Badge>}
  </span>

  <div class="absolute inset-0 bg-on-surface/60 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-opacity flex items-center justify-center gap-2">
    <IconButton icon="delete" variant="ghost" aria-label="Eliminar" onClick={onDelete} />
    <IconButton icon="star" variant={isMain ? 'primary' : 'ghost'} aria-label="Marcar como principal" onClick={onMarkMain} />
  </div>
</div>
```

- **Marca Main**: el icon `star` se fillea si `isMain`. Click → setea
  esta imagen `isMain=true` y todas las demás `isMain=false`.
- **Delete**:
  - Si la imagen está aún en `_drafts/`: `storage.remove(path)` y
    quitar del estado.
  - Si la imagen ya existe en DB (modo edit): marcar
    `deleted: true` en el estado y ocultar del grid. El delete real
    de Storage + DB lo hace la Server Action.
  - Si la imagen eliminada era `isMain`, auto-asignar `isMain=true` a
    la primera no-deleted.
- **Retry** (status error): botón "Reintentar" reutiliza el `file`
  cacheado. Si la imagen estaba marcada como Main y falló, la marca
  Main pasa temporalmente a la primera `ready`.

### 8.6 Grid y "Add More"

- Grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`.
- Tile "Add More" (último slot): botón con borde dashed, ícono `add`,
  texto "Agregar". Click → dispara el mismo `<input type="file">` del
  dropzone.
- Límite máximo sugerido: **12 imágenes por propiedad**. Si se alcanza,
  ocultar el tile "Add More" y mostrar caption
  "Máximo 12 imágenes alcanzado".

### 8.7 Manejo de upload parcial al guardar

Caso: el agente sube 5 imágenes; 3 terminan OK (`status: 'ready'`) y 2
quedaron en `status: 'error'` y no reintentó.

**Decisión** (mi recomendación que el humano debe confirmar):

- El botón "Save Property" / "Save Draft" se habilita si **todas las
  imágenes están en `ready` o no hay imágenes en `error/uploading`**.
- Si hay imágenes en `uploading`, mostrar toast "Esperá a que terminen
  las subidas" y bloquear submit.
- Si hay imágenes en `error`, mostrar diálogo nativo (o un `<Modal>`
  primitivo si existe) con 3 opciones:
  - "Reintentar todas" → reintenta cada error.
  - "Continuar sin ellas" → quita las erroreadas del estado y submitea.
  - "Cancelar" → no hace nada.
- Validación de "al menos 1 imagen" (publishSchema) se aplica sobre
  las imágenes en estado `ready`. Si quedan 0 ready, publishSchema
  falla y el botón Save Property muestra error.

## 9. Edit mode

### 9.1 Pre-fill

`getPropertyForEdit(supabase, id)` devuelve:

```ts
{
  id, title, description, price, listing_type, property_type,
  address_line, city, state, country, postal_code,
  area_sqm, year_built, bedrooms, bathrooms, parking_spaces,
  listing_status, published_at,
  amenities: AmenityKey[],
  images: Array<{ id, storagePath, isMain, position, altText }>
}
```

Esta es la `initial` prop del `PropertyForm`. El form inicializa todos
los campos. Las imágenes existentes se pintan en el grid; su
`storagePath` empieza con `properties/${id}/` y NO con `_drafts/`.

### 9.2 Diff de imágenes (recap §7.2.5)

El client manda el array completo de imágenes; la Server Action
identifica por `id`:

- `id` presente + `deleted=true` → DELETE en DB + Storage.
- `id` presente + `deleted=false` → UPDATE selectivo (isMain, position,
  altText).
- `id` ausente → INSERT (nueva imagen recién subida).

### 9.3 Diff de amenities (recap §7.2.10)

El client manda el array `AmenityKey[]` actual. Server hace SELECT
de las existentes, computa `toInsert = nuevas \ actuales` y
`toRemove = actuales \ nuevas`.

### 9.4 Comportamiento del botón Save

En edit, el botón principal se llama **"Guardar cambios"** (en lugar
de "Save Property"). El draft sigue diciendo "Guardar borrador".

- Si la property estaba en `draft` y el agent clickea "Guardar cambios"
  → pasa a `active` (publica).
- Si estaba en `active|pending|sold|rented` → mantiene el estado.
- Si estaba en `archived` → pasa a `active` (volver a publicar).
  Esto es opcional pero útil: si el agent edita una archivada, el
  intent natural es restaurarla.

### 9.5 Pre-fill listing_status del form

El form NO expone `listing_status` como campo. Se infiere de los
botones (draft vs publish). El estado actual se mantiene como una
variable oculta del componente para que la Server Action sepa si está
publicando algo nuevo o sólo editando.

## 10. Guards, RLS y validación zod

### 10.1 Guards en el page.tsx

**`/dashboard/properties/new/page.tsx`** (Server Component):

1. `(dashboard)/layout.tsx` ya valida sesión + rol agent/broker/admin.
   Defense-in-depth: re-verificar con `getSessionAndProfile()`.
2. Renderizar `<PropertyForm mode="create" initial={null} ownerId={user.id} />`.

**`/dashboard/properties/[id]/edit/page.tsx`** (Server Component):

```ts
const { id } = await params;
const session = await getSessionAndProfile();
if (!session?.user) redirect('/login?next=/dashboard');
const role = session.profile?.role ?? 'user';
if (!['agent', 'broker', 'admin'].includes(role)) redirect('/');

const supabase = await createClient();
const property = await getPropertyForEdit(supabase, id);
if (!property) notFound();

const isAdmin = role === 'admin';
const isOwner = property.owner_id === session.user.id;
if (!isAdmin && !isOwner) notFound(); // no leak

return <PropertyForm mode="edit" initial={property} ownerId={session.user.id} viewerRole={role} />;
```

### 10.2 Server Action guards (recap)

- Sesión (unauthenticated).
- Rol (forbidden).
- Validación zod (invalid).
- Ownership en update (not_found si no admin y no owner).
- Validación de paths de imagen en create/update: cada `storagePath`
  empieza con `_drafts/${user.id}/` o (en update) con
  `properties/${id}/`. Evita que un cliente malicioso "asocie" archivos
  ajenos a su property.

### 10.3 RLS de Storage (migración 0019)

Las policies actuales (mig 0010 + 0012) aceptan
`properties/{property_id}/...` validando ownership. **No aceptan**
`_drafts/{userId}/...`. Necesitamos ampliarlas:

```sql
-- 0019_storage_property_images_drafts.sql

-- SELECT: ya permitido a authenticated (mig 0012). Aceptable para drafts.

-- INSERT: aceptar drafts del propio user O properties owned.
drop policy if exists "property_images_storage_insert" on storage.objects;
create policy "property_images_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (
      public.is_admin()
      or (
        split_part(name, '/', 1) = '_drafts'
        and split_part(name, '/', 2) = auth.uid()::text
      )
      or (
        split_part(name, '/', 1) = 'properties'
        and exists (
          select 1 from public.properties p
          where p.id::text = split_part(name, '/', 2)
            and p.owner_id = auth.uid()
        )
      )
    )
  );

-- UPDATE y DELETE: mismas ramas, con `using`.
-- (Idem.)
```

- El move (`storage.move`) hace internamente `copy` + `delete`. Para
  que funcione, el caller necesita DELETE en el path source
  (`_drafts/...`) e INSERT en el destino (`properties/...`). La nueva
  policy cubre ambos.
- Después de la Server Action, las imágenes nuevas viven en
  `properties/<id>/...`, regidas por la policy de ownership normal.

### 10.4 Schemas zod (pseudo-código)

```ts
// src/lib/properties/form-schemas.ts
import { z } from 'zod';

export const LISTING_TYPES = ['sale', 'rent'] as const;
export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'villa',
  'penthouse',
  'condo',
  'townhouse',
  'commercial',
] as const;
export const AMENITIES = [
  'pool',
  'gym',
  'wifi',
  'air_conditioning',
  'garden',
  'smart_home',
  'parking',
  'patio',
  'wine_cellar',
  'ev_charging',
  'central_heating',
] as const;

const baseShape = {
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().max(2000).default(''),
  price: z.coerce.number().nonnegative(),
  listing_type: z.enum(LISTING_TYPES),
  property_type: z.enum(PROPERTY_TYPES),
  address_line: z.string().trim().default(''),
  city: z.string().trim().default(''),
  state: z.string().trim().nullable().default(null),
  country: z.string().trim().default('México'),
  postal_code: z.string().trim().nullable().default(null),
  area_sqm: z.coerce.number().min(0).nullable().default(null),
  year_built: z.coerce.number().int().min(1800).max(2100).nullable().default(null),
  bedrooms: z.coerce.number().int().min(0).default(0),
  bathrooms: z.coerce.number().int().min(0).default(0),
  parking_spaces: z.coerce.number().int().min(0).default(0),
  amenities: z.array(z.enum(AMENITIES)).default([]),
};

export const draftSchema = z
  .object({
    ...baseShape,
    title: baseShape.title, // sólo title required
  })
  .passthrough();

export const publishSchema = z.object({
  ...baseShape,
  title: z.string().trim().min(3).max(200),
  price: z.coerce.number().positive('El precio debe ser mayor a 0'),
  address_line: z.string().trim().min(3, 'Ingresá la dirección'),
  city: z.string().trim().min(2, 'Ingresá la ciudad'),
  area_sqm: z.coerce.number().positive('El área debe ser mayor a 0'),
  year_built: z.coerce.number().int().min(1800).max(2100),
  description: z.string().trim().min(50, 'Mínimo 50 caracteres'),
});

// La validación "≥1 imagen + ≥1 marcada main" se hace en la action
// porque las imágenes no son parte del schema (vienen aparte).
```

## 11. Riesgos

### R1 — Imágenes huérfanas en `_drafts/`

**Qué**: si el agente abandona el form sin clickear submit, las
imágenes subidas a `_drafts/` quedan en Storage. No tienen propiedad
asociada y no aparecen en ninguna query, pero ocupan espacio.

**Mitigación MVP**: aceptada como deuda. Documentar en §12 como
candidato a cleanup job / cron edge function que borre objetos en
`_drafts/<userId>/` con más de 24h de antigüedad. Para minimizar el
daño, el `UnsavedChangesGuard` (R6) advierte al agent antes de
navegar afuera y le da chance de guardar al menos como draft.

### R2 — Race condition en move de imágenes

**Qué**: si insert OK y luego el move falla a mitad (ej. la 3a de 5
falla por timeout), quedamos en estado mixto.

**Mitigación**: rollback best-effort en `createProperty` §7.1.6:
borrar la property recién creada Y best-effort borrar las imágenes
que sí se movieron. El agente ve `image_move_failed` y reintenta. Las
imágenes originales en `_drafts/` no se tocaron, así que el reintento
puede usar las mismas paths.

En `updateProperty` el escenario es peor: la property ya existía. Si
falla un move durante un update, **NO** borramos la property. En vez,
las nuevas imágenes movidas exitosamente se insertan, las que fallaron
se reportan, y el agent ve un error parcial: "Se guardaron N de M
imágenes. Reintentá las restantes."

### R3 — Tamaño del form / performance

**Qué**: el form es el más grande del MVP. Re-renders frecuentes en
cada keystroke pueden ser pesados.

**Mitigación**:

- Cada `*Section` se memoiza con `React.memo` y recibe sólo el slice
  que le corresponde + callbacks estables (`useCallback`).
- El estado central vive en `PropertyForm` con `useReducer`. NO se
  agrega react-hook-form (no está como dep y los riesgos de
  introducirla superan el beneficio para un único form).
- `<GallerySection>` mantiene su propio sub-estado para uploads (no
  contamina re-renders del resto al actualizar progresos).

### R4 — Server Action body limit vs upload de imágenes

**Qué**: Server Actions de Next 16 tienen body limit (default ~1MB).
Imágenes de hasta 5MB no caben en un POST de Server Action.

**Mitigación**: la subida real se hace desde el **browser client** a
Supabase Storage directamente (auth con la sesión del user). La
Server Action solo recibe los `storagePath` y los `File metadata`.
No hay binarios cruzando la action. Esto está reflejado en §7.1 y
§8.4.

### R5 — RLS de Storage para `_drafts/`

**Qué**: las policies actuales (mig 0010) no permiten escribir en
`_drafts/...`. Sin la migración 0019, todos los uploads fallarán con
RLS 403.

**Mitigación**: migración 0019 propuesta en §10.3 amplía las policies
INSERT/UPDATE/DELETE para aceptar el prefijo `_drafts/<auth.uid()>/`.
La migración debe aplicarse antes (o junto con) el merge del PR de
esta feature.

### R6 — Navegación con cambios sin guardar

**Qué**: el agent llena medio form, navega a `/dashboard` y pierde
todo.

**Mitigación**:

- `beforeunload` listener: bloquea reload/close de pestaña con
  el dialog nativo del browser. Se activa cuando `isDirty === true`.
- Navegación SPA (`<Link>` internos): Next 16 App Router no expone
  un equivalente a `useBeforeunload` para client routing. Implementación:
  un componente `<UnsavedChangesGuard>` que envuelve los `<Link>`
  importantes (breadcrumb "Propiedades", el logo). En su lugar, esos
  se renderizan como `<button onClick={confirm + router.push}>` que
  muestra un confirm nativo. **No se intercepta el `back` del browser**
  — riesgo aceptado.
- El "draft" como red de seguridad: el agent puede clickear "Guardar
  borrador" en cualquier momento; el draft requiere solo el título.

### R7 — Constraint `one_main_idx` durante el switch de main

**Qué**: en edit, si el agent cambia cuál imagen es Main, hay dos
UPDATEs (vieja main → false, nueva main → true). La constraint
unique `property_images_one_main_idx` rechazaría INSERTs simultáneos
de dos mains, pero en serie es OK.

**Mitigación**: orden explícito en el server: primero `UPDATE ... is_main=false`
en TODAS las existentes que no sean la nueva main, luego
`UPDATE ... is_main=true` en la nueva. Si la nueva main es una imagen
recién insertada, hacer el switch DESPUÉS del INSERT.

## 12. Out of scope (deuda explícita)

| Item                                                               | Razón                                                                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cleanup automático de `_drafts/` huérfanos                         | Requiere cron / edge function (no hay infra hoy).                                                                                                           |
| Toolbar de formato en Description (B/I/lista)                      | Cosmético del mockup; sin valor MVP.                                                                                                                        |
| Geocoding real / autocompletado de dirección                       | Requiere API key + librería; mockup ya usa placeholder.                                                                                                     |
| Subida con progress real                                           | Supabase JS client no expone progress events nativos; cosmético.                                                                                            |
| Función RPC `create_property_full` para transacción atómica        | Rollback best-effort es suficiente para MVP; refactor futuro.                                                                                               |
| Edición avanzada de imágenes (reordenar drag&drop, crop, alt text) | El mockup muestra un botón `edit` por imagen — fuera de scope. Position se asigna por orden de upload.                                                      |
| Variante landscape de Gallery con foto principal grande            | El mockup actual usa grid uniforme — alineado.                                                                                                              |
| Notificaciones a usuarios favoriteadores en `price_drop`           | Hay tipo `notification_type='price_drop'` en el enum pero el trigger no está implementado. Si el agent baja el precio en un update, no se dispara nada hoy. |
| Signed URLs / control de visibilidad por imagen                    | El bucket es público por decisión Fase 2.                                                                                                                   |
| Validación de duplicados (mismo título exacto del mismo owner)     | El form no chequea.                                                                                                                                         |

## 13. Criterios de aceptación verificables (para review humano)

- [ ] `/dashboard/properties/new` renderiza el form vacío para
      agent/broker/admin. Redirige a `/login?next=...` si no hay sesión.
- [ ] `/dashboard/properties/[id]/edit` pre-llena los campos con datos
      del owner. Devuelve 404 si la property no existe.
- [ ] `/dashboard/properties/[id]/edit` devuelve 404 (no 403) si
      `owner_id != user.id` Y `role != admin`. Admin puede editar
      cualquier property.
- [ ] El botón **Save Draft** acepta el form si sólo tiene title (>=3).
- [ ] El botón **Save Property** muestra errores zod inline si falta
      cualquier campo del `publishSchema`.
- [ ] Subo 3 imágenes desde la dropzone: aparecen como thumbnails con
      barra de progreso; la primera queda marcada como Main automáticamente.
- [ ] Cambio el Main click en el icono star de la imagen 2; la 1
      pierde el badge Main y la 2 lo gana.
- [ ] Click delete sobre una imagen en `_drafts/`: desaparece del
      grid y se borra de Storage.
- [ ] Click Save Property con 3 imágenes ready: la property se crea,
      las 3 se mueven a `properties/<id>/`, se borran de `_drafts/`, y
      redirige a `/dashboard` con flash "Propiedad publicada".
- [ ] Tras refrescar `/dashboard`, la nueva property aparece en la
      lista con su imagen Main correcta.
- [ ] En modo edit, cambio el title y el precio → al guardar, el row
      refleja los nuevos valores y `updated_at` cambió.
- [ ] En modo edit, agrego 1 imagen nueva y elimino 1 existente: la
      nueva aparece en Storage `properties/<id>/`, la eliminada se borra
      de Storage y de la DB. La constraint `one_main_idx` no se viola.
- [ ] Selecciono 5 amenities, guardo. En la DB hay exactamente 5
      rows en `property_amenities` para esa property. Desmarco 2 y guardo:
      quedan 3 rows.
- [ ] Subo un archivo de 7MB: se rechaza en cliente con error
      "Máximo 5 MB"; no llega a Storage.
- [ ] Subo un PDF: se rechaza en cliente con error de tipo.
- [ ] Modifico el title y trato de cerrar la pestaña: el browser
      muestra el dialog nativo de "¿Salir del sitio?".
- [ ] La migración 0019 está aplicada antes del PR del feature
      (verificable con `list_tables` / `get_advisors`).
- [ ] En móvil (< md), el header NO muestra los botones, y aparece
      una barra sticky abajo con Save Draft + Save Property.
- [ ] En `xl+`, el sidebar (Location + Details) hace `sticky` al
      scrollear el contenido principal.

## 14. Alternativas consideradas

### Opción A — Upload directo a `properties/{tempId}/` con UUID temporal

Generar un UUID en el client antes del primer upload y usarlo como
`property_id` provisional. Si el insert OK, se usa ese mismo UUID
como id real (no hay move). Si falla, el client borra los archivos.

- **Pro**: cero moves. Menos puntos de falla.
- **Contra**: la policy de Storage requiere que exista una row en
  `properties` con ese id (la query `exists (select 1 from
properties where id::text = split_part(name, '/', 2) and owner_id =
auth.uid())`). Para evitarlo habría que reescribir la policy entera,
  o crear la row de `properties` FIRST y luego subir, lo que invierte
  el orden actual y arrastra el problema de imágenes huérfanas a la
  property misma (drafts en DB).
- **Veredicto**: descartada. La policy es restrictiva por diseño y
  ampliarla compromete la seguridad.

### Opción B — Upload tras el insert (sin `_drafts/`)

Insertar la property primero (con `listing_status='draft'`,
publishable=false), después subir las imágenes a `properties/{id}/`,
finalmente actualizar `published_at` y `listing_status` si el agente
clickeó "Save Property".

- **Pro**: cero moves. Cero `_drafts/`.
- **Contra**: si el agente abandona después del insert pero antes de
  subir cualquier imagen, queda una property fantasma en DB sin
  imágenes. Peor que un archivo huérfano (la fantasma aparece en
  queries y rompe asunciones).
- **Veredicto**: descartada. El estado fantasma de DB es más caro de
  limpiar que objetos en `_drafts/`.

### Opción C — `_drafts/` con move post-insert (recomendada)

Lo descrito en §3.1 y §7.1.

- **Pro**: el agent puede subir imágenes sin tocar la DB. Si abandona,
  el daño es sólo Storage (más barato). El move es atómico por archivo
  (no transaccional cross-archivo, pero cada move sí lo es).
- **Contra**: requiere ampliar las policies (mig 0019). Race condition
  parcial cubierta con rollback best-effort.
- **Veredicto**: **recomendada**. Mejor trade-off de los 3.

---

**Pregunta abierta al humano** (no bloquea el spec, pero conviene
cerrar antes del implement):

1. **¿Aceptamos crear el primitivo `Textarea`** en `src/components/ui/`
   o el implementer puede usar `<textarea class="...">` ad-hoc dentro
   de `DescriptionSection`? Recomiendo crearlo: el design-system lo
   lista en §forms y se va a reusar en mensajería futura.
2. **¿El selector de Status del mockup ("For Sale / For Rent / Sold")
   mapea correctamente a `listing_type`** (`sale`/`rent`) como yo
   asumí, o el humano quiere que sea un selector de `listing_status`
   con `Sold` explícito? Mi lectura es que `listing_type` es lo
   correcto: `listing_status` lo controlan los botones (draft vs
   publish) + un futuro flujo de "marcar como vendida" fuera de scope
   acá.
3. **Límite de 12 imágenes** por propiedad: ¿OK? El mockup muestra 3
   tiles + Add More. No hay constraint en DB.

---

## 15. Decisiones cerradas post-spec (2026-05-25)

Tras leer el spec, el humano cerró las 3 preguntas abiertas de §14.
Las respuestas se incorporan acá; las referencias en otras secciones
(§5.1 fila `Textarea.tsx`, §6.3 Card 1 "Status", §8.6 "Add More",
§10.4 schemas) deben leerse a la luz de estas decisiones.

1. **Primitivo `Textarea` — SÍ.** Crear `src/components/ui/Textarea.tsx`
   siguiendo el patrón de `Input` / `Button` / `Card` (props `label`,
   `helperText`, `error`, `id`/`name`, soporte `aria-describedby`).
   Re-exportar desde `src/components/ui/index.ts`. Se usa en la card
   "Description" (§6.3 Card 2) reemplazando el `<textarea>` ad-hoc que
   ahí se sugería. Resuelve §14 pregunta 1 y elimina la nota
   "se evalúa primero si conviene reusar `Input` with `as=textarea`"
   de §5.2 — va el primitivo nuevo.

2. **Status mapping confirmado — listing_type, no listing_status.**
   El dropdown de "Status" en Card 1 (§6.3) expone únicamente
   `listing_type` con dos opciones: `En venta` (`sale`) /
   `En alquiler` (`rent`). NO se agrega un dropdown adicional de
   `listing_status` al form. Ese campo lo controlan exclusivamente
   los botones de submit:
   - **Save Draft** → `listing_status = 'draft'`, `published_at = null`.
   - **Save Property** → `listing_status = 'active'`,
     `published_at = now()`.
     El flujo "marcar como vendida/rentada" queda fuera de scope (deuda
     en §12). Esto confirma lo que ya describía §3.3 y §6.3 Card 1; la
     §14 pregunta 2 queda cerrada explícitamente.

3. **Límite de imágenes = 12 (firme).** El número propuesto en §8.6
   queda confirmado. La validación se aplica en dos capas:
   - **Cliente**: cuando `images.length >= 12`, deshabilitar el input
     `<input type="file">` del dropzone (atributo `disabled`), ocultar
     el tile "Add More" y rechazar `onDrop` con toast
     "Máximo 12 imágenes alcanzado". El contador de imágenes en el
     header del card de Gallery muestra `N/12`.
   - **Zod**: en `src/lib/properties/form-schemas.ts` el array de
     imágenes (validado en la Server Action según §7.1.4 / §7.2.4)
     incluye `.max(12, 'Máximo 12 imágenes por propiedad')`. Si el
     cliente fue bypasseado, la action rechaza con `invalid`.
     §14 pregunta 3 queda cerrada.
