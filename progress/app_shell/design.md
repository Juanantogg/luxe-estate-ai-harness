# Design spec — app_shell (TopNav + layouts segmentados)

> Feature: `app_shell` · `requires_approval: true` · depends_on
> `ui_primitives` (done) y `auth_layer` (done).

## Referencia visual

- TopNav usuario: `docs/designs/home_discover_screen/code.html` (líneas 53-92) y `docs/designs/property_details_screen/code.html` (líneas 63-95).
- TopNav agente: `docs/designs/property_management_dashboard/code.html` (líneas 34-75).
- TopNav admin: `docs/designs/admin_user_directory_cards/code.html` (líneas 75-104).
- Mockups PNG correspondientes en cada carpeta `docs/designs/<screen>/screen.png` — contrato visual definitivo.

## Resumen ejecutivo

- **Un único componente `<TopNav />`** parametrizable por `variant` (`app`/`dashboard`/`admin`) que renderiza el mismo esqueleto (logo + nav links + acciones + avatar) pero con set de links distinto por variante. Los tres HTML muestran exactamente la misma anatomía, sólo cambian los textos de los enlaces.
- **NO se crea un AdminSidebar lateral**: el mockup `admin_user_directory_cards` confirma que admin usa TopNav horizontal igual que el resto. La indicación del líder ("admin tiene shell propio con sidebar") **se invalida con evidencia del HTML** — ver Riesgos. El admin sí tiene un shell propio pero por el set de links (Dashboard / Listings / Users / Inquiries), no por orientación de la nav.
- **Cuatro layouts segmentados** en `src/app/`: `(auth)`, `(app)`, `(dashboard)`, `(admin)`. Cada uno con su guard de rol y, salvo `(auth)`, su variante de TopNav.
- **Notif badge con query real**: la tabla `notifications` existe con columnas `recipient_id` y `read_at`; el conteo se ejecuta en el Server Component del layout para evitar flicker en el cliente.
- **Drawer móvil** controlado por un único componente Client (`<MobileNavDrawer />`) que recibe los mismos `links` que TopNav y los re-renderiza en sheet vertical.

## Tokens a usar

Todos los tokens existen ya en `src/app/globals.css` (verificado). Cero hex literales.

| Slot                                 | Token                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Fondo de la nav                      | `bg-surface` (variantes dashboard/admin) o `bg-background/95 backdrop-blur-md` (variante app, según `home_discover_screen`)     |
| Borde inferior de la nav             | `border-divider` (1px)                                                                                                          |
| Texto de link inactivo               | `text-on-surface/70` (equivale a `text-nordic/70` del HTML)                                                                     |
| Texto de link activo                 | `text-primary`                                                                                                                  |
| Underline de link activo             | `border-primary` (border-b-2)                                                                                                   |
| Cuadro del logo (icon container)     | `bg-surface-inverse` y `text-on-surface-inverse`                                                                                |
| Wordmark "LuxeEstate"                | `text-on-surface` peso 600/700                                                                                                  |
| Botón icono (search, notif)          | hover: `text-primary`, color base `text-on-surface`                                                                             |
| Badge de notif (dot rojo)            | `bg-danger` con anillo `ring-2 ring-background`                                                                                 |
| Avatar                               | reutiliza componente `Avatar` (ya tokenizado)                                                                                   |
| Drawer mobile fondo                  | `bg-surface`                                                                                                                    |
| Drawer mobile overlay                | `bg-on-surface/40 backdrop-blur-sm`                                                                                             |
| Skip-link                            | `bg-primary text-on-primary` cuando recibe foco                                                                                 |
| Dropdown del avatar                  | `bg-surface`, borde `border-divider`, sombra `shadow-dropdown`                                                                  |
| Dropdown item hover                  | `bg-surface-hover`                                                                                                              |
| Dropdown item destructivo (Sign out) | `text-danger`                                                                                                                   |
| Focus ring global                    | `outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background` |

## Inventario visual por shell

### `(auth)` — login / signup / reset

- **Estructura**: layout minimal, sin TopNav. Sólo `<main>` con la card de auth centrada.
- **Componentes**: ninguno del nav.
- **Guard**: si `user` ya tiene sesión válida, redirigir a `getRedirectPathForRole(profile.role)`. No bloquea acceso anónimo (es el único shell que **permite** anonymous).
- **Slots**: `{children}` recibe la página de login/signup directamente, ya envuelto en un `<div className="min-h-screen flex items-center justify-center bg-background">`. La decoración de blobs verdes la pone la propia página de login, no el layout.

### `(app)` — usuario autenticado (rol `user`)

- **Estructura**:
  - Skip-link visualmente oculto (revealed on focus) que apunta a `#main-content`.
  - `<TopNav variant="app" />` Server Component, sticky `top-0 z-50`.
  - `<main id="main-content">{children}</main>`.
- **Links del nav**: Buy → `/`, Rent → `/?listing=rent`, Sell → `/sell` (placeholder, no implementado), Saved Homes → `/favorites`.
- **Avatar dropdown items** (siempre logged-in en este shell):
  - Mi perfil → `/profile`
  - Mis visitas → `/profile?tab=visits`
  - Si `role` ∈ {agent, broker} → Dashboard → `/dashboard`
  - Si `role` === `admin` → Admin → `/admin`
  - Separador
  - Cerrar sesión → invoca Server Action `signOut`
- **Guard**: si no hay `user`, el middleware ya redirige a `/login`. El layout adicionalmente fetcha `profile` y, si por alguna razón existe `user` pero no `profile`, redirige a `/login?next=...` (caso edge que no debe pasar pero blindamos).

### `(dashboard)` — agent / broker / admin

- **Estructura**: idéntica a `(app)` pero con `<TopNav variant="dashboard" />` y `<main>` con `flex-grow` para soportar footer eventual. Compatible con la grid del HTML de management (`h-16` en lugar de `h-20`).
- **Links del nav**: Dashboard → `/dashboard`, Listings → `/dashboard/properties`, Tenants → `/dashboard/tenants` (placeholder), Finance → `/dashboard/finance` (placeholder).
- **Sub-bloque del avatar**: el HTML muestra `name + role` a la izquierda del avatar (`sm:flex` solamente). Se replica: en `sm:` y arriba, junto al Avatar aparece `<div class="flex flex-col items-end"><span>{name}</span><span>{role_label}</span></div>`.
- **Avatar dropdown items**: igual que `(app)`. Si el user es admin, también verá el link a Admin.
- **Guard**: `if (!user) → /login?next=...`. Si `profile.role` ∉ {`agent`, `broker`, `admin`} → `redirect('/')`. Implementado server-side en `layout.tsx`, antes de renderizar children. No depende del middleware (el middleware solo asegura sesión, no rol).

### `(admin)` — solo rol `admin`

- **Estructura**: idéntica a `(dashboard)` con `<TopNav variant="admin" />`. **Sin sidebar lateral** (ver Riesgos: el HTML no lo tiene).
- **Links del nav**: Dashboard → `/admin`, Listings → `/admin/properties`, Users → `/admin/users`, Inquiries → `/admin/inquiries` (placeholder).
- **Avatar dropdown items**: Mi perfil, Dashboard (de agente, opcional), Admin (current), separador, Cerrar sesión.
- **Guard**: `if (!user) → /login`. Si `profile.role !== 'admin'` → `notFound()` (404 en lugar de redirect, alineado con la regla de feature `admin_user_directory`: "cualquier otro rol → 404"). Se hace en el layout antes de renderizar.

## TopNav — anatomía completa

Archivo: `src/components/nav/TopNav.tsx` (Server Component).

### Props

```ts
type TopNavVariant = 'app' | 'dashboard' | 'admin';

interface TopNavProps {
  variant: TopNavVariant;
}
```

El componente no recibe `user` ni `unreadCount` por props: los fetcha él mismo dentro del Server Component (un solo lugar = más fácil de cachear y de mantener). Si por composición el layout ya tiene el `user`, el implementer puede aceptar opcionalmente `{ user, profile, unreadCount }` para evitar doble fetch — decisión menor que se deja al implementer.

### Estructura desktop (md: y arriba)

```
<nav role="navigation" aria-label="Navegación principal"
     class="sticky top-0 z-50 bg-surface border-b border-divider backdrop-blur-md">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16 md:h-20">
      <!-- Cluster izquierdo: logo + nav links -->
      <div class="flex items-center gap-10">
        <Link href={homeHref} class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-DEFAULT bg-surface-inverse flex items-center justify-center">
            <Icon name="apartment" class="text-on-surface-inverse" />
          </div>
          <span class="text-lg font-semibold tracking-tight text-on-surface">
            LuxeEstate
          </span>
        </Link>

        <ul class="hidden md:flex items-center gap-8">
          {links.map(link => (
            <li>
              <Link href={link.href}
                    aria-current={link.isActive ? 'page' : undefined}
                    class={link.isActive
                      ? 'text-primary border-b-2 border-primary pb-1 text-sm font-medium'
                      : 'text-on-surface/70 hover:text-on-surface text-sm font-medium pb-1'}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <!-- Cluster derecho: acciones -->
      <div class="flex items-center gap-4">
        <Link href="/search" aria-label="Buscar"
              class="p-2 text-on-surface hover:text-primary transition-colors">
          <Icon name="search" />
        </Link>

        <NotifBell unreadCount={unreadCount} />

        <!-- Solo en variant=dashboard, name + role visibles md+: -->
        {variant === 'dashboard' && (
          <div class="hidden sm:flex flex-col items-end">
            <span class="text-sm font-semibold text-on-surface">{profile.full_name}</span>
            <span class="text-xs text-muted">{roleLabel(profile.role)}</span>
          </div>
        )}

        <AvatarDropdown user={user} profile={profile} />

        <button class="md:hidden p-2" aria-label="Abrir menú"
                aria-expanded={isOpen} aria-controls="mobile-nav-drawer">
          <Icon name="menu" />
        </button>
      </div>
    </div>
  </div>

  <MobileNavDrawer links={links} variant={variant} />
</nav>
```

### Estructura mobile (debajo de md)

- Los nav links se ocultan (`hidden md:flex`).
- Aparece un botón hamburguesa (`md:hidden`) que abre `<MobileNavDrawer>`.
- El cluster derecho conserva search-icon, notif-bell y avatar, todos visibles.
- El drawer es un Client Component que renderiza un `<dialog>` o un panel deslizable desde la derecha con `aria-modal="true"`, ocupando 80% del ancho de viewport, fondo `bg-surface`, overlay `bg-on-surface/40`.
- Dentro del drawer: misma lista de `links` apilada vertical, padding `px-4 py-2`, item activo con `bg-primary-soft text-primary`, inactivo con `text-on-surface hover:bg-surface-hover`. Al final del drawer, replica los items del Avatar dropdown (perfil, sign out, etc.) para que el menú móvil sea autosuficiente.
- Cerrar con: click en overlay, botón close (icono `close` arriba a la derecha del drawer), tecla Escape, o click en cualquier link interno (auto-cierra y navega).

### Estados

- **Logueado** (todos los shells autenticados): el TopNav siempre asume sesión. Si el layout no le pasa `user`, el TopNav hace el fetch y si vuelve `null` redirige a `/login` (defensivo, no debería pasar en `(app)/(dashboard)/(admin)`).
- **No logueado**: no aplica a estos shells. La pantalla `(auth)` no renderiza TopNav.
- **Loading** del unreadCount: no aplica (Server Component, se renderiza con el dato resuelto).
- **Error** fetching notif count: se renderiza la campana sin el dot, sin throw. Se loggea server-side con `console.warn`.

### Avatar dropdown — items por rol

| Item                                | user |          agent / broker          |            admin             |
| ----------------------------------- | :--: | :------------------------------: | :--------------------------: |
| Mi perfil → `/profile`              |  ✓   |                ✓                 |              ✓               |
| Mis visitas → `/profile?tab=visits` |  ✓   |                —                 |              —               |
| Dashboard → `/dashboard`            |  —   | ✓ (current si variant=dashboard) |              ✓               |
| Admin → `/admin`                    |  —   |                —                 | ✓ (current si variant=admin) |
| separador                           |  ✓   |                ✓                 |              ✓               |
| Cerrar sesión                       |  ✓   |                ✓                 |              ✓               |

El dropdown es un Client Component (`<AvatarDropdown />`) porque necesita estado abierto/cerrado, manejo de teclas (Escape, Tab cycling) y click-outside. Recibe `user`, `profile` y la lista de items derivada server-side y la renderiza. El botón disparador es el `<Avatar>` rodeado de un `<button aria-haspopup="menu" aria-expanded>`.

### Notif badge — lógica de conteo

Tabla: `notifications` (verificada en `src/types/database.ts`).
Columnas relevantes: `recipient_id uuid`, `read_at timestamptz | null`.

> **Nota correctiva**: el líder pidió `where user_id = auth.uid()`. La columna real se llama `recipient_id`. La query debe usar ese nombre.

Query en el **Server Component del layout** (no del TopNav, para no duplicar el client si en el futuro el TopNav se compone manualmente):

```ts
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
let unreadCount = 0;
if (user) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (!error && typeof count === 'number') {
    unreadCount = count;
  }
}
```

Render del badge:

- `unreadCount === 0` → solo el icono `notifications_none`, sin dot.
- `unreadCount > 0` → icono `notifications` (filled), más un dot absoluto `top-1 right-1 w-2 h-2 bg-danger rounded-full ring-2 ring-background`. **No** se renderiza el número exacto en MVP (el mockup tampoco lo muestra, sólo un dot). Eso queda para la feature `notifications_dropdown`.
- El botón es `<Link href="/notifications">` o `<button>` que dispara el dropdown de notificaciones (este último viene en la feature `notifications_dropdown`). En esta feature dejamos un `<button aria-label="Notificaciones (N sin leer)">` que por ahora navega a `/profile?tab=visits` como fallback **o** queda inerte con `disabled` — recomendación: dejarlo como `<button>` no-op con el `aria-label` correcto. El comportamiento real lo añade `notifications_dropdown`.

## AdminSidebar — anatomía

**No se implementa.** Justificación: el HTML de `admin_user_directory_cards/code.html` (líneas 75-104) muestra un `<nav>` horizontal con los mismos elementos estructurales que `(app)` y `(dashboard)`. La nota en `feature_list.json` sobre "navegación lateral diferente" no se sostiene al inspeccionar el código. Implementar un sidebar contradiría el contrato visual del PNG.

Si el humano confirma que **quiere** un sidebar (decisión de producto que pisa al mockup), ver Riesgos para la propuesta alternativa documentada.

## Componentes nuevos a crear

| Archivo                                  | Tipo                              | Propósito                                                                                                                                  |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `src/components/nav/TopNav.tsx`          | Server Component                  | Render del navbar; fetch de user, profile, unreadCount; pasa props a hijos.                                                                |
| `src/components/nav/NavLinks.tsx`        | Server Component                  | Lista de links (`<ul><li><Link/></li>...</ul>`). Recibe el array de links y la ruta actual (via `headers()` o un wrapper).                 |
| `src/components/nav/AvatarDropdown.tsx`  | Client Component (`"use client"`) | Botón con `<Avatar>` que abre menú accesible (Headless: implementación manual con `useState` + `useEffect` para click-outside + keyboard). |
| `src/components/nav/NotifBell.tsx`       | Server Component                  | Wrapper del botón de notificaciones; recibe `unreadCount`. Render puro.                                                                    |
| `src/components/nav/MobileNavDrawer.tsx` | Client Component                  | Drawer lateral con overlay; estado abierto/cerrado, bloqueo de scroll del body, focus trap.                                                |
| `src/components/nav/SkipLink.tsx`        | Server Component                  | `<a href="#main-content">` visually-hidden hasta `:focus`.                                                                                 |
| `src/components/nav/index.ts`            | Barrel                            | Re-exporta todo lo de `nav/`.                                                                                                              |
| `src/lib/auth/get-session.ts`            | Util server                       | Helper `getSessionAndProfile()` que devuelve `{ user, profile }                                                                            | null` evitando duplicar la query en cada layout. |

## Componentes reutilizados (de `src/components/ui/`)

- `Avatar` — para el botón del dropdown y en el drawer mobile. Tamaño `sm` (`h-8 w-8`) en desktop según el HTML.
- `Icon` — para todos los iconos (`apartment` logo, `search`, `notifications`, `notifications_none`, `menu`, `close`, `chevron_down`).
- `Button` (variant `ghost`) — para los items del dropdown si se quiere reusar; opcional, también vale un `<button>` plano dentro del menú.
- `IconButton` — para el botón hamburguesa y el search/notif del cluster derecho. Variant `ghost`, size `md`.
- `Badge` — **NO** se usa aquí (el dot del notif es un span absoluto, no un Badge). Mantenemos Badge para los estados de propiedades.

## Layouts segmentados — archivos exactos

Estructura final en `src/app/`:

```
src/app/
├── (auth)/
│   ├── layout.tsx          ← Minimal: <main>{children}</main>, sin TopNav, redirige si ya hay sesión.
│   └── (existirá login/page.tsx en feature siguiente)
├── (app)/
│   ├── layout.tsx          ← TopNav variant="app" + skip-link + main.
│   └── page.tsx            ← (MOVER el src/app/page.tsx actual aquí; ver Riesgos).
├── (dashboard)/
│   └── layout.tsx          ← TopNav variant="dashboard" + guard role agent/broker/admin.
├── (admin)/
│   └── layout.tsx          ← TopNav variant="admin" + guard role=admin (notFound si no).
├── auth/                   ← (existente, NO se toca; route handlers).
├── dev/                    ← (existente, NO se toca).
├── layout.tsx              ← Root: html + body + fonts. (No cambia).
└── globals.css             ← (No cambia).
```

### `(auth)/layout.tsx`

```ts
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (session?.profile) {
    redirect(getRedirectPathForRole(session.profile.role));
  }
  return <main className="flex min-h-screen items-center justify-center bg-background">{children}</main>;
}
```

### `(app)/layout.tsx`

```ts
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware ya garantiza user existe en rutas protegidas; el root '/' es libre, así que aquí:
  const session = await getSessionAndProfile();
  if (!session?.user) redirect('/login?next=/');
  return (
    <>
      <SkipLink />
      <TopNav variant="app" />
      <main id="main-content" className="flex-1">{children}</main>
    </>
  );
}
```

> **Nota sobre `/`**: actualmente la home (`/`) es pública y la usaremos como home autenticada del user. Si se desea una landing pública aparte, se moverá a una ruta como `/landing` en una feature futura — fuera de scope.

### `(dashboard)/layout.tsx`

```ts
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (!session?.user) redirect('/login?next=/dashboard');
  if (!['agent', 'broker', 'admin'].includes(session.profile.role)) redirect('/');
  return (
    <>
      <SkipLink />
      <TopNav variant="dashboard" />
      <main id="main-content" className="flex-1">{children}</main>
    </>
  );
}
```

### `(admin)/layout.tsx`

```ts
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionAndProfile();
  if (!session?.user) redirect('/login?next=/admin');
  if (session.profile.role !== 'admin') notFound();
  return (
    <>
      <SkipLink />
      <TopNav variant="admin" />
      <main id="main-content" className="flex-1">{children}</main>
    </>
  );
}
```

## Accesibilidad

- **Skip-link**:
  - HTML: `<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded">Saltar al contenido principal</a>`.
  - Se inyecta como **primer** child del layout, antes del `<TopNav>`.
  - El `<main>` lleva `id="main-content"` y `tabindex="-1"` para que reciba foco programático al activarse.

- **Focus visible**: en `globals.css` se añadirá (en una migración aparte si no existe ya) un fallback `:focus-visible` para todos los elementos interactivos con `outline: 2px solid var(--color-primary); outline-offset: 2px;`. En esta feature, los botones y links del nav reciben utility `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background` de forma explícita.

- **Navegación por teclado del drawer**:
  - Al abrir, focus se mueve al primer link del drawer.
  - Trap de foco dentro del drawer hasta que se cierre.
  - Escape cierra el drawer y devuelve el focus al botón hamburguesa que lo abrió (almacenar `triggerRef`).
  - Tab/Shift+Tab ciclan dentro del drawer.

- **Navegación por teclado del dropdown del avatar**:
  - Enter / Space en el botón Avatar lo abre.
  - Flechas Arriba/Abajo navegan entre items (`role="menu"`, `role="menuitem"`).
  - Enter ejecuta el item.
  - Escape cierra y devuelve foco al botón.
  - Tab cierra el menú y mueve foco al siguiente elemento del DOM.

- **ARIA**:
  - `<nav aria-label="Navegación principal">` en el nav desktop.
  - `<nav aria-label="Navegación móvil">` en el drawer.
  - Botón hamburguesa: `aria-expanded`, `aria-controls="mobile-nav-drawer"`, `aria-label="Abrir menú"` (cambia a "Cerrar menú" cuando abierto).
  - Link activo: `aria-current="page"`.
  - Botón notif: `aria-label="Notificaciones, N sin leer"` (dinámico). Si N=0 → `aria-label="Notificaciones"`.
  - Avatar button: `aria-haspopup="menu"`, `aria-expanded`.
  - Skip-link: visible-only-on-focus, leído por screen readers como primer elemento.

- **Contraste**: todas las combinaciones de tokens cumplen WCAG AA (verificado por el design system base — `text-on-surface` sobre `bg-surface` es `#19322F` sobre blanco = ratio ~13:1; `text-primary` sobre `bg-surface` es `#006655` sobre blanco = ratio ~6.7:1).

## Datos

- Tabla `profiles` — columnas `id`, `role`, `full_name`, `avatar_url` (consumida por TopNav para nombre + avatar + dropdown).
- Tabla `notifications` — columnas `recipient_id`, `read_at` (consumida sólo para el conteo unread).
- Ambas tablas tienen RLS activado (verificado en feature `auth_layer`). Las queries del lado del Server Component se ejecutan con el JWT del user → RLS aplica.

Server vs Client:

- **Server Component** por defecto en TopNav, NavLinks, NotifBell, SkipLink. Esto evita doble fetch en el cliente y permite usar `cookies()` y `createClient()` directamente.
- **Client Component** para AvatarDropdown y MobileNavDrawer porque requieren estado local de UI (abierto/cerrado, focus management, escape key). Reciben los datos serializables como props desde el layout.

## Interactividad

- AvatarDropdown: abrir/cerrar (estado local), click outside, escape, focus management.
- MobileNavDrawer: idem + scroll lock del body, focus trap.
- Sign out: el item "Cerrar sesión" del dropdown es un `<form action={signOut}>` con un `<button type="submit">`. Esto evita necesitar JS para invocar la Server Action y es accesible (ya existe `signOut` en `src/lib/auth/actions.ts`).
- Notif bell click: en MVP de esta feature, no-op (el handler lo añade `notifications_dropdown`). El botón existe y es accesible.

## Estados

- **Loading**: el TopNav es Server Component; no renderiza hasta tener data. En Next 16 con streaming, durante el SSR el contenedor del layout aparece pero `<TopNav />` queda dentro del boundary del layout y se resuelve con el resto.
- **Empty**: no aplica (un nav siempre tiene contenido).
- **Error**:
  - Si el fetch de `profile` falla, mostrar TopNav sin avatar (sólo iniciales del email del user vía `<Avatar name={user.email} />`) y loggear server-side.
  - Si el fetch de `unreadCount` falla, render sin dot.
  - Errores en signOut → redirigir a `/login?error=signout_failed`.

## Plan de implementación sugerido

Orden propuesto para el implementer:

1. **Helper de sesión**: crear `src/lib/auth/get-session.ts` con `getSessionAndProfile()` — devuelve `{ user, profile } | null`. Lo usan los 4 layouts y el TopNav.
2. **SkipLink + tokens de focus**: `src/components/nav/SkipLink.tsx`. Verificar que `focus-visible` está cubierto.
3. **TopNav skeleton**: `src/components/nav/TopNav.tsx` Server Component con la variante `app` primero (la más representativa). Renderizar logo + nav links + cluster derecho sin dropdown todavía (avatar como `<Avatar>` puro).
4. **NavLinks** + lógica de `isActive` (vía `usePathname` Client Component **o** server-side leyendo `headers()` para evitar Client — recomendado server-side, lee el path del header `x-pathname` que pone el middleware si lo añadimos; alternativa simple: aceptar `currentPath` como prop y pasarlo desde cada layout).
5. **NotifBell + query**: implementar el `count` de notifications en el layout y pasarlo al TopNav. Probar con un user real con notifications en seed.
6. **AvatarDropdown** Client Component con items derivados del rol.
7. **MobileNavDrawer** Client Component con focus trap y escape.
8. **Variantes `dashboard` y `admin`**: agregar al TopNav los sets de links correspondientes y el bloque de "name + role" para dashboard.
9. **Layouts segmentados**: crear `(auth)/layout.tsx`, `(app)/layout.tsx`, `(dashboard)/layout.tsx`, `(admin)/layout.tsx`.
10. **Mover `src/app/page.tsx`** a `src/app/(app)/page.tsx` para que la home herede el TopNav del shell `(app)`. Verificar que la URL pública sigue siendo `/`.
11. **Smoke test manual**: con un user de cada rol, validar que (a) el TopNav variante correcta aparece, (b) el dropdown muestra los items según rol, (c) el drawer abre/cierra/navega, (d) skip-link funciona con Tab al cargar, (e) signOut funciona desde el dropdown.

## Riesgos

1. **AdminSidebar pedido vs HTML real**: el líder indicó "(admin) tiene shell propio con AdminSidebar lateral. Decisión tomada." El HTML del único mockup admin (`admin_user_directory_cards/code.html`) **no tiene sidebar**: usa la misma TopNav horizontal con links Dashboard/Listings/Users/Inquiries. La regla del proyecto (`docs/conventions.md`, `CLAUDE.md`) establece que el PNG/HTML del mockup es contrato visual y `screen.png` gana sobre cualquier otra decisión. **Recomendación**: NO crear sidebar; usar TopNav variant=admin con los 4 links. Si el humano insiste en sidebar, requiere mockup nuevo o decisión que explícitamente sobreescriba el contrato del PNG — **bloqueo conceptual a aprobar antes de implementar**.

2. **Notificaciones — nombre de columna**: el líder mencionó `where user_id = auth.uid()`. La columna en la tabla es `recipient_id`. Esto se ajusta en el spec; no se requiere migración. Confirmar que el implementer use `recipient_id`.

3. **Home pública vs autenticada**: hoy `/` (en `src/app/page.tsx`) es una página de placeholder pública. Moverla a `(app)/page.tsx` la hace requerir autenticación. **Decisión propuesta**: el MVP no tiene landing pública; un visitante anónimo en `/` debe ser redirigido a `/login`. Esto se alinea con el middleware actual (que ya protege otras rutas). Verificar con el humano si es aceptable o si quiere mantener `/` como landing pública (caso en el que `(app)` no envuelve la home y se vuelve a discutir).

4. **Detección de ruta activa server-side**: Next 16 no expone el pathname al Server Component sin truco. Tres opciones:
   - (a) `usePathname()` en un pequeño Client wrapper (`NavLinkClient`) — añade JS innecesario para un link estático.
   - (b) Pasar `currentPath` como prop desde cada layout (cada layout lo conoce por su segmento, pero el path completo no — fragmentos como `/dashboard/properties/123` no se detectan correctamente).
   - (c) Inyectar `x-pathname` desde el middleware en `request.headers` y leerlo con `headers()` en el server component.
   - **Recomendación**: (c). Es la más limpia y mantiene Server Component puro. Requiere una línea extra en `src/lib/supabase/proxy.ts` (`response.headers.set('x-pathname', pathname)`). Si el humano prefiere no tocar el middleware, caer en (a) con un wrapper minimal.

5. **Dropdown sin librería**: implementarlo a mano (sin Radix/Headless UI) cumple la regla "no introducir dependencias sin consultarlo". El precio es código de accesibilidad (focus trap, escape, click outside) repetido entre AvatarDropdown y MobileNavDrawer. Mitigación: extraer un hook `useDismissable({ onClose, triggerRef })` compartido en `src/lib/utils/`.

6. **Sign out sin JS**: la propuesta de `<form action={signOut}>` requiere que el dropdown del avatar esté abierto en el momento del submit. Como el dropdown se renderiza en el DOM cuando está abierto (Client Component), funciona. Verificar: tras `signOut` Server Action, hace `redirect('/login')` — confirmar en `src/lib/auth/actions.ts:signOut` que existe ese redirect (sí, según el grep previo está implementado).

7. **`notifications_dropdown` futuro**: esta feature deja el botón de notif como un `<button>` no-op. Cuando `notifications_dropdown` (feature pendiente) se implemente, el TopNav debe aceptar children o pasar el slot del bell a un wrapper. **Mitigación**: implementar `<NotifBell unreadCount={n} />` como Server Component que recibe opcionalmente `onOpen` (no aplica server-side) — o, mejor, exportar `<NotifBell>` para que la feature siguiente lo convierta en disparador del dropdown. Documentar este punto de extensión en el código.

## Decisiones del humano (resueltas 2026-05-22)

1. **Sin AdminSidebar**: se usa TopNav variant=admin con los 4 links del mockup. El HTML manda sobre la nota previa de "shell propio".
2. **Home `/` NO se mueve en esta feature**: `src/app/page.tsx` se queda donde está (placeholder público). La feature `app_shell` crea `(app)/layout.tsx` y los demás layouts segmentados, pero la reasignación de la home a `(app)/page.tsx` se resuelve cuando llegue la feature `home_discover_screen`. **Consecuencia**: en esta feature no hay ruta concreta que use `(app)/layout.tsx` — el layout queda creado y listo para que `home_discover_screen` (y otras pantallas de usuario autenticado) lo hereden moviéndose al grupo `(app)`. El smoke test del layout `(app)` se difiere a esa feature; por ahora se verifica que el layout compila y los layouts `(dashboard)` y `(admin)` quedan funcionales (esos sí tienen rutas reales en pipeline).
3. **`x-pathname` en middleware**: aprobado. Se añade una línea en `src/lib/supabase/proxy.ts` (o el archivo de middleware correspondiente) que setea `response.headers.set('x-pathname', request.nextUrl.pathname)`. El TopNav permanece como Server Component puro.

## Criterios de aceptación verificables

- [ ] Existe `src/components/nav/TopNav.tsx` Server Component con prop `variant: 'app' | 'dashboard' | 'admin'`.
- [ ] Existe `src/components/nav/AvatarDropdown.tsx` Client Component con `"use client"` y manejo de keyboard (Escape, Enter, ArrowUp/Down).
- [ ] Existe `src/components/nav/MobileNavDrawer.tsx` Client Component con focus trap y bloqueo de scroll del body.
- [ ] Existe `src/components/nav/SkipLink.tsx` con texto "Saltar al contenido principal".
- [ ] Existen los 4 layouts: `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(admin)/layout.tsx`.
- [ ] El layout `(dashboard)` redirige a `/` si `role` no está en `{agent, broker, admin}`.
- [ ] El layout `(admin)` invoca `notFound()` si `role !== 'admin'`.
- [ ] El layout `(auth)` redirige al rol-home si ya hay sesión.
- [ ] El TopNav lee el unread count desde `notifications` filtrando `recipient_id = user.id` y `read_at IS NULL`.
- [ ] El badge rojo aparece **solo** si `unreadCount > 0`.
- [ ] Cero hex literales en los archivos de `src/components/nav/`.
- [ ] El skip-link aparece visualmente al recibir foco (Tab desde el inicio de la página) y al activarse mueve el foco a `<main id="main-content">`.
- [ ] Avatar dropdown muestra los items correctos por rol según la tabla del spec.
- [ ] Sign out funciona via `<form action={signOut}>` sin JS adicional.
- [ ] El drawer móvil cierra con: click overlay, botón close, tecla Escape, click en link interno.
- [ ] Todos los links del nav usan `<Link>` de `next/link` (no `<a>` plano).
- [ ] El link activo lleva `aria-current="page"`.
- [ ] Botón hamburguesa lleva `aria-expanded` y `aria-controls`.
- [ ] `pnpm lint` y `pnpm type-check` pasan sin errores.

## Alternativas consideradas

### Opción A — Un único `<TopNav>` con prop `variant`

- **Descripción**: componente único parametrizado, renderiza el mismo esqueleto con sets de links distintos. Lo recomendado en este spec.
- **Pros**: una sola fuente de verdad para el layout del nav; cambios visuales (e.g. ajustar padding) se hacen en un solo lugar; menos archivos.
- **Contras**: el componente conoce los 3 variants y crece si se añade un cuarto; los sets de links viven dentro del archivo.

### Opción B — Tres componentes hermanos `<TopNavApp>`, `<TopNavDashboard>`, `<TopNavAdmin>`

- **Descripción**: tres archivos separados, cada layout importa el suyo.
- **Pros**: cada nav es trivial de leer, cero `if/switch`; un cambio en uno no toca los otros.
- **Contras**: 3× el código duplicado (logo, cluster derecho, drawer mobile). Bug en uno hay que arreglarlo 3 veces. Drift visual entre variantes es muy fácil de introducir.

### Opción C — TopNav abstracto + composición con slots

- **Descripción**: `<TopNav>{links}{actions}</TopNav>` recibe children por slot, y cada layout monta sus links.
- **Pros**: máxima flexibilidad, ideal si los 3 variants empiezan a divergir mucho (e.g. admin agrega un breadcrumb, dashboard agrega un quick action).
- **Contras**: indirección extra; en este momento las 3 variantes son **muy** parecidas y la composición es más de la que se necesita; mayor riesgo de inconsistencias en padding/sizing.

**Recomendación**: **Opción A**. Las 3 variantes comparten el 95% del DOM (verificado leyendo los HTML) y sólo difieren en (i) set de links, (ii) presencia del bloque name+role en dashboard, (iii) altura del nav (`h-16` en dashboard/admin, `h-20` en app). Esa diferencia se resuelve con un objeto `VARIANT_CONFIG` interno y `cn()`. Si el día de mañana los 3 navs divergen mucho (e.g. admin agrega sidebar o breadcrumbs), se refactoriza a Opción C sin tocar callsites.

## Notas

- Reutiliza primitivas existentes (`Avatar`, `Icon`, `IconButton`); cero duplicación.
- La feature `notifications_dropdown` (pendiente) extenderá el botón de notif: el slot ya existe y es accesible.
- No se introducen dependencias nuevas (Radix, Headless UI, framer-motion). Si el implementer encuentra que el focus trap manual se vuelve frágil, escalar al líder antes de instalar.
- Material Symbols Outlined ya se carga en `src/app/layout.tsx` — los iconos del nav (`apartment`, `menu`, `close`, `chevron_down`) están cubiertos.
