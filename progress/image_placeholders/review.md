# Review — feature image_placeholders

**Veredicto:** APPROVED

## Acceptance criteria

- [x] **`next.config.ts` incluye `images.unsplash.com` y `picsum.photos` en `remotePatterns`.**
  - Evidencia: `next.config.ts:13-19` añade ambos hostnames con `protocol: 'https'`.
  - La entrada original de `*.supabase.co` se conserva (`next.config.ts:7-10`).
  - El config sigue tipado como `NextConfig` (`next.config.ts:1,3`).

- [x] **`scripts/seed.ts` inserta 2-3 `property_images` por property con URLs de Unsplash.**
  - Evidencia: `scripts/seed.ts:447` define `IMAGES_PER_PROPERTY = 3`; `seedPropertyImages` (líneas 522-553) inserta 3 filas por property usando `buildUnsplashUrl(photoId)` (`https://images.unsplash.com/<photoId>?w=1600&q=80&auto=format&fit=crop`).
  - Verificado por query a BD: las 12 properties tienen exactamente 3 imágenes y el 100% de los `storage_path` son URLs absolutas de Unsplash.
  - El implementer eligió 3 (no 2) y lo justifica en `implementation.md`: la galería del `property_details_screen` necesita main + thumbnails.

- [x] **Helper `src/lib/images/get-image-url.ts` distingue URL absoluta vs relativa y devuelve la URL correcta.**
  - Evidencia: línea 23 detecta `http://` y `https://` con `startsWith`; devuelve el path tal cual si es absoluta.
  - Para paths relativos compone `{supabaseUrl}/storage/v1/object/public/property-images/{path}` (línea 37), usando la constante `PROPERTY_IMAGES_BUCKET = 'property-images'` (línea 9) — bucket correcto según convención del data model.
  - Normaliza dobles slashes: trim de `/` final en la base (línea 35) y `/` inicial en el path (línea 34).
  - Falla rápido si `NEXT_PUBLIC_SUPABASE_URL` no está definida (línea 28) — mejor que devolver URL rota silenciosa.

- [x] **Idempotencia del seed conservada (re-correr no duplica filas).**
  - Evidencia: `seedPropertyImages` consulta el `count` actual antes de insertar (`scripts/seed.ts:527-531`); si `count >= IMAGES_PER_PROPERTY` retorna sin tocar nada (línea 533).
  - Verificado por query a BD: 0 properties con > 3 imágenes; histograma `{ '3': 12 }`.
  - Patrón consistente con el resto del seed (`seedConversation`, `seedNotifications`).

## Checklist de revisión

- Tokens y colores: [x] N/A — la feature no toca JSX.
- Componentes y framework: [x] `next.config.ts` sigue tipado `NextConfig`; helper es módulo puro sin imports server-only ni `"use client"`; no se introducen dependencias (`package.json` no cambió).
- Supabase: [x] `service_role` no aparece en el helper ni en `next.config.ts` (grep confirmado); el helper solo lee `NEXT_PUBLIC_SUPABASE_URL` (público por diseño). El seed sigue usando service role solo en `scripts/`, no en código de cliente. Bucket correcto (`property-images`).
- Fidelidad visual: [x] N/A — feature de infraestructura, sin pantalla asociada.
- Calidad: [x] `pnpm lint` → 0 errores/warnings; `pnpm type-check` → 0 errores; sin `console.log` de debug nuevos (los `console.log` de progreso del seed son intencionales y siguen el patrón existente); textos en español.

## Verificaciones extra ejecutadas

### Queries SQL contra Supabase remoto

Vía cliente con service role (resultados consolidados):

```
Total rows property_images       : 36
Properties con imágenes          : 12
Max imágenes por property        : 3
Min imágenes por property        : 3
Properties con > 3 imágenes      : 0   ← idempotencia OK
Properties con mains != 1        : 0   ← exactamente 1 main por property
Properties con storage_path no-absoluto: 0  ← 100% URLs de Unsplash
Histograma total imágenes        : { '3': 12 }
Histograma mains por property    : { '1': 12 }
```

### Diff y dependencias

- `git diff --stat HEAD`: solo `feature_list.json`, `next.config.ts`, `scripts/seed.ts` (+ archivos nuevos en `src/lib/images/` y `progress/image_placeholders/`).
- `package.json` no cambió → no se introdujeron dependencias.

## Confirmación final

Lint, type-check y queries SQL pasaron. La implementación cumple los 4 acceptance criteria y respeta las reglas duras del proyecto. Se aprueba la feature.
