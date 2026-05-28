# Design spec — topnav_active_link_listing_sale

> Feature `requires_approval: true` — este spec pasa por aprobación humana
> antes de implementarse. Incluye Alternativas, Riesgos y Criterios de
> aceptación verificables como bloques obligatorios.

## Contexto

Smoke test 2026-05-26 detectó inconsistencia entre el TopNav y el
`ListingTypeToggle` de la home:

- **TopNav** define 2 links en la variante `app`:
  - `'Comprar'` → `href='/'`
  - `'Rentar'` → `href='/?listing=rent'`
- **ListingTypeToggle** introduce 3 estados:
  - `all` → URL `/` (sin query)
  - `sale` → URL `/?listing=sale`
  - `rent` → URL `/?listing=rent`
- El helper `isLinkActive` (`src/lib/nav/active-link.ts`) hace match
  **exacto** del param `listing`. La línea 26 es:
  `return linkListing === currentListing;`

### Bug observado

| Toggle clickeado | URL resultante   | TopNav 'Comprar' | TopNav 'Rentar' | Correcto? |
| ---------------- | ---------------- | ---------------- | --------------- | --------- |
| Todas            | `/`              | activo           | inactivo        | sí        |
| Comprar          | `/?listing=sale` | **inactivo**     | inactivo        | **no**    |
| Rentar           | `/?listing=rent` | inactivo         | activo          | sí        |

Cuando el user clickea **'Comprar'** en el toggle interno, `linkListing`
del TopNav 'Comprar' es `null` (porque su `href='/'` no declara query) y
`currentListing` es `'sale'`. La comparación `null === 'sale'` da `false`,
por lo que ningún link del TopNav queda marcado activo. UX defectuoso: el
usuario está claramente filtrando "Comprar" pero la nav superior no lo
refleja.

## Decisión cerrada por el humano (2026-05-27)

**Opción B: Relajar `isLinkActive`.**

- TopNav 'Comprar' **sigue** navegando a `/` (URL limpia para el caso
  común).
- El helper se modifica para que un link **sin** `listing` declarado
  matchee tanto `/` (sin query) como `/?listing=sale`.
- El link 'Rentar' (`href='/?listing=rent'`) **sigue** exigiendo match
  exacto, así como cualquier link futuro que declare `listing=sale` o
  `listing=rent`.

### Modelo semántico final

| href             | linkListing declarado | currentListing en URL | ¿activo?       |
| ---------------- | --------------------- | --------------------- | -------------- |
| `/`              | `null` (no declarado) | `null`                | **sí**         |
| `/`              | `null` (no declarado) | `'sale'`              | **sí** (nuevo) |
| `/`              | `null` (no declarado) | `'rent'`              | no             |
| `/?listing=sale` | `'sale'`              | `null`                | no             |
| `/?listing=sale` | `'sale'`              | `'sale'`              | sí             |
| `/?listing=sale` | `'sale'`              | `'rent'`              | no             |
| `/?listing=rent` | `'rent'`              | `null`                | no             |
| `/?listing=rent` | `'rent'`              | `'sale'`              | no             |
| `/?listing=rent` | `'rent'`              | `'rent'`              | sí             |

Resumen: si el link **no** declara `listing`, queda activo en
`{ null, 'sale' }`. Si el link **sí** lo declara, exige match exacto.

## Referencia visual

No aplica mockup nuevo. La feature es funcional: el visual del TopNav y
los links activos ya fue definido en `home_discover_screen`. Lo único que
cambia es **cuándo** se aplica el estilo activo.

- Mockup TopNav: `docs/designs/home_discover_screen/screen.png`
- HTML referencia: `docs/designs/home_discover_screen/code.html`

## Análisis del helper actual

`src/lib/nav/active-link.ts` líneas 19-27:

```ts
if (pathHref === '/') {
  if (pathname !== '/') return false;
  // Si el link declara `listing`, exigimos match exacto. Si no lo declara,
  // exigimos que el query actual tampoco lo tenga (así "Comprar" no
  // queda activo cuando hay ?listing=rent).
  const linkListing = linkParams.get('listing');
  const currentListing = currentParams.get('listing');
  return linkListing === currentListing;
}
```

La condición que falla es la línea 26: cuando `linkListing === null` y
`currentListing === 'sale'`, devuelve `false`. La intención original (ver
comentario líneas 21-23) fue evitar que 'Comprar' quedara activo cuando
hay `?listing=rent` — eso sigue siendo correcto. Lo que no se previó fue
el tercer estado `?listing=sale`, que semánticamente **es** "Comprar".

La decisión B es mínima invasión porque:

1. Toca solo el helper (32 líneas, función pura).
2. No requiere cambios en TopNav config: `href='/'` se preserva (URL
   limpia para el caso default).
3. No requiere cambios en `ListingTypeToggle`: sigue siendo su propio
   filtro con 3 estados sobre la sección "New in Market".
4. No rompe el comportamiento para `'Rentar'` ni para rutas no-home.

## Propuesta de cambio

### Pseudocódigo del nuevo helper

```ts
export function isLinkActive(pathname: string, search: string, href: string): boolean {
  const [pathHref = '/', queryHref = ''] = href.split('?');
  const linkParams = new URLSearchParams(queryHref);
  const currentParams = new URLSearchParams(search);

  if (pathHref === '/') {
    if (pathname !== '/') return false;
    const linkListing = linkParams.get('listing');
    const currentListing = currentParams.get('listing');

    // Link no declara `listing` (caso "Comprar"): activo cuando
    // currentListing es `null` (default "Todas") o `'sale'` (toggle
    // "Comprar"). NO activo cuando currentListing es `'rent'`.
    if (linkListing === null) {
      return currentListing === null || currentListing === 'sale';
    }

    // Link sí declara `listing` (caso "Rentar" o un hipotético link
    // explícito a /?listing=sale): exige match exacto.
    return linkListing === currentListing;
  }

  if (pathname === pathHref) return true;
  return pathname.startsWith(`${pathHref}/`);
}
```

### Diff conceptual

Reemplazar la línea 26 (`return linkListing === currentListing;`) por el
bloque:

```ts
if (linkListing === null) {
  return currentListing === null || currentListing === 'sale';
}
return linkListing === currentListing;
```

Más actualización del comentario JSDoc y del comentario inline (líneas
21-23) para reflejar la nueva semántica. Ver § Documentación.

## Casos de prueba

Tabla canónica que el implementer y el reviewer deben validar.
Pathname + search → expected resultado para cada uno de los 2 links del
TopNav (`'/'` y `'/?listing=rent'`).

| #   | pathname  | search           | href             | expected | Razón                                        |
| --- | --------- | ---------------- | ---------------- | -------- | -------------------------------------------- |
| 1   | `/`       | `""`             | `/`              | `true`   | default, 'Comprar' activo                    |
| 2   | `/`       | `""`             | `/?listing=rent` | `false`  | default, 'Rentar' inactivo                   |
| 3   | `/`       | `"listing=sale"` | `/`              | `true`   | **nuevo**: toggle Comprar → 'Comprar' activo |
| 4   | `/`       | `"listing=sale"` | `/?listing=rent` | `false`  | toggle Comprar → 'Rentar' inactivo           |
| 5   | `/`       | `"listing=rent"` | `/`              | `false`  | toggle Rentar → 'Comprar' inactivo           |
| 6   | `/`       | `"listing=rent"` | `/?listing=rent` | `true`   | toggle Rentar → 'Rentar' activo              |
| 7   | `/search` | `""`             | `/`              | `false`  | otro path, branch línea 20 corta             |
| 8   | `/search` | `""`             | `/?listing=rent` | `false`  | otro path, branch línea 20 corta             |

Casos adicionales para confirmar que **no se rompe el branch de las
líneas 29-30** (rutas no-home con paths anidados):

| #   | pathname                | search | href         | expected | Razón                                     |
| --- | ----------------------- | ------ | ------------ | -------- | ----------------------------------------- |
| 9   | `/dashboard`            | `""`   | `/dashboard` | `true`   | match exacto en branch no-home            |
| 10  | `/dashboard/properties` | `""`   | `/dashboard` | `true`   | startsWith `/dashboard/`, branch línea 30 |
| 11  | `/admin/users`          | `""`   | `/admin`     | `true`   | startsWith `/admin/`, branch línea 30     |
| 12  | `/favorites`            | `""`   | `/favorites` | `true`   | match exacto                              |

Casos defensivos (edge):

| #   | pathname | search                    | href             | expected | Razón                                  |
| --- | -------- | ------------------------- | ---------------- | -------- | -------------------------------------- |
| 13  | `/`      | `"listing=sale&type=apt"` | `/`              | `true`   | otros params no interfieren            |
| 14  | `/`      | `"type=apt"`              | `/`              | `true`   | sin `listing`, equivale a `null`       |
| 15  | `/`      | `"listing=foo"`           | `/`              | `false`  | valor desconocido NO matchea 'Comprar' |
| 16  | `/`      | `"listing=foo"`           | `/?listing=rent` | `false`  | valor desconocido NO matchea 'Rentar'  |

> El caso #15 es importante: el helper trata únicamente `null`/`'sale'`/
> `'rent'` como valores conocidos. Cualquier otro valor de `listing` (un
> hipotético `listing=foo` por error del usuario o de un link externo)
> deja a **ambos** links inactivos. Esto es comportamiento defensivo
> aceptable: el TopNav no inventa un activo para un estado que no entiende.

Si en algún momento se agrega un link explícito `href='/?listing=sale'`
(no contemplado hoy en `VARIANT_CONFIG`), su comportamiento sería:

| #   | pathname | search           | href             | expected | Razón                               |
| --- | -------- | ---------------- | ---------------- | -------- | ----------------------------------- |
| 17  | `/`      | `""`             | `/?listing=sale` | `false`  | declara listing, exige match exacto |
| 18  | `/`      | `"listing=sale"` | `/?listing=sale` | `true`   | match exacto                        |
| 19  | `/`      | `"listing=rent"` | `/?listing=sale` | `false`  | distinto valor                      |

Esto se documenta para futuros refactors pero **no** se introduce ahora.

## Blast radius

Grep confirma que `isLinkActive` se importa **solo** desde 2 call sites:

```
src/components/nav/NavLinks.tsx:5       → import
src/components/nav/NavLinks.tsx:40      → uso
src/components/nav/MobileNavDrawer.tsx:8 → import
src/components/nav/MobileNavDrawer.tsx:203 → uso
```

No hay otros consumidores. No hay tests del helper (el repo no tiene
suite de unit tests aún), por lo que la validación es manual via los
casos de prueba listados arriba.

**Verificación de regresión**: ningún call site espera explícitamente el
comportamiento viejo. Ambos invocan `isLinkActive(pathname, search,
link.href)` y aplican estilos según el booleano resultante. El cambio
amplía el dominio donde devuelve `true` para un caso (link `/` con
`?listing=sale`), nada más. Los call sites quedan idénticos.

## Documentación

Actualizar el JSDoc del helper para reflejar la semántica nueva.
Reemplazar el comentario inline líneas 21-23 por una explicación que
mencione los 3 estados del toggle.

Propuesta de comentario nuevo (la redacción exacta queda a criterio del
implementer, mientras transmita la idea):

```ts
/**
 * Devuelve `true` si el link representado por `href` debe marcarse activo
 * dado el pathname y los searchParams actuales del navegador.
 *
 * Comparamos pathname + subset de searchParams declarados en el href.
 * Esto es necesario porque links como "/" (Comprar) y "/?listing=rent"
 * (Rentar) comparten pathname y la diferencia vive en el query.
 *
 * Semántica para el branch home (`pathHref === '/'`):
 * - Link SIN `listing` declarado (ej. `href='/'`): activo cuando el query
 *   no tiene `listing` (default "Todas") o tiene `listing=sale`. Esto
 *   refleja el hecho de que en la home el toggle introduce 3 estados
 *   (`all`, `sale`, `rent`) pero el TopNav solo expone 2 links ("Comprar"
 *   y "Rentar"); "Comprar" agrupa los dos casos de "no es renta".
 * - Link CON `listing` declarado (ej. `href='/?listing=rent'`): exige
 *   match exacto.
 *
 * El cálculo se hace client-side (usePathname + useSearchParams) porque
 * los layouts no re-renderean al cambiar searchParams y el TopNav vive
 * en un layout.
 */
```

## Tokens / componentes / tipografía

No aplica: la feature toca solo lógica de un helper puro. Los estilos
activo/inactivo de `NavLinks` y `MobileNavDrawer` no cambian.

## Datos / Interactividad / Estados

No aplica: helper síncrono, puro, sin IO ni estado.

## A11y

Sin cambios. El atributo `aria-current="page"` ya lo aplican
`NavLinks.tsx:56` y `MobileNavDrawer.tsx:208` cuando `active === true`.
Como la nueva lógica simplemente extiende cuándo `active` es `true`,
el screen reader pasará a anunciar 'Comprar' como página actual en el
caso `?listing=sale`, lo cual es semánticamente correcto.

## Alternativas consideradas

### Opción A — TopNav 'Comprar' navega a `/?listing=sale`

Cambiar `VARIANT_CONFIG.app.links[0].href` de `'/'` a `'/?listing=sale'`.
El helper actual ya funciona correctamente con match exacto.

- **Pros**: simetría con 'Rentar'; semántica explícita; cero cambios en
  el helper.
- **Contras**: ensucia la URL de la home en el caso default (la home pasa
  a vivir en `/?listing=sale` en vez de `/`); el SEO de `/` pierde su rol
  como canonical de la landing; rompe el contrato de `home_discover_screen`
  donde `/` es la home pública del escaparate. El usuario rechazó esta
  opción por ese motivo.

### Opción B — Relajar `isLinkActive` (elegida)

Modificar el helper para que un link sin `listing` declarado matchee
`{ null, 'sale' }`.

- **Pros**: 1 línea de cambio + actualización de comentario; URL limpia
  para la home default; preserva el contrato de URL pública; no rompe
  ningún call site.
- **Contras**: introduce una asimetría sutil entre el modelo del TopNav
  (2 links) y el del toggle (3 estados) — el implementer y el reviewer
  tienen que entender que 'Comprar' del TopNav agrupa `{ all, sale }`.
  Mitigado vía comentario JSDoc explícito.

### Opción C — Ajustar `ListingTypeToggle`

Hacer que el toggle navegue a `/` para `all` y `/?listing=sale` para
`sale`, y agregar al TopNav un tercer link explícito 'Todas'
(`href='/'`) además de 'Comprar' (`href='/?listing=sale'`) y 'Rentar'
(`href='/?listing=rent'`).

- **Pros**: dos fuentes de verdad totalmente alineadas; modelo mental
  uniforme.
- **Contras**: cambia el contrato visual del TopNav (3 links en vez de 2)
  fuera del alcance del bug; agrega ruido a la nav superior; el mockup
  `home_discover_screen` muestra 2 links y este cambio rompería la
  fidelidad visual. Requiere aprobación de diseño adicional.

### Recomendación

**Opción B**. Cambio mínimo, alineado con la decisión cerrada por el
humano el 2026-05-27. Las desventajas (asimetría conceptual) se
neutralizan con documentación clara en el JSDoc.

## Riesgos

1. **Asimetría conceptual no documentada**: si el JSDoc nuevo no explica
   bien que 'Comprar' del TopNav agrupa `{ all, sale }`, un futuro
   contribuidor podría asumir match 1-a-1 y volver a romperlo.
   **Mitigación**: el comentario propuesto en § Documentación es
   explícito sobre el modelo.

2. **Valores desconocidos de `listing`**: si en el futuro alguien agrega
   un cuarto estado al toggle (ej. `'commercial'`), `'Comprar'` del
   TopNav **no** lo matcheará (ver caso #15). Es el comportamiento
   correcto pero hay que recordarlo: al agregar un cuarto estado,
   también hay que decidir explícitamente dónde se ubica en el TopNav.
   **Mitigación**: documentar en el JSDoc que la whitelist es
   `{ null, 'sale' }` para el link `/`.

3. **Sin tests automatizados**: el helper no tiene suite de tests, así
   que la validación es 100% manual via casos de prueba. Si el repo
   adopta Vitest/Jest en el futuro, este helper es un candidato natural
   para una suite de table tests con los casos de § Casos de prueba.
   **Mitigación**: smoke test manual exhaustivo antes de cerrar la
   feature.

4. **Cache de Next dev server**: durante la verificación manual conviene
   recargar la pestaña (no solo navegar via SPA) para descartar que el
   estado activo cacheado del cliente esconda regresiones. Es buena
   práctica general, no específica de este cambio.

## Criterios de aceptación verificables

Mapeados 1-a-1 con el backlog (`feature_list.json`):

- [ ] **A1** — Decisión documentada: la elección de Opción B y su modelo
      semántico queda escrita en `progress/topnav_active_link_listing_sale/
design.md` (este archivo) y reflejada en el JSDoc del helper. No
      requiere update de `CLAUDE.md` ni `design-system.md` (es un detalle
      de implementación contenido en el helper).
- [ ] **A2** — TopNav 'Comprar' se marca activo en URL `/?listing=sale`
      (caso de prueba #3).
- [ ] **A3** — TopNav 'Comprar' sigue activo en URL `/` sin query
      (caso de prueba #1).
- [ ] **A4** — `ListingTypeToggle` mantiene sus 3 estados (Todas/
      Comprar/Rentar) sin cambios funcionales ni visuales.
- [ ] **A5** — URLs producidas son consistentes: toggle 'Rentar' →
      `/?listing=rent` y TopNav 'Rentar' → `/?listing=rent` (idénticas).
      Toggle 'Comprar' → `/?listing=sale` y TopNav 'Comprar' → `/`
      (intencionalmente diferentes para URL limpia, pero ambas marcan
      'Comprar' activo en el TopNav).
- [ ] **A6** — Sin hex literales nuevos (no aplica, no se tocan
      estilos). El helper `isLinkActive` mantiene su firma pública
      `(pathname, search, href) → boolean` — no es breaking para los 2 call
      sites existentes ni para hipotéticos call sites futuros que sigan el
      mismo patrón.

Checks adicionales de no-regresión:

- [ ] **A7** — TopNav 'Rentar' sigue funcionando: activo solo en
      `?listing=rent`, inactivo en `/` y en `?listing=sale` (casos #2, #5,
      #6 — el #6 es el activo esperado).
- [ ] **A8** — Rutas no-home no se rompen: `/dashboard`, `/admin`,
      `/favorites` mantienen su comportamiento de match exacto + startsWith
      (casos #9 a #12).
- [ ] **A9** — `pnpm lint` y `pnpm type-check` pasan tras el cambio.
- [ ] **A10** — Smoke test en browser: toggle entre los 3 estados del
      `ListingTypeToggle` en la home y verificar visualmente que el TopNav
      resalta el link correcto en cada paso.

## Notas para el implementer

- El cambio es de **un solo archivo**: `src/lib/nav/active-link.ts`.
- **No** modificar `TopNav.tsx`, `NavLinks.tsx`, `MobileNavDrawer.tsx`
  ni `ListingTypeToggle.tsx`. Mantener el blast radius mínimo es parte
  del diseño.
- Actualizar el JSDoc según § Documentación. La redacción exacta queda
  a tu criterio mientras transmita: (1) que el helper distingue link
  con/sin `listing` declarado; (2) que el link sin listing agrupa
  `{ null, 'sale' }`; (3) por qué (el TopNav expone 2 links pero el
  toggle tiene 3 estados).
- No agregar tests (el repo no tiene suite). La validación es manual
  via la tabla de § Casos de prueba — corré los casos #1-#16 mentalmente
  o con `console.log` temporal antes de commitear (y eliminá el log).
- Tras el cambio, smoke en browser: home `/`, toggle a "Comprar", toggle
  a "Rentar", toggle a "Todas". Verificar visualmente el estado activo
  en TopNav desktop y en MobileNavDrawer.
