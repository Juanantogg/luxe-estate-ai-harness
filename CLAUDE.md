@AGENTS.md

El chat, los comentarios y commits siempre en español.

## Rol obligatorio: leader

Actúas siempre como el agente `leader` (ver `.claude/agents/leader.md`).
Tu trabajo es descomponer y coordinar, nunca implementar.
Para cualquier tarea, lanza el subagente apropiado vía la herramienta `Agent`.

### Cuándo NO aplica este rol

- Preguntas conceptuales o de exploración del repo (lectura pura) → responde
  tú directamente, sin lanzar subagentes.
- Cambios fuera de `src/` (docs, configuración, `progress/`) →
  puedes editar tú mismo.
- Sesiones de **definición de proyecto** (poblar `feature_list.json`, derivar
  design tokens de mockups, modelar datos) → puedes editar tú mismo.

# Contexto del proyecto

Este repo es **Luxe Estate**, una app web de bienes raíces. Es un proyecto
de aprendizaje pero debe ser **100% funcional**: auth real, base de datos
real, persistencia real. No mocks en producción.

Los diseños vienen dados en `docs/designs/<screen>/` con un PNG (mockup) y
un `code.html` (referencia HTML). Hay 10 pantallas definidas. Seguirlos al
pie es el contrato visual.

## Decisiones arquitectónicas tomadas

Estas decisiones salieron de una conversación de diseño con el usuario. Los
"por qué" importan para no revertirlas sin pensar:

### Stack: Next.js 16 App Router con SSR/ISR en Vercel
- **Por qué Next y no Astro**: el usuario ya conoce Next; la app tiene auth,
  formularios, dashboards — todo se beneficia de React/Next.
- **Por qué SSR/ISR y no static export**: necesitamos Server Components con
  Supabase server-side, server actions para mutaciones, middleware para
  proteger rutas autenticadas, y revalidación selectiva para listados de
  propiedades. Static export bloquea todo eso.
- **Deploy**: Vercel (compatibilidad nativa con Next 16).
- **Consecuencia**: aprovechamos Server Components por defecto. `"use client"`
  solo donde hay interactividad real (formularios controlados, mapas, sliders).

### Base de datos y backend: Supabase (Auth + Postgres + Storage)
- **Por qué Supabase**: el usuario ya tiene MCP conectado al proyecto
  `eacacybbdrstirdvwwsn`. Cubre auth (incluido OAuth con Google/Apple/
  Facebook), Postgres, Storage para imágenes de propiedades, RLS para
  seguridad por rol, todo en un solo servicio.
- **RLS obligatorio**: cada tabla tiene Row Level Security activado.
  Las reglas se versionan como migraciones SQL.
- **Cliente vs servidor**: usar `@supabase/ssr` (`createServerClient` en
  Server Components/Actions, `createBrowserClient` en Client Components).
  Nunca exponer el `service_role` key al cliente.

### Auth: Email/Password + Google
- **Por qué 2 providers y no 4**: el mockup `social_login_and_registration`
  mostraba Google + Apple + Facebook + GitHub. Decisión tomada en Fase 3:
  Apple requiere developer account de pago y Facebook no aporta valor para
  el MVP. Solo email/password + Google. El login screen renderiza solo
  estos dos métodos — sin botones decorativos para Apple/FB.
- **Magic link**: opcional, decisión diferida hasta diseñar el flujo de
  recuperación de contraseña.

### Roles: User + Agent + Admin
- **Por qué 3 roles**: hay carpetas de diseño para `admin_user_directory_cards`
  y `property_management_dashboard`. El rol intermedio (Agent) publica/
  gestiona sus propiedades; Admin gestiona todo; User navega/favoritea/agenda.
- **Implementación**: tabla `profiles` con columna `role` (`'user' | 'agent'
  | 'admin'`). Políticas RLS por rol.

### Idioma: solo español
- **Por qué no i18n**: scope reducido para un proyecto de aprendizaje.
  Todo en `es-MX`/`es-ES` neutro. Si se agrega inglés después, se replantea
  la arquitectura.
- **Consecuencia**: no hay diccionarios. Los textos van directamente en JSX.
  Esto es una excepción consciente al patrón habitual de Next.

### Mobile-first
- **Por qué**: los mockups en `docs/designs/<screen>/screen.png` son móvil.
  La app se diseña primero para 360-414px, luego se adapta a tablet/desktop.
- **Breakpoints Tailwind**: `sm:` 640, `md:` 768, `lg:` 1024 por default.

### Tipografía: Inter (sustituto de SF Pro Display)
- **Por qué Inter y no SF Pro Display**: SF Pro Display es propiedad de
  Apple, no se puede redistribuir libremente para web. Inter cubre los
  mismos casos visuales con licencia OFL.
- **Carga**: vía `next/font/google` en `src/app/layout.tsx`.

### Paleta de colores
Definida en `docs/conventions.md` (visual) y `docs/design-system.md`
(técnica). Los 4 colores base:
- `Nordic #19322F` — texto principal, headers, navegación
- `Mosque #006655` — botones primarios, acciones
- `Hint of Green #D9ECC8` — tarjetas destacadas, fondos suaves
- `Clear Day #EEF6F6` — fondo general

Se ampliará en Fase 2 con neutrales y semánticos derivados de `docs/designs/`.

### Estructura del repo
- `src/app/` — App Router de Next.
- `src/components/` — componentes reutilizables.
- `src/lib/` — utilidades, clientes Supabase, helpers de auth.
- `src/types/` — tipos TypeScript (auto-generados desde Supabase y manuales).
- `public/` — assets estáticos.
- `docs/` — documentación interna (designs, conventions, design-system, data-model).
- `progress/` — directorio de trabajo de los subagentes.

### Shell público + protección por middleware
- **Por qué cambió**: hasta `home_discover_screen` el layout `(app)/` era el
  guardia ("si entrás acá, hay sesión"). Para que la home y los listados
  funcionen como escaparate público (SEO + experiencia de portafolio sin
  fricción de login), `(app)/layout.tsx` deja de redirigir y delega 100%
  en el middleware.
- **Modelo actual**: las rutas privadas se declaran en `protectedPaths`
  dentro de `src/lib/supabase/proxy.ts` (`/favorites`, `/profile`, `/visits`,
  `/dashboard/*`, `/admin/*`). Cualquier ruta NO listada es pública y debe
  poder renderizar con `session === null`.
- **Consecuencia para features futuras**:
  1. Si una feature toca una página pública, sus componentes deben tolerar
     `user === null` (sin asumir profile, sin pintar acciones autenticadas
     como CTAs sin guard).
  2. Si la feature agrega una página privada nueva, **debe agregar su
     prefijo a `protectedPaths`** en la misma migración del PR. No
     ponerla solo bajo `(app)/` y asumir protección.
  3. RLS de Supabase es la última línea de defensa: si una página pública
     consulta una tabla, la tabla necesita política `for select to anon`.
     Hoy abiertas a `anon`: `properties` (active) y `property_images`
     (de propiedades active). El resto sigue cerrado.
- **`TopNav` variant `app`**: soporta `session === null` con CTAs
  "Iniciar sesión" / "Registrarse" en lugar del avatar dropdown. Variants
  `dashboard` y `admin` siguen exigiendo sesión (redirigen si falta).
- **Active link detection en `TopNav`**: `NavLinks` y `MobileNavDrawer`
  son Client Components que usan `usePathname` + `useSearchParams` y el
  helper `isLinkActive(pathname, search, href)` (en `src/lib/nav/active-link.ts`)
  para resaltar el link activo. **No usar `x-pathname` desde el TopNav**:
  el TopNav vive en `(app)/layout.tsx` y los layouts NO se re-renderean
  al cambiar searchParams en Next 16, así que un cálculo server-side
  quedaría desfasado al togglear entre "Comprar" (`/`) y "Rentar"
  (`/?listing=rent`) vía SPA navigation. El helper compara también el
  query (`listing`) porque path solo no distingue ambos links.

### Helpers RLS de Supabase (`is_admin`, `is_agent_or_above`, `current_user_role`)
- **Tienen que ser `EXECUTE`-ables por el rol `authenticated`** porque las
  policies RLS se evalúan con el rol de la sesión, no con `service_role`.
  Si están solo en `service_role`, cualquier query autenticada que toque
  una tabla con policy `... OR is_admin()` falla con
  `42501 permission denied for function is_admin`.
- **Migración 0011 cometió este error** (revocó EXECUTE de `authenticated`
  asumiendo que solo se invocan vía RPC). **Migración 0015 lo revierte**
  otorgando EXECUTE solo a `authenticated` (no a `anon` — ninguna policy
  de anon usa estas helpers).
- **Trade-off aceptado**: el advisor de seguridad emite
  `authenticated_security_definer_function_executable` WARN porque ahora
  las helpers son invocables vía `/rest/v1/rpc/<name>`. Es aceptable:
  `is_admin()` y compañía solo leen `auth.uid()` y devuelven booleano /
  string del rol, info no sensible (cualquier user puede leer su propio
  rol desde `profiles`). Si en el futuro se quiere silenciar el WARN, el
  fix limpio es convertirlas a `SECURITY INVOKER STABLE` reescribiendo el
  cuerpo, no volver a revocar EXECUTE.

### Aprobación humana opt-in por feature (`requires_approval`)
- Las features en `feature_list.json` pueden marcarse con `requires_approval:
  true` (default `false`).
- Cuando está activo, el leader **pausa** tras la fase de diseño y espera
  aprobación humana del spec en `progress/<feature>/design.md` antes de
  lanzar al implementer.
- **Por qué opt-in**: la mayoría de features son chicas (un componente con
  patrón existente). Forzar aprobación universal sería burocracia. Pero
  features grandes (pantalla nueva, cambios de auth, refactors multi-archivo)
  se benefician de cerrar el spec antes de codificar.

### Overlays `position: fixed` dentro del TopNav → portalizar a `document.body`
- **El problema**: el `<nav>` del `TopNav` es sticky con `backdrop-blur-md`
  (`backdrop-filter: blur`). Por spec CSS, un elemento con `backdrop-filter`
  distinto de `none` se convierte en el **containing block de TODOS sus
  descendientes `position: fixed`** (lo mismo aplica a `transform`, `filter`,
  `perspective`, `will-change` de esas props, y `contain: paint/layout`).
- **La consecuencia**: cualquier overlay/panel/drawer con `fixed` que se
  renderice DENTRO del nav (porque su trigger vive ahí: bell, avatar,
  hamburguesa) se ancla al nav (~64px de alto), NO al viewport. Síntoma:
  bottom-sheets que aparecen pegados al navbar, drawers que ocupan una tira
  de 64px en vez de la pantalla, overlays que solo oscurecen la barra.
- **La regla**: todo elemento `position: fixed` que deba anclarse al viewport
  y cuyo trigger viva en el TopNav **debe portalizarse a `document.body`**
  con `createPortal` de `react-dom`. Guard SSR-safe:
  `typeof document !== 'undefined'` (NO `useState(mounted)` + effect, que
  dispara la regla `react-hooks/set-state-in-effect` activa en el repo). Las
  refs (`panelRef`/`triggerRef`) siguen funcionando tras el portal porque
  apuntan al nodo, no a su posición en el árbol React; el outside-click vía
  `ref.contains(target)` se mantiene.
- **Casos ya migrados** (2026-05-29, los 3 con la misma causa raíz):
  `NotificationsDropdown` (bottom-sheet móvil + popover desktop anclado por
  coordenadas reales del trigger), `MobileNavDrawer` (drawer full-screen).
  Si en el futuro el popover desktop necesita anclarse al trigger tras el
  portal, NO uses `sm:absolute` (deja de anclar al perder el ancestro
  `.relative`): medí `triggerRef.getBoundingClientRect()` en runtime y aplicá
  `top`/`right` vía `style` inline, con listeners de `resize`/`scroll`.
- **Alternativa descartada**: mover el `backdrop-blur` a una capa hermana del
  nav eliminaría la causa, pero el portal es más localizado y no toca el
  TopNav (Server Component compartido por 3 variants).

## Convenciones de código

Reglas duras universales (cero hex en JSX, await params, Server Components
default, etc.) viven en `AGENTS.md`. Aquí solo lo específico del stack:

- **Sistema de color + Tailwind 4.** Los tokens viven en `src/app/globals.css`
  y se exponen como utilities via `@theme` (`bg-primary`, `text-on-surface`,
  `bg-accent`, `border-outline`, etc.). Definición completa en
  `docs/design-system.md`.
- **Imágenes**: `next/image` con `remotePatterns` configurado para Supabase
  Storage. Imágenes locales en `public/`.
- **Tipografía**: Inter via `next/font/google` en `src/app/layout.tsx`.
- **Supabase clients**: helpers en `src/lib/supabase/` — `server.ts`,
  `client.ts`, `middleware.ts`. Nunca instanciar el cliente directo.
- **Server Actions**: para mutaciones (crear propiedad, favoritear, agendar
  visita). Validación con Zod (a discutir como dep en Fase 2).

## Sistema de diseño

- Fuente de verdad de tokens: `docs/design-system.md` (lo crearemos en Fase 2).
- Fuente de verdad de referencia visual: `docs/designs/<screen>/` (PNG + HTML).
- Implementación técnica: `src/app/globals.css` con `@theme` de Tailwind 4.

El designer subagente extrae layout/componentes de los archivos en
`docs/designs/`; no improvisa.

## Harness de desarrollo

El proyecto usa un sistema de orquestación multi-agente:

- **`init.sh`** — health check con dos modos:
  - `./init.sh` (rápido) — deps, lint, type-check. Para arranque de sesión.
  - `./init.sh full` — lo anterior + `pnpm build`. Para cierre de sesión.
- **`feature_list.json`** — backlog estructurado con estado (`pending` /
  `in_progress` / `done` / `blocked`).
- **`.claude/settings.json`** — hooks automáticos:
  - `PostToolUse`: `pnpm lint` + `pnpm type-check` tras cada Edit/Write a `src/`.
  - `Stop`: `pnpm build` completo antes de cerrar sesión.
- **`.claude/agents/`** — 4 subagentes (leader, designer, implementer,
  reviewer). Tabla con propósito y entregable en `AGENTS.md`.
- **`progress/`** — directorio de trabajo. Una carpeta por feature
  (`progress/<feature_name>/` con `design.md`, `review.md` según corresponda)
  + `progress/current.md` como índice de sesión activa. Las carpetas de
  feature se **commitean junto con el código** como evidencia del proceso.
  Solo `progress/current.md` es efímero y está en `.gitignore`.
- **`progress/smoke-tests.md`** — checklist viva con todas las
  validaciones manuales pendientes (cosas que `init.sh full` no verifica:
  browser, email, sesiones múltiples). El **leader** lo mantiene al día:
  cuando una feature cierra como `done` y tiene smoke test pendiente,
  agrega su checklist al archivo antes del commit. El **humano** marca
  `[x]` cuando ejecuta cada test OK. Revisar antes de cerrar sesión para
  no perder pendientes.

## Permisos de modificación del harness

Los agentes pueden modificar ciertas partes del harness como parte de su
flujo normal. Otras partes son **inmutables** para proteger la integridad
del sistema.

| Archivo | ¿Agentes pueden modificar? | Condición |
|---|---|---|
| `feature_list.json` | ✅ Sí | Solo cambiar `status` de la feature asignada |
| `progress/*.md` | ✅ Sí | Escribir specs, reviews — es su propósito |
| `CLAUDE.md` | ⚠️ Solo agregar | Nuevas decisiones arquitectónicas documentadas con "por qué". Nunca eliminar ni modificar reglas existentes |
| `docs/design-system.md` | ⚠️ Solo agregar | Misma regla: agregar decisiones, no cambiar las existentes |
| `docs/data-model.md` | ⚠️ Solo agregar | Misma regla |
| `AGENTS.md` | ❌ No | Requiere aprobación del usuario |
| `.claude/agents/*.md` | ❌ No | Un agente nunca reescribe sus propias reglas ni las de otros |
| `.claude/settings.json` | ❌ No | Los hooks son guardarraíles; modificarlos es desactivar verificaciones |
| `init.sh` | ❌ No | Requiere aprobación del usuario |
| `.claude/skills/` | ❌ No | Gestionadas por el usuario |
| Migraciones SQL aplicadas | ❌ No | Las migraciones ya aplicadas son inmutables; se crean migraciones nuevas para revertir |

**Regla general:** si modificar algo cambia cómo se evalúa o se controla el
trabajo de un agente, ese algo es inmutable sin aprobación humana.

## Comandos

```bash
pnpm dev          # servidor de desarrollo (http://localhost:3000)
pnpm build        # build de producción
pnpm start        # sirve el build
pnpm lint         # ESLint
pnpm type-check   # TypeScript sin errores
./init.sh         # verificación rápida (deps + lint + type-check)
./init.sh full    # verificación completa (+ build)
```

## Supabase MCP

El proyecto Supabase está conectado vía MCP (`eacacybbdrstirdvwwsn`). Esto
permite al leader/agentes:
- Listar/crear tablas (`list_tables`, `apply_migration`).
- Ejecutar SQL (`execute_sql`) — solo lectura segura; mutaciones siempre via migración.
- Generar tipos TypeScript (`generate_typescript_types`) → `src/types/database.ts`.
- Ver logs y advisors (`get_logs`, `get_advisors`).

**Antes de aplicar migraciones**, verificar con `list_tables` el estado actual
y con `get_advisors` posibles problemas de seguridad.
