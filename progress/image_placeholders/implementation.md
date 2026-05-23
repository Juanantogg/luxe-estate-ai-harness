# image_placeholders — Implementación

## Archivos tocados

- **`next.config.ts`** — agregados `images.unsplash.com` y `picsum.photos` a
  `remotePatterns`, conservando la entrada original de `*.supabase.co`. Comentario
  corto sobre por qué entran al config (placeholders mientras no haya uploads
  reales).
- **`src/lib/images/get-image-url.ts`** — archivo nuevo. Exporta
  `getImageUrl(storagePath)` y la constante `PROPERTY_IMAGES_BUCKET`. Detecta
  prefijo `http://` / `https://` y devuelve la URL tal cual; en caso contrario
  compone la URL pública del bucket de Supabase Storage. Tira un `Error`
  explícito si `NEXT_PUBLIC_SUPABASE_URL` no está definida (mejor explotar
  temprano que renderizar URLs rotas). JSDoc explica el porqué de la dualidad
  placeholder/upload.
- **`scripts/seed.ts`** — añadida la función `seedPropertyImages()` y un pool
  `UNSPLASH_PHOTO_IDS` con los 9 IDs sugeridos en el brief. `upsertProperty()`
  ahora recibe `propertyIndex` y llama a `seedPropertyImages` tanto al crear
  como al re-encontrar una property (para que un re-seed sobre datos viejos sin
  imágenes también las complete). Comentario en `seedPropertyImages` documenta
  la excepción del `storage_path` con URL absoluta.
- **`progress/image_placeholders/implementation.md`** — este archivo.

## Decisiones

- **3 imágenes por property**, no 2. La feature dice "2-3" y elegí 3 para que
  la futura galería del `property_details_screen` (main + thumbnails)
  realmente parezca una galería; con 2 quedaría demasiado pobre.
- **Rotación de IDs**: cada property `i` toma 3 IDs consecutivos del pool con
  wrap: `pool[(i*3 + offset) % pool.length]` para `offset ∈ {0,1,2}`. Con un
  pool de 9 y 12 properties hay alguna repetición (esperado) pero el patrón
  evita que dos properties adyacentes compartan la misma terna.
- **`is_main`** es la primera (`position: 0`) por convención simple y
  determinista. La columna real del schema se llama `position`, no
  `display_order` como decía el brief — uso el nombre real del schema.
- **`alt_text`** se rellena con `"<título> — foto N"` para tener algo decente
  a11y-wise sin generar texto rebuscado.
- **Idempotencia por umbral, no por exact-match**: si
  `count(*) >= IMAGES_PER_PROPERTY` no inserta nada. Mismo patrón que
  `seedConversation`/`seedNotifications` del seed existente. Cubre re-corridas
  y también el caso "alguien subió fotos reales y no quiero pisarlas".
- **Helper `getImageUrl` lanza si falta env var**: alternativa era devolver
  string vacío, pero eso esconde el bug y la UI rompe en silencio. Mejor
  fallar fuerte.

## Comandos ejecutados

```bash
pnpm lint        # → 0 errores, 0 warnings
pnpm type-check  # → 0 errores
pnpm db:seed     # primera corrida: insertó 36 filas (12 properties × 3)
pnpm db:seed     # segunda corrida: imprime "ya hay 3 imágenes" por property, sin inserts
```

### Verificación de integridad (vía cliente supabase-js con service role)

```
Total filas property_images: 36
Properties con imágenes: 12
Max total por property: 3
Min total por property: 3
Properties con != 1 main: 0
Properties con > 3 imgs: 0
Properties con storage_path no-absoluto: 0
```

Todas las propiedades del seed tienen exactamente 3 imágenes, exactamente una
marcada como `is_main`, y todos los `storage_path` son URLs absolutas de
Unsplash (como debía ser para placeholders). La segunda corrida del seed no
duplicó ninguna fila.

## Cumplimiento de acceptance criteria

- [x] `next.config.ts` incluye `images.unsplash.com` y `picsum.photos` en `remotePatterns`.
- [x] `scripts/seed.ts` actualizado: inserta 3 `property_images` por property con URLs de Unsplash.
- [x] Helper `src/lib/images/get-image-url.ts` detecta URL absoluta vs path relativo y devuelve la URL correcta.
- [x] Idempotencia del seed conservada: la segunda corrida no duplica filas (verificado tanto por logs como por SQL).
