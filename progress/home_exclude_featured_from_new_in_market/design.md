# home_exclude_featured_from_new_in_market — Spec

## Descripción

Smoke test del 2026-05-26 detectó que las propiedades con `is_featured=true`
aparecen DUPLICADAS en la home pública: una vez en "Colecciones destacadas"
(que las trae explícitamente vía `getFeaturedProperties`) y otra vez en
"Nuevas en el mercado" (que las trae sin filtro de `is_featured`). El cambio
filtra `is_featured=false` SIEMPRE en `getNewInMarketProperties` para
establecer un contrato semántico complementario entre ambas secciones:
"destacadas" trae featured, "nuevas" trae el resto.

La decisión cerrada por el leader es que el filtro se aplica de manera
incondicional, incluso cuando el usuario aplica filtros (`?listing=rent`,
`?type=apartment`). Si no hay matches no-featured con esos filtros, mejor
mostrar empty state que duplicar las dos featured globales. Simplifica
el modelo mental y elimina edge cases.

## Diff aplicado

```diff
   const fetchPage = async (useWindow: boolean) => {
     let q = supabase
       .from('properties')
       .select(SELECT_COLUMNS)
       .eq('listing_status', 'active')
       .eq('property_images.is_main', true)
       .order('published_at', { ascending: false, nullsFirst: false })
       .order('id', { ascending: false })
       .limit(opts.limit + 1);

+    // Excluir destacadas SIEMPRE: la sección "Nuevas en el mercado" tiene
+    // contrato semántico complementario a "Colecciones destacadas". Sin este
+    // filtro, las featured se duplicarían en ambas secciones de la home.
+    q = q.eq('is_featured', false);
+
     if (useWindow) q = q.gte('published_at', since);
     if (opts.listingType) q = q.eq('listing_type', opts.listingType);
     if (opts.propertyType && opts.propertyType !== 'all') {
       q = q.eq('property_type', opts.propertyType as PropertyType);
     }
```

## Por qué dentro de `fetchPage` y antes del `if (useWindow)`

Hay dos puntos donde se podría haber puesto el filtro:

1. **Inicializador del builder (`let q = supabase.from(...)...`)**:
   inválido — el método builder de PostgREST devuelve un nuevo
   `PostgrestFilterBuilder` cada vez que se le aplica una operación.
   Para mantener la legibilidad y consistencia con los otros filtros
   condicionales del bloque (`gte`, `listingType`, `propertyType`), se
   mantiene el patrón `q = q.<op>` separado del inicializador.

2. **Dentro de `fetchPage`, antes del `if (useWindow)`**: la elegida. El
   fallback `includeOlderIfEmpty` re-invoca `fetchPage(false)`, así que
   cualquier filtro que viva dentro del closure se aplica automáticamente
   en AMBOS branches (ventana 30 días y ventana completa). Si pusiéramos
   el `.eq('is_featured', false)` fuera (por ejemplo en el caller, o
   solo en el primer branch), el fallback podría reintroducir featured
   y revivir el bug.

Colocarlo justo después de la inicialización del builder y antes de los
filtros condicionales deja claro que es un filtro estructural (siempre
activo), no opcional. Las cláusulas siguientes (`useWindow`, `listingType`,
`propertyType`) son condicionales y se interpretan visualmente como tales.

## Acceptance verificado

1. ✅ Query excluye `is_featured=true` vía `.eq('is_featured', false)`.
2. ✅ Fallback `includeOlderIfEmpty` preserva el filtro: vive dentro
   de `fetchPage`, se aplica en ambas invocaciones.
3. ✅ Filtro siempre activo, no condicional.
4. ✅ Sin hex literales nuevos; solo se tocó `getNewInMarketProperties`.
