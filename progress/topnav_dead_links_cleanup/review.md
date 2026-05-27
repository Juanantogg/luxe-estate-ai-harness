# Review — feature topnav_dead_links_cleanup

**Veredicto:** APPROVED

**Fecha:** 2026-05-27
**Reviewer:** reviewer (subagente)

---

## Resumen ejecutivo

Fix conservador, quirúrgico y bien justificado. 1 archivo modificado
(`src/components/nav/TopNav.tsx`), 0 archivos nuevos, 0 dependencias
nuevas. La implementación calza línea por línea con el spec del designer
(`progress/topnav_dead_links_cleanup/design.md`).

Cubre los 7 acceptance criteria del backlog. `init.sh` rápido pasa verde
(deps + lint 0 warnings + type-check).

---

## Verificación de los 7 acceptance criteria

### AC1 — "Vender" removido/oculto en variant `app`

`src/components/nav/TopNav.tsx:64`:

```
{ href: '/sell', label: 'Vender', enabled: false },
```

Filtrado en `:208` por `.filter((link) => link.enabled !== false)`.

✅ Cumplido.

### AC2 — "Guardados" filtrado cuando `session === null` (server-side)

`src/components/nav/TopNav.tsx:66`:

```
{ href: '/favorites', label: 'Guardados', requiresSession: true },
```

Filtrado en `:209` por `.filter((link) => !link.requiresSession || Boolean(user))`.

El filtrado corre en el **Server Component TopNav** (la función
`TopNav` async, líneas 161-210), ANTES de que el array `links` se pase
al Client Component `NavLinks` (línea 244) o al `MobileNavDrawer`
(líneas 282 y 301). El `user` viene de `session?.user ?? null` en la
línea 172.

✅ Cumplido — filtrado server-side, según spec.

### AC3 — "Inquilinos", "Finanzas" ocultos en variant `dashboard`

`src/components/nav/TopNav.tsx:78` y `:80`:

```
{ href: '/dashboard/tenants', label: 'Inquilinos', enabled: false },
{ href: '/dashboard/finance', label: 'Finanzas', enabled: false },
```

✅ Cumplido. `/dashboard/properties` (link real, AC implícito de no
regresión) sigue activo en `:76`.

### AC4 — "Propiedades" (admin) y "Consultas" ocultos en variant `admin`

`src/components/nav/TopNav.tsx:91` y `:94`:

```
{ href: '/admin/properties', label: 'Propiedades', enabled: false },
{ href: '/admin/inquiries', label: 'Consultas', enabled: false },
```

✅ Cumplido. `/admin/users` (link real) sigue activo en `:92`.

### AC5 — Flag `enabled` + comentario explicando

Los 5 links muertos llevan `enabled: false` + comentario TODO inline
que **nombra la feature pendiente**:

| Línea | Link                 | TODO                         |
| ----- | -------------------- | ---------------------------- |
| 61-63 | `/sell`              | `sell_property_flow`         |
| 77    | `/dashboard/tenants` | `agent_tenants_directory`    |
| 79    | `/dashboard/finance` | `agent_finance_dashboard`    |
| 90    | `/admin/properties`  | `admin_properties_directory` |
| 93    | `/admin/inquiries`   | `admin_inquiries_inbox`      |

Adicional: el comentario del link `/sell` (3 líneas, 61-63) es el más
explícito y explica también el patrón ("restituir removiendo
`enabled: false` cuando la ruta `/sell` exista") — sirve como modelo
para los demás. Los otros 4 son one-liners pero igualmente nombran la
feature pendiente.

Los nombres no aparecen en `feature_list.json` aún (son placeholders
mentales), pero son únicos y descriptivos — futuro lector entiende
qué falta materializar.

✅ Cumplido.

### AC6 — Mobile drawer respeta los mismos cambios

`MobileNavDrawer` recibe el array `links` ya filtrado en **ambos**
call sites del cuerpo de `TopNav`:

- Línea 282: branch logueado (`<MobileNavDrawer links={links} ... />`).
- Línea 301: branch anónimo (`<MobileNavDrawer links={links} ... anonymous />`).

Como el filtrado pasa una sola vez antes (líneas 207-210) y el mismo
array `links` se reusa para `NavLinks` (`:244`) y para ambas
instancias del drawer, no hay forma de que mobile y desktop diverjan.

El drawer no tiene lógica de filtrado propia (solo `.map` plain en
`MobileNavDrawer.tsx:202-222`), así que hereda 100% del filtro
upstream.

✅ Cumplido.

### AC7 — Smoke test conteo de links por variant/sesión

Matriz esperada vs implementada (deducida del filtro):

| Variant     | Sesión | Esperado                   | Filtrado real produce                                                                                    |
| ----------- | ------ | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `app`       | anon   | Comprar, Rentar            | `/`, `/?listing=rent` (descartados `/sell` por enabled=false, `/favorites` por requiresSession sin user) |
| `app`       | auth   | Comprar, Rentar, Guardados | `/`, `/?listing=rent`, `/favorites`                                                                      |
| `dashboard` | auth   | Dashboard, Propiedades     | `/dashboard`, `/dashboard/properties`                                                                    |
| `admin`     | auth   | Dashboard, Usuarios        | `/admin`, `/admin/users`                                                                                 |

✅ Cumplido por construcción (verificable trivialmente leyendo los
filtros y el config).

Smoke test browser-based queda pendiente del humano (necesita 4
estados de sesión × 3 variants; lo deja para `progress/smoke-tests.md`).

---

## Checklist transversal

- **Tokens y colores:** [x] cero hex literales nuevos; el diff no toca
  className. Solo agrega tipo, flags y filtro.
- **Componentes y framework:** [x] Server Component (TopNav) hace el
  trabajo; `NavLinks` (Client) sigue recibiendo el contrato actual
  `NavLink` sin cambios. `params`/`searchParams`/`cookies()`/
  `headers()` no aplican (no se tocan).
- **Supabase:** [x] N/A (el archivo lee `notifications` igual que
  antes, sin cambios en queries).
- **Fidelidad visual:** [x] N/A. La feature no introduce UI nueva;
  remueve links. La matriz de links resultante coincide con lo pedido
  por el backlog (no hay mockup que contradiga).
- **Calidad:** [x] `pnpm lint --max-warnings=0` OK, `pnpm type-check`
  OK (verificado con `./init.sh`). No hay `console.log` nuevos; el
  único `console.warn` del archivo (línea 191) preexistía. No hay
  TODOs sin contexto (los 5 TODOs nuevos están vinculados a nombres
  de feature concretos).

---

## Decisiones de diseño respetadas

1. **No se modifica `NavLink` en `NavLinks.tsx`.** El tipo público sigue
   siendo `{ href, label }` (verificado en `NavLinks.tsx:8-11`). El tipo
   extendido `VariantLinkConfig` vive **local** en `TopNav.tsx:35-41`,
   no se exporta. ✅

2. **El `.map(...)` final proyecta solo `{ href, label }`** (línea 210):

   ```ts
   .map((link) => ({ href: link.href, label: link.label }))
   ```

   Los flags `enabled` y `requiresSession` NUNCA llegan al Client
   Component. Aunque React/Next no se quejarían de propiedades extras
   (los serializa silenciosamente), la proyección explícita evita
   ruido y mantiene el contrato sobrio. ✅

3. **Filtrado server-side antes del Client Component.** El filtro se
   ejecuta en líneas 207-210, dentro del cuerpo async de `TopNav`,
   antes de que `links` se use para `<NavLinks ... />` (línea 244) y
   para los dos `<MobileNavDrawer ... links={links} />` (líneas 282,
   301). ✅

4. **No hay regresión en links reales.** `/dashboard/properties`,
   `/admin/users`, `/`, `/?listing=rent`, `/favorites` (con sesión)
   siguen sin `enabled: false` ni `requiresSession`, por lo tanto
   pasan el filtro intactos. ✅

---

## NITs (no bloqueantes)

Ninguno detectado que valga la pena documentar. El cambio es
quirúrgico, está dentro de un único archivo, sigue una convención
consistente y trae comentarios suficientes para el lector futuro.

Observación menor (FYI, no acción): los 5 nombres de feature TODO
(`sell_property_flow`, `agent_tenants_directory`,
`agent_finance_dashboard`, `admin_properties_directory`,
`admin_inquiries_inbox`) **no existen aún en `feature_list.json`**.
Esto es OK porque la decisión humana documentada en `notes` del
backlog es preservar el intent sin pre-poblar el backlog. Si en el
futuro se materializa alguna de estas features, restituir el link es
removerle el `enabled: false`.

---

## Cierre

APPROVED. No hay cambios requeridos.
