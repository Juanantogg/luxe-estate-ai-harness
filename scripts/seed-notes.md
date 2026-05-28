# Seed notes — Luxe Estate

Notas operativas sobre `scripts/seed.ts`.

## Pool de imágenes Unsplash

Los placeholders del seed usan IDs estables de Unsplash con format
`photo-<timestamp>-<hash>`. Los IDs viven en la constante
`UNSPLASH_PHOTO_IDS` en `scripts/seed.ts`.

### Cómo agregar IDs nuevos

1. Buscar una foto en https://unsplash.com.
2. Abrir la imagen y copiar el ID del URL: si la URL es
   `https://unsplash.com/photos/abc-photo-1234567890-abcd1234efgh`,
   el ID es `photo-1234567890-abcd1234efgh`.
3. Agregar el ID al array `UNSPLASH_PHOTO_IDS` en `scripts/seed.ts`.
4. **No es necesario** ajustar `IMAGES_PER_PROPERTY` — la rotación
   se calcula con módulo sobre el tamaño del array.

### Cómo agregar IDs orientados por property_type

Si querés que una property muestre un exterior coherente con su tipo,
agregá el ID al pool `EXTERIOR_BY_TYPE[<type>]` además de al pool
general. El algoritmo de asignación (`pickImagesFor`) usa el primer
ID de la lista temática para la imagen `is_main`. Los tipos `condo` y
`townhouse` no tienen pool temático y hacen fallback al pool general
(comportamiento aceptado en el spec).

### Qué hacer si una URL se rompe

Síntoma: `next/image` muestra el placeholder roto o el smoke test
visual detecta una foto que no carga.

1. Verificar con `curl -I "https://images.unsplash.com/<photo-id>?w=400"`.
   Si devuelve `404 Not Found`, la foto fue removida.
2. Buscar reemplazo del mismo tipo visual en Unsplash.
3. Reemplazar el ID en `UNSPLASH_PHOTO_IDS` (o `EXTERIOR_BY_TYPE`).
4. Re-correr `pnpm db:seed` — el seed completa hasta
   `IMAGES_PER_PROPERTY` por property, así que reemplazar un ID viejo
   por uno nuevo NO impacta a properties existentes (mantienen sus
   filas insertadas previamente). Para forzar refresh de las viejas,
   borrar manualmente las filas en DB:
   `delete from property_images where storage_path like '%<photo-id-roto>%';`
   y re-correr el seed.

### Convenciones de uso

- **Cantidad por property**: `IMAGES_PER_PROPERTY = 6` (fijo, no
  variable, para mantener idempotencia simple). Si querés cambiar
  globalmente, ajustá la constante y re-corré — el seed completará
  hasta el nuevo número sin duplicar.
- **`is_main`**: exactamente UNA imagen por property (siempre
  `position=0`). El seed garantiza esto siempre que la DB no tenga
  estado roto previo (ver "Sanity check" abajo).
- **`alt_text`**: formato `<title> — foto N` (en español, N
  1-indexado). Suficientemente descriptivo para a11y básica.

## Idempotencia

El seed se puede correr **N veces sin duplicar nada**:

| Tabla                | Mecanismo                                                           |
| -------------------- | ------------------------------------------------------------------- |
| `auth.users`         | `findUserByEmail` paginado antes del `createUser`                   |
| `profiles`           | `upsert` con `onConflict: 'id'`                                     |
| `properties`         | `select where owner_id=? AND title=? maybeSingle` antes de `insert` |
| `property_images`    | `select count` y completa hasta `IMAGES_PER_PROPERTY`               |
| `property_amenities` | Solo se insertan en property nueva (no en re-run)                   |
| `favorites`          | `upsert` con `onConflict: 'user_id,property_id'`                    |
| `visits`             | `select maybeSingle` por `(user_id, property_id)` antes de insertar |
| `conversations`      | `select maybeSingle` por `(property_id, user_id, agent_id)`         |
| `messages`           | Threshold por count >= 3                                            |
| `notifications`      | Threshold por count >= 3                                            |

### Sanity check tras re-run

```sql
-- exactamente 1 main por property
select property_id, count(*) filter (where is_main) as mains
from property_images group by property_id
having count(*) filter (where is_main) <> 1;
-- → debe devolver 0 filas

-- properties tienen >= IMAGES_PER_PROPERTY imágenes
select p.id, p.title, count(pi.id) as imgs
from properties p left join property_images pi on pi.property_id = p.id
group by p.id, p.title having count(pi.id) < 6;
-- → debe devolver 0 filas
```

## Histórico de reemplazos por 404

Durante el seed `seed_more_properties` (2026-05-27) se detectaron 5 IDs
404 al hacer `curl -I` contra Unsplash. Se reemplazaron por estos:

| ID roto                            | Reemplazo                          | Categoría          |
| ---------------------------------- | ---------------------------------- | ------------------ |
| `photo-1600566753190-17f0baa2a6c8` | `photo-1564540583246-934409427776` | interior (any)     |
| `photo-1600573472591-ee6981cf35b2` | `photo-1556228720-195a672e8a03`    | interior (any)     |
| `photo-1616594328947-6c2f57bd5b3a` | `photo-1571508601891-ca5e7a713859` | interior/cocina    |
| `photo-1521335629791-ce4aec67dd47` | `photo-1568084680786-a84f91d1153c` | interior (any)     |
| `photo-1502672023488-cb5552b3a47f` | `photo-1551776235-dde6d482980b`    | apartment/interior |

Los reemplazos se verificaron con `curl -I "https://images.unsplash.com/<id>?w=400"`
devolviendo `200 OK`.

## Variables de entorno requeridas

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo en `.env` local, **nunca**
  commiteado; el seed las consume vía `dotenv`).
