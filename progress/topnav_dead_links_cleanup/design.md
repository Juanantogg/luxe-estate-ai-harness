# topnav_dead_links_cleanup — Spec de implementación

## Descripción

Smoke test del 2026-05-26 (Dario) detectó 5 links del `TopNav` que apuntan
a rutas inexistentes (404) y 1 link privado visible sin sesión. La feature
limpia el `VARIANT_CONFIG` de `src/components/nav/TopNav.tsx` sin remover
las entradas: cada link muerto queda en el array marcado con
`enabled: false` + comentario `TODO` que apunta al nombre de feature que
falta. Restituirlos cuando se materialicen es 1 línea (borrar el flag).

`/favorites` recibe un tratamiento distinto: la ruta existe, lo que hay
que evitar es renderizar el link sin sesión (hoy hace fricción —
middleware redirige a `/login`). Se introduce un flag separado
`requiresSession: true` que el TopNav filtra cuando `user === null`.
Ambos flags son de orquestación del config; no se propagan al Client
Component `NavLinks` — se resuelven server-side antes de pasar el array
final.

## Diff completo de `src/components/nav/TopNav.tsx`

```diff
-interface VariantConfig {
-  /** Sets de links según variante. */
-  links: Array<Omit<NavLink, 'isActive'>>;
+/**
+ * Forma extendida de los links dentro de VARIANT_CONFIG. NO se propaga al
+ * Client Component `NavLinks` — los flags `enabled` y `requiresSession`
+ * son de orquestación del config (qué podría renderizarse) y se
+ * resuelven en este Server Component antes de pasar el array final al
+ * cliente (lo que efectivamente se renderiza).
+ */
+type VariantLinkConfig = Omit<NavLink, 'isActive'> & {
+  /** Si false, el link no se renderiza. Se usa para placeholders de
+   *  features futuras que viven en el config para no perder el intent. */
+  enabled?: boolean;
+  /** Si true, el link solo se renderiza cuando hay sesión. */
+  requiresSession?: boolean;
+};
+
+interface VariantConfig {
+  /** Sets de links según variante. */
+  links: VariantLinkConfig[];
   /** Ruta del logo (típicamente la "home" de cada shell). */
   homeHref: string;
   /** Altura de la nav (mobile + desktop). El HTML usa h-16 en dashboard/admin y h-20 en app. */
   heightClass: string;
   /** Fondo del nav. */
   backgroundClass: string;
   /** Si true, muestra el bloque "name + role" a la izquierda del avatar (md+). */
   showNameBlock: boolean;
 }

 const VARIANT_CONFIG: Record<TopNavVariant, VariantConfig> = {
   app: {
     links: [
       { href: '/', label: 'Comprar' },
       { href: '/?listing=rent', label: 'Rentar' },
-      { href: '/sell', label: 'Vender' },
-      { href: '/favorites', label: 'Guardados' },
+      // TODO: feature `sell_property_flow` no implementada — la entrada
+      // queda en el config para preservar el intent original; restituir
+      // removiendo `enabled: false` cuando la ruta `/sell` exista.
+      { href: '/sell', label: 'Vender', enabled: false },
+      // /favorites existe pero es ruta privada: solo visible con sesión.
+      { href: '/favorites', label: 'Guardados', requiresSession: true },
     ],
     homeHref: '/',
     heightClass: 'h-16 md:h-20',
     backgroundClass: 'bg-background/95 backdrop-blur-md',
     showNameBlock: false,
   },
   dashboard: {
     links: [
       { href: '/dashboard', label: 'Dashboard' },
       { href: '/dashboard/properties', label: 'Propiedades' },
-      { href: '/dashboard/tenants', label: 'Inquilinos' },
-      { href: '/dashboard/finance', label: 'Finanzas' },
+      // TODO: feature `agent_tenants_directory` no implementada.
+      { href: '/dashboard/tenants', label: 'Inquilinos', enabled: false },
+      // TODO: feature `agent_finance_dashboard` no implementada.
+      { href: '/dashboard/finance', label: 'Finanzas', enabled: false },
     ],
     homeHref: '/dashboard',
     heightClass: 'h-16',
     backgroundClass: 'bg-surface/95 backdrop-blur-md',
     showNameBlock: true,
   },
   admin: {
     links: [
       { href: '/admin', label: 'Dashboard' },
-      { href: '/admin/properties', label: 'Propiedades' },
+      // TODO: feature `admin_properties_directory` no implementada.
+      { href: '/admin/properties', label: 'Propiedades', enabled: false },
       { href: '/admin/users', label: 'Usuarios' },
-      { href: '/admin/inquiries', label: 'Consultas' },
+      // TODO: feature `admin_inquiries_inbox` no implementada.
+      { href: '/admin/inquiries', label: 'Consultas', enabled: false },
     ],
     homeHref: '/admin',
     heightClass: 'h-16',
     backgroundClass: 'bg-surface/95 backdrop-blur-md',
     showNameBlock: false,
   },
 };
```

Y en el cuerpo de `TopNav` (zona de construcción del array `links`):

```diff
   // Los links se pasan plain (sin isActive precomputado). NavLinks y
   // MobileNavDrawer son Client Components que calculan `isActive` con
   // usePathname + useSearchParams; el TopNav vive en un layout y los
   // layouts no re-renderean al cambiar searchParams.
-  const links: NavLink[] = config.links.map((link) => ({ ...link }));
+  //
+  // Filtrado del config → array final que recibe el cliente:
+  // 1) descarta links con `enabled: false` (placeholders de features
+  //    futuras que viven en el config para preservar el intent).
+  // 2) descarta links con `requiresSession: true` si no hay user.
+  // 3) proyecta a `{ href, label }` para soltar `enabled` /
+  //    `requiresSession` antes de pasar el objeto al cliente: NavLink
+  //    no los espera.
+  const links: NavLink[] = config.links
+    .filter((link) => link.enabled !== false)
+    .filter((link) => !link.requiresSession || Boolean(user))
+    .map((link) => ({ href: link.href, label: link.label }));
```

## Por qué no se modifica `NavLink` en `NavLinks.tsx`

`NavLink` vive en `src/components/nav/NavLinks.tsx`, que es un Client
Component (`'use client'` en línea 1). Es el contrato que reciben
`NavLinks` y `MobileNavDrawer` para renderizar los items.

Los flags `enabled` y `requiresSession` son de **orquestación del
config**: describen "qué podría renderizarse" según la variante y la
sesión. La decisión efectiva (qué se renderiza realmente) se resuelve en
el TopNav (Server Component), que ya conoce `user` y `variant`. Una vez
filtrado, el array que cruza al cliente ya no necesita esos flags.

Mantener la separación tiene dos beneficios:

1. **Boundary sobrio**: el Client Component recibe solo lo que necesita
   pintar (`href`, `label`). No paga el costo de serializar metadatos
   inertes y no expone semántica de policy al bundle del cliente.
2. **Single source of truth para "qué se ve"**: el TopNav decide. Si
   mañana se agrega lógica adicional (ej. `requiresRole: 'admin'`), todo
   se concentra en un solo punto sin tocar el cliente.

Por eso se introduce un tipo local `VariantLinkConfig` en `TopNav.tsx`
que extiende `Omit<NavLink, 'isActive'>` con los flags opcionales, y el
`.map(...)` final proyecta a `{ href, label }` puros antes de cruzar al
cliente.

## Links visibles por variant tras el cambio

| Variant     | Sesión                       | Links renderizados             |
| ----------- | ---------------------------- | ------------------------------ |
| `app`       | anónima (`session === null`) | Comprar, Rentar (2)            |
| `app`       | autenticada                  | Comprar, Rentar, Guardados (3) |
| `dashboard` | autenticada (agent+)         | Dashboard, Propiedades (2)     |
| `admin`     | autenticada (admin)          | Dashboard, Usuarios (2)        |

Los 4 links muertos (`/sell`, `/dashboard/tenants`, `/dashboard/finance`,
`/admin/properties`, `/admin/inquiries`) quedan documentados en el
config con su TODO y se restituyen removiendo `enabled: false` cuando
exista la feature correspondiente.

El mobile drawer hereda automáticamente este filtrado: `MobileNavDrawer`
recibe el mismo array `links` ya filtrado (línea 249 del archivo
original).

## Verificación

- `pnpm lint` → OK (0 warnings, 0 errors).
- `pnpm type-check` → OK.
- `pnpm build` → OK (todas las rutas siguen compilando, /favorites,
  /admin, /admin/users, /dashboard sin cambios estructurales).
- `./init.sh` rápido → verde.
