# Review — app_shell

**Veredicto**: APPROVED

## Resumen

Implementación sólida del shell de la app. TopNav Server Component
parametrizado por variante (`app`/`dashboard`/`admin`), 4 layouts
segmentados con guards de rol correctos, drawer móvil con focus trap y
sign-out vía `<form action={signOut}>`. Cero hex en JSX, build verde,
`'use client'` sólo en los dos componentes que lo justifican. La
inyección de `x-pathname` desde el middleware funciona y permite que el
TopNav resuelva `aria-current="page"` server-side.

Dos hallazgos no críticos sobre clases CSS que no aplican (no rompen
build ni accesibilidad) y un detalle menor de redirect que se justifica
por el middleware.

## Hallazgos críticos (bloquean approval)

Ninguno.

## Hallazgos no críticos (recomendaciones)

1. **`rounded-DEFAULT` no aplica en Tailwind 4** — `src/components/nav/TopNav.tsx:200,204` y `src/components/nav/MobileNavDrawer.tsx:166,190,211`. En Tailwind 4 con `--radius-DEFAULT` declarado en `@theme`, la utility para el radius por defecto es `rounded` (sin sufijo), no `rounded-DEFAULT`. La clase actual probablemente no genera ningún CSS (clase desconocida → no-op silencioso). Visualmente: el logo cuadrado del header y los items del drawer mobile no llevan border-radius. Reemplazar por `rounded` o `rounded-lg` según convenga el design system. No bloqueante porque el build pasa y el shell es funcional; se puede arreglar en un follow-up junto con `home_discover_screen`.

2. **Animación del drawer no instalada** — `src/components/nav/MobileNavDrawer.tsx:137` usa `animate-in slide-in-from-right duration-200`. Estas son utilities de `tailwindcss-animate` (plugin que no está en `package.json`). El drawer abre/cierra correctamente por el state booleano, pero sin la animación de entrada que insinúa el código. Si se quiere conservar el efecto, requiere añadir el plugin (decisión de dependencia que escala al humano) o reemplazar por una transición CSS nativa (`transition transform translate-x-full` controlado por estado).

3. **`(app)/layout.tsx` redirige a `/login` sin `?next=/`** — `src/app/(app)/layout.tsx:19`. El spec pedía `redirect('/login?next=/')`. En la práctica, el middleware (`src/lib/supabase/proxy.ts:57-62`) ya añade `next` para `/favorites`, `/profile`, `/visits`, `/dashboard`, `/admin`. Como `(app)` actualmente no envuelve ninguna ruta concreta (la decisión humana fue dejar `/` fuera del grupo hasta `home_discover_screen`), el branch es defensivo y no se ejercita. Cuando se mueva `page.tsx` al grupo, conviene añadir el `next=${pathname}` para preservar destino.

4. **`AvatarDropdown` se oculta en mobile** — `src/components/nav/TopNav.tsx:239-246` envuelve el `AvatarDropdown` en `hidden md:block`. En mobile el avatar no es visible; el drawer móvil contiene una réplica del menú con perfil/sign out. Es una decisión razonable (UX limpia en mobile) pero diverge ligeramente del spec, que mostraba el avatar visible en mobile junto al hamburger. No bloqueante: el drawer cubre la funcionalidad. Documentar en notas finales o validar visualmente con `home_discover_screen`.

## Verificación ejecutada

- `./init.sh full` → OK (deps + lint sin warnings + type-check + build de producción en 1.17s, 9 páginas generadas, middleware compilado).
- `grep '#[0-9a-fA-F]{3,6}'` en `src/components/nav/` y los 4 layouts → 0 resultados.
- `grep "'use client'"` en los archivos nuevos → 2 resultados: `MobileNavDrawer.tsx`, `AvatarDropdown.tsx`. TopNav, NavLinks, NotifBell, SkipLink y los 4 layouts permanecen Server Components.
- `grep "from '@supabase"` en los archivos nuevos → solo `import type { User }`, no instanciación. Todas las llamadas usan `createClient` de `@/lib/supabase/server`.
- `await headers()` confirmado en `TopNav.tsx:155`. No hay `params`/`searchParams`/`cookies` en estos archivos (los layouts no los reciben en esta feature).
- Query unread: `src/components/nav/TopNav.tsx:163-166` usa `.eq('recipient_id', user.id).is('read_at', null)` con `count: 'exact', head: true`. Verificado contra `src/types/database.ts:147-183` — columnas existen.
- `x-pathname` en middleware: `src/lib/supabase/proxy.ts:16-19` clona `request.headers`, setea `x-pathname` y lo pasa al `NextResponse.next({ request: { headers: requestHeaders }})` tanto en la creación inicial como en cada `setAll` de cookies (líneas 19 y 31). Patrón correcto para Next 15+ — el TopNav lo lee con `await headers()`.
- `console.log/debug` de debug → 0. Solo un `console.warn` justificado en `TopNav.tsx:171` para fallo de fetch de notifications.

## Acceptance criteria del feature_list.json

- [x] `src/components/nav/TopNav.tsx` con Server Component que lee user/profile (vía `getSessionAndProfile()` server-side, sin `'use client'`).
- [x] Mobile: nav colapsa a hamburguesa abriendo drawer (`MobileNavDrawer` con `md:hidden` y panel deslizable).
- [x] Avatar dropdown: link a `/profile`, `/dashboard` si es agent+, `/admin` si es admin, signOut (`buildDropdownItems` en `TopNav.tsx:86-121` cumple la tabla del spec).
- [x] Layouts `src/app/(app)/layout.tsx`, `(dashboard)/layout.tsx`, `(admin)/layout.tsx` con guards de rol. También se creó `(auth)/layout.tsx` para los 4 shells del spec. Dashboard redirige a `/` si el rol no está en `{agent, broker, admin}`; admin invoca `notFound()` si rol != admin.
- [x] Notif badge muestra count de `notifications.read_at IS NULL` para el user actual (filtra por `recipient_id`, no `user_id`).
- [x] Skip link para a11y, focus visible (`SkipLink.tsx` + `focus-visible:ring-2` en todos los elementos interactivos).

## Acceptance criteria del spec (sección "Criterios verificables")

- [x] `TopNav.tsx` Server Component con prop `variant`.
- [x] `AvatarDropdown.tsx` Client Component con manejo de teclado (Escape, Enter, ArrowUp/Down, Home/End).
- [x] `MobileNavDrawer.tsx` Client Component con focus trap (Tab/Shift+Tab ciclan), scroll lock del body y devuelve foco al trigger al cerrar.
- [x] `SkipLink.tsx` con texto "Saltar al contenido principal".
- [x] Los 4 layouts segmentados creados.
- [x] `(dashboard)` redirige a `/` si rol no está en `{agent, broker, admin}`.
- [x] `(admin)` invoca `notFound()` si rol != admin.
- [x] `(auth)` redirige a rol-home si ya hay sesión (vía `getRedirectPathForRole`).
- [x] Unread count: `recipient_id = user.id` + `read_at IS NULL`.
- [x] Badge rojo solo si `unreadCount > 0` (`NotifBell.tsx:35-40`).
- [x] Cero hex en `src/components/nav/`.
- [x] Skip-link aparece on focus y `<main>` tiene `id="main-content"` + `tabIndex={-1}`.
- [x] Avatar dropdown items por rol coinciden con la tabla del spec.
- [x] Sign out via `<form action={signOut}>` sin JS adicional (AvatarDropdown:182 y MobileNavDrawer:207).
- [x] Drawer cierra con: overlay click, botón close, Escape, click en link interno (`onClick={close}` en cada `<Link>`).
- [x] Todos los links usan `<Link>` de `next/link`.
- [x] Link activo: `aria-current="page"` (NavLinks, AvatarDropdown, MobileNavDrawer).
- [x] Hamburger: `aria-expanded` + `aria-controls`.
- [x] `pnpm lint` y `pnpm type-check` pasan sin errores.

## Cumplimiento de reglas duras

- [x] Cero hex en JSX (verificado con grep).
- [x] Server Components por defecto; `'use client'` solo en AvatarDropdown y MobileNavDrawer (estado local, focus management).
- [x] Next 16: `await headers()` en TopNav. No hay `params`/`cookies` en estos archivos.
- [x] Supabase via helpers (`@/lib/supabase/server`); el único import de `@supabase/supabase-js` es `type { User }`.
- [x] RLS no aplica (no se crean tablas nuevas en esta feature; `notifications` ya está creada con RLS por `auth_layer`).
- [x] Mutaciones en Server Action (`signOut` ya existe en `actions.ts`).
- [x] Textos en español; cero diccionarios i18n.
- [x] `feature_list.json` permanece en `in_progress` (el implementer cumplió la regla de no marcar `done`).

## Notas finales

- El implementer respetó las 3 decisiones zanjadas del humano en `design.md`: (1) sin AdminSidebar lateral; (2) `src/app/page.tsx` no se movió al grupo `(app)`; (3) `x-pathname` inyectado en middleware.
- La query de notifications usa `recipient_id` (corrección del spec sobre la indicación inicial del líder de `user_id`).
- El TopNav acepta `session` por prop para evitar doble fetch — los layouts ya lo pasan.
- Los hallazgos no críticos #1 y #2 son visuales y se pueden corregir junto con `home_discover_screen` (la primera feature que materializa el TopNav visualmente).
