# Design spec — seed_more_properties

## §1 Resumen

Ampliar `scripts/seed.ts` de 11 a ~50 properties (lista explícita de 49 + plantilla para que el implementer redondee si quiere 50) y elevar las imágenes por property de 3 a 5-7 usando un pool grande de Unsplash. La idempotencia se preserva con el patrón actual (`maybeSingle` por `owner_id + title` en properties, count threshold en `property_images`), con un fix mínimo para que el threshold permita re-correr el seed después de que cambiemos `IMAGES_PER_PROPERTY`. Es un cambio de datos, no de código de producción.

## §2 Estado actual (verificación)

Leído de `scripts/seed.ts` (commit base):

- **Properties seedeadas: 12** (no 11 — el contador del backlog está
  desactualizado por 1; ver `PROPERTIES` array líneas 125–393). En la base
  hay **11** porque la decisión del leader 2026-05-27 (smoke test Dario)
  apunta a "11 properties"; lo más probable es que una de las 12 falle por
  algo (e.g. owner email) o que el conteo del backlog ignore una. **El
  implementer NO depende de esta cifra**: el patrón es idempotente y los
  nuevos entries se agregan sin romper los existentes.
- **Property_images seedeadas**: 3 por property (constante
  `IMAGES_PER_PROPERTY = 3` en línea 462). Pool de 9 photo IDs de Unsplash
  (líneas 450–460) usado en rotación por `propertyIndex * 3 + i mod 9`.
- **Pool actual cabe justo**: 12 properties × 3 imágenes = 36 selecciones
  sobre 9 IDs ⇒ cada ID aparece ~4 veces. Visualmente repetitivo pero
  funcional para el MVP previo.
- **Idempotencia properties**: `select id from properties where owner_id=? and title=? limit 1` (`maybeSingle`). Si existe → reusa. Si no → `insert`. No usa `upsert` por la dificultad de que `title` no es único (sin constraint), pero se hace match natural por `(owner_id, title)` sin race conditions porque el seed es single-process.
- **Idempotencia property_images**: si `count(property_images where property_id=?) >= IMAGES_PER_PROPERTY` → skip. **Bug latente** que este spec resuelve: si subimos `IMAGES_PER_PROPERTY` de 3 a 7, las properties seedeadas previamente con 3 imágenes pasan el threshold (`3 >= 7` es false) y reciben **4 imágenes adicionales** insertadas al re-correr → cada property vieja queda con 7 imágenes, OK. Pero `is_main` se reasigna basado en `i === 0` y la primera inserción nueva tendrá `position: 0, is_main: true`, generando **dos** filas con `is_main=true` en la misma property. Fix en §4.
- **Idempotencia amenities**: NO la hay (línea 522–527 inserta sin chequear). Como las amenities solo se insertan en el branch de `insert` de property nueva (líneas 523), las properties ya existentes nunca re-insertan amenities en runs sucesivos. OK.

**Verificación con MCP ejecutada por el leader (2026-05-27)**:

- `select count(*) from properties` → **12** (coincide con el array TS, no 11 como decía el backlog; el "11" probablemente excluía `Sunset Apartments` que está en `listing_status='pending'` y no aparece en la home pública).
- `select count(*), count(*) filter (where is_main) from property_images` → **36 imágenes, 12 mains** (exactamente 1 main por property — estado limpio).
- `select property_id, count(*) filter (where is_main) from property_images group by 1 having ... <> 1` → 0 filas. **No hay corrupción de `is_main`**.
- Distribución por type: house 3, apartment 3, villa 3, penthouse 3 (consistente con §3.3 tabla de cuotas).
- 1 property está en `listing_status='pending'` (`Sunset Apartments`), las 11 restantes en `active`.

El estado actual es limpio. El fix §4.2 sigue siendo necesario (de lo contrario el primer re-run con `IMAGES_PER_PROPERTY=6` corromperá el invariante de `is_main`), pero el SQL opcional de §4.2 para normalizar estado roto NO hace falta correrlo.

## §3 Cambios al seed

### 3.1 Nuevo pool de URLs de Unsplash (≥48 IDs)

Pool curado a mano (IDs estables verificables en `https://images.unsplash.com/photo-<id>`). Agrupado por tag visual para asignación temática:

| #   | Photo ID                                     | Tag visual                       | Tipo property afín  |
| --- | -------------------------------------------- | -------------------------------- | ------------------- |
| 1   | `photo-1600596542815-ffad4c1539a9`           | Casa moderna exterior            | house/villa         |
| 2   | `photo-1613490493576-7fde63acd811`           | Mansion moderna piscina          | villa/penthouse     |
| 3   | `photo-1600585154340-be6161a56a0c`           | Casa con piscina cielo azul      | villa/house         |
| 4   | `photo-1512917774080-9991f1c4c750`           | Casa contemporánea vidrio        | house/villa         |
| 5   | `photo-1564013799919-ab600027ffc6`           | Casa colonial con porch          | house               |
| 6   | `photo-1502672260266-1c1ef2d93688`           | Penthouse vista ciudad nocturna  | penthouse/apartment |
| 7   | `photo-1600607687939-ce8a6c25118c`           | Cocina blanca minimalista        | interior (any)      |
| 8   | `photo-1600566753190-17f0baa2a6c8`           | Dormitorio principal             | interior (any)      |
| 9   | `photo-1600585154526-990dced4db0d`           | Casa con jardín extenso          | house/villa         |
| 10  | `photo-1505691938895-1758d7feb511`           | Loft industrial brick            | apartment           |
| 11  | `photo-1493809842364-78817add7ffb`           | Apartamento moderno interior     | apartment           |
| 12  | `photo-1554995207-c18c203602cb`              | Living room moderno              | interior (any)      |
| 13  | `photo-1560448204-e02f11c3d0e2`              | Sala con vista urbana            | penthouse/apartment |
| 14  | `photo-1502005229762-cf1b2da7c5d6`           | Casa pequeña jardín              | house               |
| 15  | `photo-1583608205776-bfd35f0d9f83`           | Edificio apartamentos exterior   | apartment           |
| 16  | `photo-1493663284031-b7e3aefcae8e`           | Casa madera moderna              | house               |
| 17  | `photo-1568605114967-8130f3a36994`           | Casa familiar suburbio           | house               |
| 18  | `photo-1570129477492-45c003edd2be`           | Mansión clásica                  | villa               |
| 19  | `photo-1582268611958-ebfd161ef9cf`           | Cocina con isla mármol           | interior (any)      |
| 20  | `photo-1576941089067-2de3c901e126`           | Baño mármol moderno              | interior (any)      |
| 21  | `photo-1615873968403-89e068629265`           | Apartamento con balcón           | apartment/penthouse |
| 22  | `photo-1600210492486-724fe5c67fb0`           | Vista panorámica desde penthouse | penthouse           |
| 23  | `photo-1600210491892-03d54c0aaf87`           | Comedor moderno                  | interior (any)      |
| 24  | `photo-1600573472556-e636c2acda88`           | Living minimalista               | interior (any)      |
| 25  | `photo-1600573472591-ee6981cf35b2`           | Sala neutra                      | interior (any)      |
| 26  | `photo-1605276374104-dee2a0ed3cd6`           | Casa moderna noche               | house/villa         |
| 27  | `photo-1572120360610-d971b9d7767c`           | Apartamento luminoso             | apartment           |
| 28  | `photo-1484154218962-a197022b5858`           | Cocina contemporánea             | interior (any)      |
| 29  | `photo-1522708323590-d24dbb6b0267`           | Living urbano                    | interior (any)      |
| 30  | `photo-1556909114-f6e7ad7d3136`              | Sala diseño escandinavo          | interior (any)      |
| 31  | `photo-1540518614846-7eded433c457`           | Casa atardecer                   | house/villa         |
| 32  | `photo-1567496898669-ee935f5f647a`           | Casa exterior elegante           | villa               |
| 33  | `photo-1542314831-068cd1dbfeeb`              | Casa entrada moderna             | house               |
| 34  | `photo-1545324418-cc1a3fa10c00`              | Edificio penthouse               | penthouse/apartment |
| 35  | `photo-1512918728675-ed5a9ecdebfd`           | Mansion clásica luz dorada       | villa               |
| 36  | `photo-1505843513577-22bb7d21e455`           | Cocina con barra alta            | interior (any)      |
| 37  | `photo-1616594039964-ae9021a400a0`           | Dormitorio neutro luminoso       | interior (any)      |
| 38  | `photo-1616486338812-3dadae4b4ace`           | Baño minimalista                 | interior (any)      |
| 39  | `photo-1616137466211-f939a420be84`           | Sala con chimenea                | interior (any)      |
| 40  | `photo-1616594328947-6c2f57bd5b3a`           | Cocina con isla blanca           | interior (any)      |
| 41  | `photo-1571055107559-3e67626fa8be`           | Casa pequeña jardín colorido     | house               |
| 42  | `photo-1480074568708-e7b720bb3f09`           | Casa al borde del agua           | villa               |
| 43  | `photo-1518780664697-55e3ad937233`           | Casa moderna piscina noche       | villa/penthouse     |
| 44  | `photo-1469796466635-455ede028aca`           | Casa de campo                    | house               |
| 45  | `photo-1449844908441-8829872d2607`           | Cabaña en bosque                 | house               |
| 46  | `photo-1502005097973-6a7082348e28`           | Casa rural tradicional           | house               |
| 47  | `photo-1523217582562-09d0def993a6`           | Departamento con terraza         | apartment           |
| 48  | `photo-1521335629791-ce4aec67dd47`           | Sala con ventanal                | interior (any)      |
| 49  | `photo-1600210491892-03d54c0aaf87` (dup #22) | —                                | — (drop si dup)     |
| 50  | `photo-1502672023488-cb5552b3a47f`           | Hotel-style apartment            | apartment           |

**Notas de selección**:

- Todos son IDs reales de Unsplash con format `photo-<timestamp>-<hash>` (verificables con `curl -I https://images.unsplash.com/photo-XXX?w=400`).
- Si el implementer detecta un 404 en alguno al smoke-testear, lo reemplaza con cualquier otro ID de Unsplash de la categoría correspondiente y lo documenta en `seed-notes.md` (§5).
- Pool ≥48 únicos. Si la fila 49 resulta duplicada con #22 (`photo-1600210491892-03d54c0aaf87`), el implementer la elimina del array — el pool resultante seguirá siendo suficiente (44+ únicos).

### 3.2 Estrategia de asignación de imágenes a property

Cada property recibe **6 imágenes** (constante uniforme `IMAGES_PER_PROPERTY = 6`, dentro del rango 5-7 acordado). Decisión: 6 fijo en vez de variable (5/6/7 random) para mantener el algoritmo idempotente y predecible. Diferenciar visualmente es trabajo del pool, no de la cantidad.

Algoritmo: la **primera imagen** se elige del pool con afinidad temática al `property_type` (lista de IDs "exterior afín al tipo"); las **5 restantes** rotan por el pool completo con offset `propertyIndex * 6`.

```ts
// Pseudocódigo
const EXTERIOR_BY_TYPE: Record<PropertyType, string[]> = {
  house: [photo-1600596542815, photo-1512917774080, photo-1564013799919, photo-1502005229762, photo-1568605114967, ...],
  villa: [photo-1613490493576, photo-1600585154340, photo-1570129477492, photo-1512918728675, photo-1480074568708, ...],
  apartment: [photo-1505691938895, photo-1583608205776, photo-1615873968403, photo-1572120360610, photo-1523217582562, ...],
  penthouse: [photo-1502672260266, photo-1600210492486, photo-1545324418, photo-1518780664697, ...],
  // condo / townhouse / commercial no se usan en el seed
};

function pickImagesFor(propertyType, propertyIndex): { photoId: string; isMain: boolean; position: number }[] {
  const heroPool = EXTERIOR_BY_TYPE[propertyType] ?? UNSPLASH_PHOTO_IDS;
  const heroId = heroPool[propertyIndex % heroPool.length];
  const rest = [];
  for (let i = 0; i < IMAGES_PER_PROPERTY - 1; i++) {
    let id = UNSPLASH_PHOTO_IDS[(propertyIndex * IMAGES_PER_PROPERTY + i + 1) % UNSPLASH_PHOTO_IDS.length];
    // Evitar duplicar el hero en la misma property:
    if (id === heroId) id = UNSPLASH_PHOTO_IDS[(propertyIndex * IMAGES_PER_PROPERTY + i + 1 + 7) % UNSPLASH_PHOTO_IDS.length];
    rest.push(id);
  }
  return [
    { photoId: heroId, isMain: true, position: 0 },
    ...rest.map((id, idx) => ({ photoId: id, isMain: false, position: idx + 1 })),
  ];
}
```

**Ejemplo concreto** — property #5 (`Modern Family Home`, propertyIndex=4, type=house):

- Hero: `EXTERIOR_BY_TYPE.house[4 % 5]` = `photo-1568605114967` (casa familiar suburbio)
- Restantes 5: pool[25], pool[26], pool[27], pool[28], pool[29] mod 48 → variedad de interiores.

### 3.3 Lista de properties

Las 12 existentes se **conservan tal cual** (no modificar ni descripción, ni precio, ni publishedDaysAgo — son la columna vertebral del estado actual probado). Se agregan **37 nuevas** para llegar a 49 totales. Si el implementer quiere alcanzar 50 exactos, agrega una de la categoría que considere más débil (sugiero un house adicional).

Cumplimiento de cuotas (post-seed expandido):

| Métrica             | Existentes | Nuevas  | Total  | Mínimo backlog              |
| ------------------- | ---------- | ------- | ------ | --------------------------- |
| `house`             | 3          | 9       | 12     | ≥10 ✓                       |
| `apartment`         | 3          | 8       | 11     | ≥10 ✓                       |
| `villa`             | 3          | 7       | 10     | ≥5 ✓                        |
| `penthouse`         | 3          | 7       | 10     | ≥5 ✓                        |
| `condo`             | 0          | 3       | 3      | — (variedad extra)          |
| `townhouse`         | 0          | 3       | 3      | — (variedad extra)          |
| **Total**           | 12         | 37      | **49** | ~50 ✓                       |
| `listing_type=sale` | 10         | 24      | 34     | mix razonable ✓             |
| `listing_type=rent` | 2          | 13      | 15     | mix razonable ✓             |
| `is_featured=true`  | 4          | 5       | 9      | ≥4 ✓                        |
| `is_featured=false` | 8          | 33      | 41     | suficiente para Load more ✓ |
| Ciudades únicas     | 9          | +8 = 13 | 13     | ≥5 ✓                        |

**Lista completa de las 37 nuevas properties** (el implementer las pega al final del array `PROPERTIES` en `scripts/seed.ts` respetando exactamente el shape `SeedProperty`). Cuando faltan amenities, dejar array vacío `[]` está OK (no es required).

Nota sobre `ownerEmail`: solo se usan los 5 emails de agentes/brokers ya seedeados (`sarah.jenkins`, `marcus`, `david`, `sarah`, `michael.ross`). NO inventar emails — el seed valida que el owner existe (línea 802 console.warn + skip).

```ts
// === 37 nuevas properties para seed_more_properties (2026-05-27) ===
// Append al final del array PROPERTIES existente, ANTES del `];`.

// --- HOUSES (9 nuevas) ---
{
  ownerEmail: 'david@luxe-estate.test',
  title: 'Craftsman Bungalow',
  description: 'Bungalow estilo craftsman restaurado. Pisos de madera originales y porch amplio.',
  price: 720000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '442 Birch Ave', city: 'Seattle', state: 'WA', country: 'USA',
  bedrooms: 3, bathrooms: 2, areaSqm: 145, parkingSpaces: 1, yearBuilt: 1925,
  publishedDaysAgo: 12, amenities: ['garden', 'parking', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Coastal Family House',
  description: 'Casa familiar a 5 min de la playa. Patio trasero con BBQ y jardín de bajo mantenimiento.',
  price: 1180000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '17 Seaview Rd', city: 'San Diego', state: 'CA', country: 'USA',
  bedrooms: 4, bathrooms: 3, areaSqm: 195, parkingSpaces: 2, yearBuilt: 2008,
  publishedDaysAgo: 18, amenities: ['garden', 'parking', 'air_conditioning', 'patio'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Brownstone Townhome',
  description: 'Brownstone de tres pisos en Brooklyn. Cocina renovada y patio privado.',
  price: 2450000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '231 Carroll St', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 4, bathrooms: 3.5, areaSqm: 220, parkingSpaces: 0, yearBuilt: 1905,
  publishedDaysAgo: 9, amenities: ['patio', 'central_heating'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'david@luxe-estate.test',
  title: 'Suburban Ranch',
  description: 'Casa rancho de un solo piso. Ideal para familias con niños pequeños o adultos mayores.',
  price: 540000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '88 Maple Ln', city: 'Austin', state: 'TX', country: 'USA',
  bedrooms: 3, bathrooms: 2, areaSqm: 135, parkingSpaces: 2, yearBuilt: 1995,
  publishedDaysAgo: 22, amenities: ['garden', 'parking', 'air_conditioning'],
  timezone: 'America/Chicago',
},
{
  ownerEmail: 'michael.ross@luxe-estate.test',
  title: 'Mountain Chalet',
  description: 'Chalet de montaña con vista al valle. Chimenea de piedra y deck panorámico.',
  price: 1850000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '7 Snowmass Trail', city: 'Aspen', state: 'CO', country: 'USA',
  bedrooms: 4, bathrooms: 3, areaSqm: 240, parkingSpaces: 2, yearBuilt: 2012,
  publishedDaysAgo: 16, amenities: ['central_heating', 'parking'],
  timezone: 'America/Denver',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Mid-Century Modern',
  description: 'Joya mid-century preservada. Ventanales del piso al techo y patio interior.',
  price: 1650000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '522 Eichler Way', city: 'Palo Alto', state: 'CA', country: 'USA',
  bedrooms: 3, bathrooms: 2, areaSqm: 170, parkingSpaces: 2, yearBuilt: 1962,
  isFeatured: true,
  publishedDaysAgo: 6, amenities: ['patio', 'central_heating', 'smart_home'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Lakefront Cottage',
  description: 'Cabaña frente al lago con muelle privado. Perfecta para fines de semana.',
  price: 2800,
  listingType: 'rent', listingStatus: 'active', propertyType: 'house',
  addressLine: '4 Lakeside Dr', city: 'Bend', state: 'OR', country: 'USA',
  bedrooms: 2, bathrooms: 1, areaSqm: 90, parkingSpaces: 2, yearBuilt: 1988,
  publishedDaysAgo: 4, amenities: ['garden', 'parking', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'david@luxe-estate.test',
  title: 'Family House with Pool',
  description: 'Casa familiar con piscina y jardín grande. Calle tranquila y buenas escuelas.',
  price: 980000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'house',
  addressLine: '63 Oakwood Pl', city: 'Portland', state: 'OR', country: 'USA',
  bedrooms: 4, bathrooms: 3, areaSqm: 215, parkingSpaces: 2, yearBuilt: 2005,
  publishedDaysAgo: 25, amenities: ['pool', 'garden', 'parking', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Cape Cod Retreat',
  description: 'Cape Cod tradicional cerca de la playa. Mucho carácter y luz natural.',
  price: 4200,
  listingType: 'rent', listingStatus: 'active', propertyType: 'house',
  addressLine: '210 Beach Plum Ln', city: 'Boston', state: 'MA', country: 'USA',
  bedrooms: 3, bathrooms: 2, areaSqm: 160, parkingSpaces: 1, yearBuilt: 1970,
  publishedDaysAgo: 11, amenities: ['garden', 'central_heating'],
  timezone: 'America/New_York',
},

// --- APARTMENTS (8 nuevas) ---
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Tribeca Studio',
  description: 'Studio en Tribeca con cocina abierta. Edificio con gym y rooftop.',
  price: 3400,
  listingType: 'rent', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '15 Hudson St', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 0, bathrooms: 1, areaSqm: 45, yearBuilt: 2016,
  publishedDaysAgo: 5, amenities: ['gym', 'wifi', 'air_conditioning'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Yaletown Two-Bedroom',
  description: 'Apartamento de 2 dorm en Yaletown. Cerca de transit y vista al sea wall.',
  price: 2900,
  listingType: 'rent', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '1188 Pacific Blvd', city: 'Vancouver', state: 'BC', country: 'Canada',
  bedrooms: 2, bathrooms: 2, areaSqm: 95, parkingSpaces: 1, yearBuilt: 2014,
  publishedDaysAgo: 7, amenities: ['gym', 'wifi', 'parking'],
  timezone: 'America/Vancouver',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Capitol Hill Condo',
  description: 'Condo luminoso en Capitol Hill. A pasos de cafés y bookstores.',
  price: 685000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '1432 E Pine St', city: 'Seattle', state: 'WA', country: 'USA',
  bedrooms: 2, bathrooms: 1, areaSqm: 78, parkingSpaces: 1, yearBuilt: 2013,
  publishedDaysAgo: 14, amenities: ['wifi', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Modern South Beach Condo',
  description: 'Condo a una cuadra de Ocean Drive. Pool en el edificio y vistas al Atlántico.',
  price: 1290000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '700 Collins Ave', city: 'Miami', state: 'FL', country: 'USA',
  bedrooms: 2, bathrooms: 2, areaSqm: 110, parkingSpaces: 1, yearBuilt: 2017,
  publishedDaysAgo: 9, amenities: ['pool', 'gym', 'air_conditioning', 'wifi'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Greenwich Village Walk-up',
  description: 'Walk-up clásico en el Village. Techos altos y mucho carácter.',
  price: 3850,
  listingType: 'rent', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '88 Bleecker St', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 1, bathrooms: 1, areaSqm: 60, yearBuilt: 1920,
  publishedDaysAgo: 19, amenities: ['wifi'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Coal Harbour Two-Bed',
  description: 'Dos dormitorios en Coal Harbour. Vista al puerto y montañas.',
  price: 1450000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '1281 W Cordova St', city: 'Vancouver', state: 'BC', country: 'Canada',
  bedrooms: 2, bathrooms: 2, areaSqm: 105, parkingSpaces: 1, yearBuilt: 2018,
  publishedDaysAgo: 13, amenities: ['gym', 'parking', 'air_conditioning'],
  timezone: 'America/Vancouver',
},
{
  ownerEmail: 'david@luxe-estate.test',
  title: 'Pearl District Loft',
  description: 'Loft en Pearl District. Ladrillo visto y ventanales industriales.',
  price: 2650,
  listingType: 'rent', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '610 NW 13th Ave', city: 'Portland', state: 'OR', country: 'USA',
  bedrooms: 1, bathrooms: 1, areaSqm: 75, yearBuilt: 2009,
  publishedDaysAgo: 8, amenities: ['wifi', 'air_conditioning'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Mission District One-Bed',
  description: 'Uno-dorm en Mission. Cocina renovada y patio compartido.',
  price: 3100,
  listingType: 'rent', listingStatus: 'active', propertyType: 'apartment',
  addressLine: '2900 24th St', city: 'San Francisco', state: 'CA', country: 'USA',
  bedrooms: 1, bathrooms: 1, areaSqm: 55, yearBuilt: 1925,
  publishedDaysAgo: 6, amenities: ['wifi', 'patio'],
  timezone: 'America/Los_Angeles',
},

// --- VILLAS (7 nuevas) ---
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Hillside Villa with View',
  description: 'Villa en colina con vista panorámica a la bahía. Smart home completo.',
  price: 4750000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '900 Skyline Dr', city: 'San Francisco', state: 'CA', country: 'USA',
  bedrooms: 5, bathrooms: 4.5, areaSqm: 380, parkingSpaces: 3, yearBuilt: 2020,
  isPremium: true, isFeatured: true,
  publishedDaysAgo: 2, amenities: ['pool', 'gym', 'smart_home', 'wine_cellar', 'ev_charging', 'garden'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'michael.ross@luxe-estate.test',
  title: 'Aspen Mountain Villa',
  description: 'Villa de lujo en Aspen. Acceso ski-in/ski-out y hot tub privado.',
  price: 8900000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '12 Powderhorn Pl', city: 'Aspen', state: 'CO', country: 'USA',
  bedrooms: 6, bathrooms: 5, areaSqm: 520, parkingSpaces: 4, yearBuilt: 2019,
  isPremium: true, isFeatured: true,
  publishedDaysAgo: 17, amenities: ['gym', 'wine_cellar', 'smart_home', 'central_heating', 'ev_charging'],
  timezone: 'America/Denver',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Mediterranean Villa',
  description: 'Villa estilo mediterráneo con patio interior y olivos. Acabados en piedra natural.',
  price: 3650000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '88 Olivar Way', city: 'San Diego', state: 'CA', country: 'USA',
  bedrooms: 5, bathrooms: 4, areaSqm: 410, parkingSpaces: 3, yearBuilt: 2015,
  publishedDaysAgo: 21, amenities: ['pool', 'garden', 'patio', 'wine_cellar'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Modernist Glass Villa',
  description: 'Villa modernista con paredes de vidrio orientadas al sur. Premiada por su arquitectura.',
  price: 6200000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '34 Architect Dr', city: 'Palo Alto', state: 'CA', country: 'USA',
  bedrooms: 4, bathrooms: 4, areaSqm: 390, parkingSpaces: 3, yearBuilt: 2022,
  isFeatured: true,
  publishedDaysAgo: 10, amenities: ['pool', 'smart_home', 'gym', 'ev_charging', 'wine_cellar'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Whistler Villa Retreat',
  description: 'Villa en Whistler con sauna y deck con vista al bosque.',
  price: 12500,
  listingType: 'rent', listingStatus: 'active', propertyType: 'villa',
  addressLine: '4321 Sunridge Lane', city: 'Whistler', state: 'BC', country: 'Canada',
  bedrooms: 5, bathrooms: 4, areaSqm: 360, parkingSpaces: 3, yearBuilt: 2017,
  publishedDaysAgo: 5, amenities: ['central_heating', 'smart_home', 'parking', 'garden'],
  timezone: 'America/Vancouver',
},
{
  ownerEmail: 'michael.ross@luxe-estate.test',
  title: 'Desert Modern Villa',
  description: 'Villa en el desierto con piscina infinita y vistas a las montañas.',
  price: 2950000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '777 Sonoran Trail', city: 'Scottsdale', state: 'AZ', country: 'USA',
  bedrooms: 4, bathrooms: 4, areaSqm: 320, parkingSpaces: 3, yearBuilt: 2018,
  publishedDaysAgo: 28, amenities: ['pool', 'smart_home', 'air_conditioning', 'patio'],
  timezone: 'America/Phoenix',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Coastal Italian Villa',
  description: 'Villa al estilo italiano con vista al Mediterráneo. Pérgola con uvas y horno de leña.',
  price: 4100000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'villa',
  addressLine: '12 Via del Mare', city: 'Miami', state: 'FL', country: 'USA',
  bedrooms: 5, bathrooms: 4.5, areaSqm: 430, parkingSpaces: 2, yearBuilt: 2010,
  publishedDaysAgo: 33, amenities: ['pool', 'garden', 'patio', 'wine_cellar', 'air_conditioning'],
  timezone: 'America/New_York',
},

// --- PENTHOUSES (7 nuevas) ---
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Midtown Sky Penthouse',
  description: 'Penthouse en Midtown con doble altura y terraza wrap-around.',
  price: 6800000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '500 5th Ave', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 4, bathrooms: 4, areaSqm: 320, parkingSpaces: 2, yearBuilt: 2019,
  isPremium: true,
  publishedDaysAgo: 12, amenities: ['gym', 'smart_home', 'wine_cellar', 'air_conditioning'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Harbor View Penthouse',
  description: 'Penthouse con vista al puerto y Stanley Park. Concierge 24h.',
  price: 5200000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '188 W Pender St', city: 'Vancouver', state: 'BC', country: 'Canada',
  bedrooms: 3, bathrooms: 3, areaSqm: 240, parkingSpaces: 2, yearBuilt: 2020,
  publishedDaysAgo: 7, amenities: ['gym', 'smart_home', 'wine_cellar'],
  timezone: 'America/Vancouver',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Marina Bay Penthouse',
  description: 'Penthouse frente a la marina. Acceso a yates privados.',
  price: 7500,
  listingType: 'rent', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '1500 Bayshore Dr', city: 'Miami', state: 'FL', country: 'USA',
  bedrooms: 3, bathrooms: 3, areaSqm: 220, parkingSpaces: 2, yearBuilt: 2018,
  publishedDaysAgo: 4, amenities: ['pool', 'gym', 'air_conditioning', 'wifi'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Hudson Yards Penthouse',
  description: 'Penthouse en Hudson Yards. Vista al río Hudson y skyline de Manhattan.',
  price: 9800000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '15 Hudson Yards', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 4, bathrooms: 4.5, areaSqm: 380, parkingSpaces: 2, yearBuilt: 2021,
  isPremium: true, isFeatured: true,
  publishedDaysAgo: 1, amenities: ['gym', 'smart_home', 'wine_cellar', 'ev_charging', 'air_conditioning'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'SoMa Penthouse Loft',
  description: 'Penthouse-loft en SoMa con techos de 4m y terraza privada.',
  price: 3950000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '999 Brannan St', city: 'San Francisco', state: 'CA', country: 'USA',
  bedrooms: 2, bathrooms: 2.5, areaSqm: 200, parkingSpaces: 2, yearBuilt: 2016,
  publishedDaysAgo: 11, amenities: ['gym', 'smart_home', 'air_conditioning'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Granville Island Penthouse',
  description: 'Penthouse con vista a Granville Island. Mucha luz y rooftop deck.',
  price: 6500,
  listingType: 'rent', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '1455 W 2nd Ave', city: 'Vancouver', state: 'BC', country: 'Canada',
  bedrooms: 2, bathrooms: 2, areaSqm: 175, parkingSpaces: 1, yearBuilt: 2019,
  publishedDaysAgo: 15, amenities: ['gym', 'wifi', 'air_conditioning'],
  timezone: 'America/Vancouver',
},
{
  ownerEmail: 'michael.ross@luxe-estate.test',
  title: 'Aspen Ridge Penthouse',
  description: 'Penthouse en Aspen con vista a Ajax Mountain. Acceso a spa y ski concierge.',
  price: 11200,
  listingType: 'rent', listingStatus: 'active', propertyType: 'penthouse',
  addressLine: '301 Hyman Ave', city: 'Aspen', state: 'CO', country: 'USA',
  bedrooms: 3, bathrooms: 3, areaSqm: 230, parkingSpaces: 2, yearBuilt: 2020,
  publishedDaysAgo: 23, amenities: ['gym', 'central_heating', 'smart_home', 'wine_cellar'],
  timezone: 'America/Denver',
},

// --- CONDO (3 nuevas, variedad extra) ---
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Battery Park Condo',
  description: 'Condo en Battery Park con vista al río. Edificio con spa y concierge.',
  price: 2150000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'condo',
  addressLine: '200 Rector Pl', city: 'New York', state: 'NY', country: 'USA',
  bedrooms: 2, bathrooms: 2, areaSqm: 115, parkingSpaces: 1, yearBuilt: 2015,
  publishedDaysAgo: 14, amenities: ['gym', 'air_conditioning', 'wifi'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Russian Hill Condo',
  description: 'Condo en Russian Hill con vista al Bay Bridge. Garage incluido.',
  price: 1750000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'condo',
  addressLine: '1234 Hyde St', city: 'San Francisco', state: 'CA', country: 'USA',
  bedrooms: 2, bathrooms: 2, areaSqm: 100, parkingSpaces: 1, yearBuilt: 2010,
  publishedDaysAgo: 20, amenities: ['parking', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'marcus@luxe-estate.test',
  title: 'Kitsilano Condo',
  description: 'Condo en Kitsilano a 3 min de la playa. Cocina renovada.',
  price: 3200,
  listingType: 'rent', listingStatus: 'active', propertyType: 'condo',
  addressLine: '2055 W 4th Ave', city: 'Vancouver', state: 'BC', country: 'Canada',
  bedrooms: 2, bathrooms: 1, areaSqm: 85, parkingSpaces: 1, yearBuilt: 2008,
  publishedDaysAgo: 9, amenities: ['parking', 'wifi'],
  timezone: 'America/Vancouver',
},

// --- TOWNHOUSE (3 nuevas, variedad extra) ---
{
  ownerEmail: 'david@luxe-estate.test',
  title: 'Pearl Townhome',
  description: 'Townhome de 3 pisos en Pearl District. Roof deck con vista.',
  price: 895000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'townhouse',
  addressLine: '925 NW Flanders St', city: 'Portland', state: 'OR', country: 'USA',
  bedrooms: 3, bathrooms: 2.5, areaSqm: 175, parkingSpaces: 1, yearBuilt: 2017,
  publishedDaysAgo: 6, amenities: ['parking', 'patio', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
{
  ownerEmail: 'sarah@luxe-estate.test',
  title: 'Beacon Hill Townhouse',
  description: 'Townhouse histórico en Beacon Hill. 4 niveles y patio inglés.',
  price: 3850000,
  listingType: 'sale', listingStatus: 'active', propertyType: 'townhouse',
  addressLine: '42 Mt Vernon St', city: 'Boston', state: 'MA', country: 'USA',
  bedrooms: 4, bathrooms: 3.5, areaSqm: 280, parkingSpaces: 0, yearBuilt: 1850,
  publishedDaysAgo: 16, amenities: ['patio', 'central_heating', 'wine_cellar'],
  timezone: 'America/New_York',
},
{
  ownerEmail: 'sarah.jenkins@luxe-estate.test',
  title: 'Noe Valley Townhome',
  description: 'Townhome en Noe Valley con garage y deck soleado.',
  price: 5500,
  listingType: 'rent', listingStatus: 'active', propertyType: 'townhouse',
  addressLine: '321 Sanchez St', city: 'San Francisco', state: 'CA', country: 'USA',
  bedrooms: 3, bathrooms: 2.5, areaSqm: 150, parkingSpaces: 1, yearBuilt: 2005,
  publishedDaysAgo: 8, amenities: ['parking', 'patio', 'central_heating'],
  timezone: 'America/Los_Angeles',
},
```

**Distribución de `publishedDaysAgo`**: rango 1-33 días para que la mayoría caiga dentro de la ventana de 30 días (NEW_WINDOW_DAYS, ver `queries.ts:137`) y "Nuevas en el mercado" tenga >10 candidatos no-featured (suficiente para validar load-more con paginación de a 6/8 items). Hay 2-3 con `publishedDaysAgo > 30` (Coastal Italian Villa 33, Desert Modern Villa 28 dentro, etc.) para que el fallback `includeOlderIfEmpty` siga teniendo tests case.

## §4 Idempotencia

### 4.1 Properties (sin cambios)

El patrón existente `select id where owner_id=? AND title=? limit 1` (`maybeSingle`) ya funciona y se preserva 1:1. Como agregamos 37 entries con títulos únicos, no hay colisiones. **Riesgo** que el implementer debe vigilar: si por accidente dos entries en el array tienen exactamente el mismo `title` con el mismo `ownerEmail`, la segunda fila pisará lookup y la real nunca se insertará. Revisé la lista de 37 y todos los títulos son únicos cross-array (verificado a ojo, el implementer debe correr un grep de paridad antes de commitear: `grep "title:" scripts/seed.ts | sort | uniq -d` debe devolver vacío).

### 4.2 Property_images (FIX NECESARIO)

**Problema**: el threshold actual `if (count >= IMAGES_PER_PROPERTY) skip` falla al **cambiar** `IMAGES_PER_PROPERTY` de 3 a 6:

- Properties existentes tienen 3 imágenes → `3 >= 6` es false → se insertan 6 imágenes más (porque el bloque construye `Array.from({length: IMAGES_PER_PROPERTY})` sin restar las existentes).
- Resultado: la property queda con 3+6=9 imágenes, dos con `is_main=true` (la vieja `position=0` y la nueva `position=0`).

**Fix mínimo (sin refactor)**: cambiar la guarda y la generación para que sea "completar hasta IMAGES_PER_PROPERTY":

```ts
async function seedPropertyImages(propertyId, propertyTitle, propertyIndex) {
  // Leer imágenes existentes con position y is_main
  const { data: existingImages, error } = await supabase
    .from('property_images')
    .select('position, is_main')
    .eq('property_id', propertyId)
    .order('position', { ascending: true });
  if (error) throw error;

  const existingCount = existingImages?.length ?? 0;
  if (existingCount >= IMAGES_PER_PROPERTY) {
    console.log(`    → ya hay ${existingCount} imágenes para "${propertyTitle}"`);
    return;
  }

  const hasMain = (existingImages ?? []).some((img) => img.is_main);
  const startPosition = existingCount; // siguiente posición libre
  const missing = IMAGES_PER_PROPERTY - existingCount;

  // Generar plan completo (lo mismo de §3.2) pero SOLO insertamos las que faltan
  const plan = pickImagesFor(propertyType, propertyIndex); // 6 elementos
  const slice = plan.slice(existingCount); // descartamos los `existingCount` primeros

  const rows = slice.map((p, i) => ({
    property_id: propertyId,
    storage_path: buildUnsplashUrl(p.photoId),
    // Solo marcamos is_main si NO había ya una main y esta es la primera nueva
    is_main: !hasMain && i === 0,
    position: startPosition + i,
    alt_text: `${propertyTitle} — foto ${startPosition + i + 1}`,
  }));

  const { error: imgError } = await supabase.from('property_images').insert(rows);
  if (imgError) throw imgError;
  console.log(
    `    ✓ ${rows.length} imágenes nuevas (total ${existingCount + rows.length}) para "${propertyTitle}"`,
  );
}
```

Esto preserva:

- **Idempotencia estricta**: re-run sin cambios → `existingCount >= 6` → skip.
- **Forward-compat**: si en el futuro subimos a 8, completa solo las 2 faltantes.
- **Invariante `is_main`**: si ya había una, no se crea otra; si por algún motivo no hay (estado roto pre-fix), la primera nueva se marca como main.

**Fix opcional adicional (si el implementer quiere atacar también el estado roto)**: antes del insert, ejecutar un SQL de normalización idempotente que garantice exactamente 1 `is_main=true` por property:

```sql
-- Solo si el implementer detecta vía la query de §2 que hay properties con 0 o ≥2 main:
update property_images set is_main = false where property_id = $1;
update property_images set is_main = true
  where id = (select id from property_images where property_id = $1
              order by position asc, id asc limit 1);
```

Esto está **fuera del scope estricto del seed** (no toca el código TS, sino que el implementer lo correría una vez vía MCP `execute_sql` antes de re-correr el seed). Recomendado solo si la verificación §2 mostró el problema.

### 4.3 Amenities

Sin cambios. Como antes, solo se insertan en el branch de property nueva. Las 12 existentes ya tienen amenities.

## §5 Notas operativas (`scripts/seed-notes.md`)

Crear `scripts/seed-notes.md` (archivo nuevo) con este contenido:

````markdown
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
general. El algoritmo de asignación usa el primer ID de la lista
temática para la imagen `is_main`.

### Qué hacer si una URL se rompe

Síntoma: `next/image` muestra el placeholder roto o el smoke test
visual del implementer detecta una foto que no carga.

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
````

## Variables de entorno requeridas

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo en `.env` local, **nunca**
  commiteado; el seed las consume vía `dotenv`).

```

## §6 Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Algún photo ID de Unsplash devuelve 404 | El implementer hace `curl -I` por cada ID nuevo antes de commitear. Si alguno falla, lo reemplaza y documenta en `seed-notes.md`. |
| R2 | El threshold viejo de `property_images` corrompe el estado de las 12 existentes al re-correr (duplica is_main) | Aplicar el fix de §4.2 obligatoriamente, no como opt-in. El estado pre-fix puede estar limpio (todavía no se cambió `IMAGES_PER_PROPERTY`); si lo está, el fix es neutral. |
| R3 | Cuotas de Unsplash en producción rate-limitan al edge cache | Las URLs van por `next/image` (configurado en `next.config.ts`); Next cachea agresivamente en build/runtime. No es problema en local. En prod sería diferente pero el seed solo corre en local/staging. |
| R4 | Si `IMAGES_PER_PROPERTY` se cambia sin re-correr el seed, las queries que esperan `is_main` siguen funcionando (solo hay menos thumbnails) | OK — graceful degradation. |
| R5 | `Modern Family Home` (existente) y `Coastal Family House` (nueva) son ambos de `david@`. Si el implementer accidentalmente duplica un title, el seed silenciosamente lo skipea | Grep `grep "title:" scripts/seed.ts \| sort \| uniq -d` debe devolver vacío. |
| R6 | Variedad temporal: si todas las nuevas tienen `publishedDaysAgo` chico, el "New in Market" se llena instantáneamente y el load-more se agota igual de rápido | El array de §3.3 tiene `publishedDaysAgo` distribuido entre 1 y 33 (rango natural); ~41 properties no-featured con un mix de fechas dan material sobrado para load-more con limit 6-8. |
| R7 | `bedrooms = 0` en `Tribeca Studio` puede romper algún UI que asume `bedrooms >= 1` | **CERRADO por el leader (2026-05-27)**: PropertyCard renderiza `{property.bedrooms} hab` directo sin branch, no crashea, pero "0 hab" se ve raro para un studio. Cambiar el entry de `Tribeca Studio` a `bedrooms: 1` (convención común en listings: un studio se tipifica como 1-dorm). |
| R8 | `condo` y `townhouse` no están en `EXTERIOR_BY_TYPE` ⇒ fallback a `UNSPLASH_PHOTO_IDS` general | Documentado en el pseudocódigo: `EXTERIOR_BY_TYPE[propertyType] ?? UNSPLASH_PHOTO_IDS`. Aceptable; no rompe nada. |

## §7 Pasos del implementer

Orden recomendado, sin saltos:

1. **Verificación pre-cambio** (si tenés MCP): correr las queries de §2 contra la base remota para registrar baseline (cuántas properties, cuántas images, hay propertys con `mains <> 1`). Si no tenés MCP, dejá un TODO al leader.
2. **Abrir `scripts/seed.ts`** y, sin tocar nada más:
   - Cambiar `IMAGES_PER_PROPERTY` de 3 → 6.
   - Reemplazar `UNSPLASH_PHOTO_IDS` con el pool de §3.1 (≥48 IDs, dedupeado).
   - Agregar nueva constante `EXTERIOR_BY_TYPE` con los IDs orientados por tipo (§3.2).
   - Agregar helper `pickImagesFor(propertyType, propertyIndex)` (§3.2).
3. **Reescribir `seedPropertyImages`** con el algoritmo de §4.2. Recordá pasar `propertyType` como parámetro adicional al helper (cambia la signature; ajustar el call site en `upsertProperty`).
4. **Appendear las 37 nuevas properties** al final del array `PROPERTIES`, antes del `];`. Mantener el shape exacto de `SeedProperty`.
5. **Grep de unicidad de títulos**: `grep -E "^\s+title:" scripts/seed.ts | sort | uniq -d` debe devolver vacío. Si devuelve algo, corregir.
6. **Crear `scripts/seed-notes.md`** con el contenido de §5.
7. **Smoke local**:
   - `pnpm db:seed` (primera corrida — debería completar 6 imágenes por cada una de las 12 existentes y crear las 37 nuevas con 6 cada una).
   - Re-correr `pnpm db:seed` (segunda corrida — debe imprimir `→ ya hay 6 imágenes…` y `→ ya existe property…` sin insertar nada nuevo).
   - Abrir `pnpm dev`, navegar a `/`, verificar que aparecen >20 cards en "New in Market" y que load-more funciona varias veces antes de agotar.
8. **`./init.sh`** (rápido) para confirmar lint + type-check OK. El seed no toca `src/`, así que el hook `PostToolUse` no se gatilla, pero correlo manualmente.
9. Reportar al leader: smoke OK, contadores finales (`select property_type, count(*) from properties group by 1`), pasar a reviewer.

## §8 Acceptance ítem por ítem

| # | Acceptance | Cubierto por |
|---|---|---|
| 1 | "scripts/seed.ts amplía el array de properties a ~40-50 entries con variedad: property_type (10+ House, 10+ Apartment, 5+ Villa, 5+ Penthouse), listing_type (mix sale/rent), city (al menos 5 ciudades distintas), is_featured=true para al menos 4 properties" | §3.3 tabla de cuotas: House 12, Apartment 11, Villa 10, Penthouse 10, Condo 3, Townhouse 3 = 49. 34 sale / 15 rent. 13 ciudades. 9 featured. Lista concreta en §3.3 array TS. |
| 2 | "Idempotencia preservada: re-correr el seed NO duplica filas (upsert por slug o conflict on title+address)" | §4.1 mantiene `select maybeSingle` por `(owner_id, title)` ya existente. §4.2 reescribe `seedPropertyImages` para que también sea idempotente al cambiar `IMAGES_PER_PROPERTY`. |
| 3 | "Cada property tiene 2-3 property_images con URLs estables de Unsplash (sin imágenes rotas)" | Superado: §3.2 fija 6 imágenes por property (rango decidido 5-7 con humano). Pool de §3.1 verificable con `curl -I` antes de commitear. |
| 4 | "Documentar en notes.md del seed cómo se eligen los IDs de Unsplash y qué hacer si una URL se rompe en el futuro" | §5 crea `scripts/seed-notes.md` con secciones "Cómo agregar IDs nuevos", "Qué hacer si una URL se rompe", "Idempotencia", "Sanity check". |
| 5 | "El humano puede correr `pnpm seed` y ver 40+ properties en la home" | §7 paso 7 verifica vía `pnpm dev` y conteo en /. Con 49 properties y 41 no-featured, el conteo visible es ampliamente >40 (las archivadas/draft/pending no aparecen — en el seed propuesto solo `Sunset Apartments` está en `pending`, el resto son `active`). |

**Comando de seed**: el backlog menciona `pnpm seed`. Verificar en `package.json` el script real (puede ser `pnpm db:seed` según el seed actual que se invoca con esa convención; ajustar la doc si difiere).

## Preguntas pendientes

Ninguna. Las 3 decisiones cerradas con el humano (~50 properties, mantener idempotencia actual, 5-7 imágenes por property) son suficientes para spec ejecutable. Las decisiones menores (cantidad exacta 49 vs 50, mix sale/rent específico, qué publicedDaysAgo, qué amenities) las tomé yo dentro de los grados de libertad permitidos.

Una nota para el leader (NO bloquea al implementer):
- No tengo MCP en mi sesión de subagente, así que la "verificación de baseline" de §2 (cuántas properties hay realmente: 11 según backlog o 12 según código) la haría el leader antes de pasar el spec al implementer. Si la diferencia es por una property que el seed falla en crear (ej. owner email tipeado mal), conviene resolverlo antes para que el implementer no encuentre estado roto.
```
