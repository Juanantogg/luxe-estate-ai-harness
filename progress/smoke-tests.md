# Smoke tests pendientes

Checklist viva de validaciones manuales que requieren al humano interactuando
con la app (cosas que `init.sh full` no puede verificar: browser, email,
sesiones múltiples, etc.).

**Cómo usarlo:**

- Cada feature que requiera smoke test agrega su entrada aquí cuando el
  reviewer aprueba.
- El humano marca `[x]` cuando ejecuta el test OK. Si falla, deja `[ ]` y
  agrega nota en la línea siguiente con el comportamiento observado.
- Al cerrar sesión, revisar este archivo para no olvidar pendientes.
- Si un test queda obsoleto (la feature cambió o se reemplazó), tacharlo
  con `~~strikethrough~~` en lugar de borrar, para preservar historial.

---

## Features cerradas con smoke tests pendientes

### `auth_layer` (cerrada 2026-05-22)

Spec original tenía 17 pasos end-to-end, diferidos hasta que existiera
`login_screen`. Hoy login_screen existe — el test es ejecutable.

> **Smoke ejecutado 2026-05-29 (Dario, playwright-cli headed).** Los checks
> que NO requieren email real ni OAuth: 5/5 PASAN (login 3 roles +
> 2 de middleware). Los 3 restantes (signup+verificación, Google OAuth,
> password reset) siguen pendientes porque requieren email/OAuth real.
> Password de todos los users seed: `LuxeEstateSeed2026!`. Login screen
> renderiza solo Google + email/password (sin Apple/FB, como manda
> CLAUDE.md). NOTA sobre el check de signup duplicado: ver abajo.

- [x] Login con email/password de seed (admin@luxe-estate.test) →
      redirige a `/admin/users` (cae en `/admin`; `/admin` redirige a
      `/admin/users`). (2026-05-29)
- [x] Login con seed agent (marcus@luxe-estate.test) → redirige a
      `/dashboard`. (2026-05-29)
- [x] Login con seed user (elena@luxe-estate.test) → redirige a `/`.
      (2026-05-29)
- [ ] Signup con email nuevo → recibe correo de verificación → click
      link → entra a `/`. **NO EJECUTADO** (requiere email real).
- [ ] Signup con email ya registrado → error inline en form. **NO
      EJECUTADO en este smoke** (Supabase no revela si el email existe por
      diseño anti-enumeración; el comportamiento real conviene validarlo
      junto con el flujo de signup+email cuando se libere el rate-limit).
- [ ] Google OAuth → flujo completo. **NO EJECUTADO** (requiere cuenta
      Google real / consent screen).
- [ ] Request password reset → recibe correo → click link → cambia
      password → puede login con nueva. **NO EJECUTADO** (requiere email
      real).
- [x] Middleware: navegar a `/profile` sin sesión → redirige a `/login`.
      (2026-05-29, cookies limpias → `/profile` rebota a `/login`)
- [x] Middleware: navegar a `/admin` siendo user → 404 (no admin).
      (2026-05-29, elena/user navegó a `/admin` → 404)

### `app_shell` (cerrada 2026-05-22)

- [x] TopNav variante `app` para user logueado: links Comprar/Rentar/
      Vender/Guardados + search + notif badge + avatar dropdown.
      (2026-05-26, elena, dropdown sin Dashboard/Admin como esperado)
- [ ] TopNav variante `dashboard` para agent.
- [ ] TopNav variante `admin` para admin.
- [x] TopNav variante `app` para user **no logueado**: muestra CTAs
      "Iniciar sesión" / "Registrarse" en lugar de avatar.
      (2026-05-26, validado)

> Hallazgos del smoke (2026-05-26, Dario):
> (1) link 'Vender' → `/sell` da 404;
> (2) link 'Guardados' → `/favorites` se muestra sin sesión y redirige a
> login (UX mejorable: ocultar si no hay sesión).
> Agregado al backlog como `topnav_dead_links_cleanup`. También detectados
> 4 links muertos en variants dashboard/admin (revisar al testear esas
> variants).

- [x] Mobile (≤640px): nav colapsa a hamburguesa abriendo drawer.
      **FALLABA — CORREGIDO el mismo día (misma causa raíz que el
      bottom-sheet de notificaciones).** El bug: a 375px el drawer no
      ocupaba la pantalla, aparecía como una tira de ~64px pegada al navbar
      (panel height=64 en vez de 800; overlay también 64px). **Causa:** el
      `<nav>` sticky tiene `backdrop-blur-md` (`backdrop-filter: blur`), que
      por spec CSS lo convierte en containing block de sus descendientes
      `position: fixed`. El `MobileNavDrawer` se renderiza dentro del nav,
      así que su `<div fixed inset-0>` raíz se anclaba al nav, no al
      viewport. **Fix aplicado** (reviewer APPROVED): portalizar el bloque
      overlay+panel a `document.body` con `createPortal`. Verificado
      post-fix: panel height=800 (full viewport), anclado a la derecha,
      overlay full-screen con parent=body; Escape / click-overlay / X del
      header / click-en-link cierran correctamente; focus-trap y scroll-lock
      intactos. (2026-05-29)
- [x] Avatar dropdown muestra links según rol y signOut funciona.
      (2026-05-26, elena role=user: dropdown muestra solo "Perfil" +
      "Cerrar sesión"; signOut redirige a /login)
- [ ] Skip link de a11y: tab al cargar → enfoca "Saltar al contenido".

### `home_discover_screen` (cerrada 2026-05-22)

- [x] Home pública (sin sesión) carga sin errores. (2026-05-26)
- [x] Featured Collections muestra propiedades is_featured=true. (2026-05-26)
- [x] New in Market grid responsivo (2 cols sm, 3 cols md, 4 cols lg).
      (2026-05-26, validado visual a 1 breakpoint)

> Hallazgos visuales en la home (2026-05-26, Dario):
> (1) HeroSearch: mismatch de radius entre input (rounded-xl) y botón
> "Buscar" (rounded-DEFAULT) — el botón se ve cuadrado pegado;
> (2) ListingTypeToggle (Todas/Comprar/Rentar): estado activo usa
> bg-surface-inverse (negro) en lugar de bg-primary (mosque). Incoherente
> con el resto del sistema.
> Agregado al backlog como `home_hero_visual_polish`.

- [x] Toggle Buy/Rent filtra por listing_type. (2026-05-26, filtrado
      funcional; bug visual del estado activo documentado aparte en
      `home_hero_visual_polish`)
- [x] Chips de property_type filtran (All / House / Apartment / Villa /
      Penthouse). (2026-05-26, filtrado funcional, color verde en activa,
      "Todas" actúa como reset)

> Hallazgo adicional (2026-05-26, Dario): `/?listing=sale` NO marca
> "Comprar" activo en el TopNav (sí lo hace `/?listing=rent` con "Rentar").
> Causa: el link "Comprar" en TopNav es `href='/'` y el helper isLinkActive
> hace match exacto de `listing`. Agregado al backlog como
> `topnav_active_link_listing_sale`.

- [x] Heart en card sin sesión → redirige a /login con next.
      (2026-05-26, redirect a `/login?next=%2F` confirmado)
- [x] Heart en card con sesión → toggle favorite con optimistic UI.
      (2026-05-26, elena, toggle sin recarga)
- [x] Load more aumenta resultados. (2026-05-26, funciona, pero seed tiene
      solo 11 properties — se agota en 1-2 clicks; agregado al backlog
      `seed_more_properties`)

> Hallazgo adicional (2026-05-26, Dario): las properties featured aparecen
> DUPLICADAS — en "Colecciones destacadas" Y en "Nuevas en el mercado".
> Causa: getNewInMarketProperties no filtra is_featured. ~~Agregado al
> backlog como `home_exclude_featured_from_new_in_market`.~~ Cerrada
> 2026-05-27 (ver checklist abajo).

### `home_exclude_featured_from_new_in_market` (cerrada 2026-05-27)

- [x] Navegar a `/` (sin filtros) → ninguna property se repite entre
      "Colecciones destacadas" y "Nuevas en el mercado". (2026-05-27)
- [x] Navegar a `/?listing=rent` → idem, sin duplicados; si las únicas
      properties de rent eran featured, "Nuevas en el mercado" muestra
      empty state (decisión cerrada: aceptable). (2026-05-27)
- [x] Navegar a `/?type=villa` → idem, sin duplicados. (2026-05-27)

### `home_hero_visual_polish` (cerrada 2026-05-27)

- [x] Navegar a `/`: el botón "Buscar" del HeroSearch tiene radius
      `rounded-lg` (más redondo que antes); ya no se ve cuadrado pegado
      al input `rounded-xl`. La diferencia residual (lg vs xl) es
      intencional (jerarquía visual). (2026-05-27)
- [x] `ListingTypeToggle` (Todas/Comprar/Rentar): la opción activa
      ahora es mosque verde (`bg-primary`), no negro Nordic. Click
      entre opciones cambia el color verde correctamente. (2026-05-27)
- [x] `PropertyTypeChips` (Todas/Casa/Apartamento/Villa/Penthouse):
      el chip activo también pasa a mosque verde. Coherente con el
      toggle de arriba. (2026-05-27)
- [x] `/dev/ui` sección Chips: el primer chip (variant="selected")
      se ve en mosque, no en negro. Tab al chip → focus ring visible.
      (2026-05-27)

### `seed_more_properties` (cerrada 2026-05-27)

Validar visualmente que el seed ampliado (49 properties, 6 imágenes por
property) entrega lo prometido. Pre-requisito: tener `SUPABASE_SERVICE_ROLE_KEY`
en `.env.local` y haber corrido `pnpm db:seed` al menos una vez.

> **Smoke ejecutado 2026-05-29 (Dario, playwright-cli headed + REST).**
> 7/7 PASAN tras el fix. El único PARCIAL (hero incoherente en las 10
> properties del seed original) fue corregido el mismo día por
> `seed_legacy_hero_mismatch` (flag `--reseed-images` + reemplazo de una
> foto mal curada del pool apartment). Datos verificados: 49 properties,
> todas con exactamente 6 imágenes.

- [x] Home pública: "Nuevas en el mercado" arranca con 8 cards; "Cargar
      más propiedades" (link `?limit=N`, SSR) rinde **4 clicks**
      (8→16→24→32→38) antes de agotarse. 38 ≫ 20 mínimo. (2026-05-29)
- [x] Variedad visual real: en las 40 cards visibles, **0 pares
      adyacentes** comparten la misma foto de hero (27 fotos únicas entre
      40 cards — hay reutilización del pool pero nunca dos seguidas
      iguales). (2026-05-29)
- [x] Chips de property_type filtran a counts visibles: House 13,
      Apartment 12, Villa 6, Penthouse 9 (cumple House/Apt >10,
      Villa/Penthouse >5). (2026-05-29)
- [x] Toggle Buy/Rent: ambos lados con cards — sale 25, rent 17. Ninguno
      vacío. (2026-05-29)
- [x] Detail: **galería de 6 imágenes confirmada en TODAS las probadas**
      (house, apartment, penthouse, condo, townhouse: tablist "Mostrar
      imagen X de 6", 1 hero + thumbnails). El hero coherente-con-tipo
      fallaba en las 10 properties del seed original (creadas 2026-05-21,
      antes de `EXTERIOR_BY_TYPE`; la idempotencia por conteo de
      `seedPropertyImages` impedía corregirlas) — **CORREGIDO el mismo día**
      por `seed_legacy_hero_mismatch`: flag `pnpm db:seed --reseed-images`
      regenera las imágenes con el pool por tipo (10/10 heros coherentes
      verificados). Además se reemplazó una foto mal curada del pool
      apartment (`photo-1572120360610`, era una casa con porche) →
      `photo-1522708323590` (interior urbano). Verificado en browser:
      "Azure Heights Penthouse" muestra interior de penthouse, "Urban
      Loft" muestra interior de apartamento. (2026-05-29)
- [x] condo/townhouse: hero del pool general — "Battery Park Condo"
      (terraza con vista al mar) y "Pearl Townhome" (fachada blanca
      moderna) se ven decentes, no rotos. (2026-05-29)
- [x] Re-correr `pnpm db:seed`: imprime "→ ya existe property…" y
      "→ ya hay 6 imágenes…" para todo; conteos sin cambio antes/después
      (49 properties, 294 imágenes). Idempotencia confirmada. (2026-05-29)

### `topnav_dead_links_cleanup` (cerrada 2026-05-27)

Matriz de links esperada por variant/sesión:

- [x] TopNav variant `app` SIN sesión: solo "Comprar" y "Rentar"
      visibles (sin "Vender" ni "Guardados"). Mobile drawer respeta
      lo mismo. (2026-05-27)
- [x] TopNav variant `app` CON sesión (elena): "Comprar", "Rentar",
      "Guardados" (3 links). Sin "Vender". (2026-05-27)
- [x] TopNav variant `dashboard` (marcus o admin): "Dashboard",
      "Propiedades" (2 links). Sin "Inquilinos" ni "Finanzas".
      (2026-05-27)
- [x] TopNav variant `admin` (admin@luxe-estate.test): "Dashboard",
      "Usuarios" (2 links). Sin "Propiedades" ni "Consultas".
      (2026-05-27)
- [x] Mobile (≤640px): drawer hamburguesa muestra los mismos links
      filtrados (no aparecen los muertos). (2026-05-27)

### `topnav_active_link_listing_sale` (cerrada 2026-05-27)

Verificar que el helper `isLinkActive` relajado marca 'Comprar' activo
para los 3 estados del `ListingTypeToggle` correctamente.

> **Smoke ejecutado 2026-05-29 (Dario, playwright-cli headed + eval del
> `aria-current`).** 6/6 PASAN. El link activo se marca con
> `aria-current="page"` (en TopNav `NavLinks` y en `MobileNavDrawer`); el
> toggle de la home usa `aria-pressed`. Se verificó ambos atributos en cada
> estado. El bug original (`/?listing=sale` no marcaba 'Comprar') quedó
> confirmado como corregido.

- [x] Navegar a `/` (sin query) → TopNav 'Comprar' activo, 'Rentar'
      inactivo. (2026-05-29, `aria-current`: Comprar=page, Rentar=null)
- [x] En la home, clickear toggle "Comprar" → URL pasa a
      `/?listing=sale` → TopNav 'Comprar' SIGUE activo, 'Rentar'
      inactivo. (2026-05-29, URL=/?listing=sale, Comprar=page; toggle
      Comprar aria-pressed=true)
- [x] Clickear toggle "Rentar" → URL pasa a `/?listing=rent` → TopNav
      'Rentar' activo, 'Comprar' inactivo. (2026-05-29, URL=/?listing=rent,
      Rentar=page, Comprar=null)
- [x] Clickear toggle "Todas" → URL vuelve a `/` → TopNav 'Comprar'
      activo nuevamente. (2026-05-29, URL=/, Comprar=page)
- [x] Mobile drawer: abrir hamburguesa en cada uno de los 3 estados,
      verificar que el link resaltado coincide con el TopNav desktop.
      (2026-05-29, viewport 375px: drawer en / → Comprar=page; en
      /?listing=sale → Comprar=page; en /?listing=rent → Rentar=page.
      Coincide con desktop en los 3.)
- [x] Navegar manualmente a `/?listing=foo` (valor desconocido) →
      NINGÚN link del TopNav queda activo (comportamiento defensivo
      intencional). (2026-05-29, Comprar=null, Rentar=null — pese a que
      'Comprar' es href=/, el listing=foo evita el match)

### `property_pretty_urls` (cerrada 2026-05-29)

URLs `/property/<uuid>` migradas a `/property/<slug>` con redirect 308
para links legacy. Slug autogenerado por trigger DB, inmutable.

> **Smoke ejecutado 2026-05-29 (Dario, playwright-cli headed + curl + REST).**
> Resumen: 6/8 PASAN. 2 hallazgos abajo (redirect NO es 308 HTTP; Check 7
> del spec estaba mal escrito). 1 observación de bug ortogonal (form de
> edición de property no persiste cambios vía UI). Detalle por check.

- [x] **Como anon: UUID legacy active → redirige a slug.** La URL del
      browser cambia a `/property/<slug>` y el detalle renderiza normal.
      **HALLAZGO (no es 308 HTTP):** la ruta `/property/[slug]` tiene
      `loading.tsx`, lo que la vuelve un _streaming context_. En streaming,
      Next 16 NO emite un 308 HTTP — inserta
      `<meta id="__next-page-redirect" http-equiv="refresh" url=/property/<slug>>`
      y el redirect ocurre **client-side** (confirmado con curl en dev :3000
      y prod :3100: ambos devuelven `200 OK` + el meta-refresh, num_redirects=0).
      El comentario en `page.tsx:48` ("El 308 ... SEO lo preserva como
      permanente") es **incorrecto** para esta ruta: un meta-refresh no
      equivale a un 308 a ojos de Google. Ver doc Next
      `redirect.md:11` ("When used in a streaming context, this will insert
      a meta tag to emit the redirect on the client side"). **Acción
      sugerida:** o aceptar el meta-refresh y corregir el comentario, o
      mover el redirect legacy a Proxy/middleware para emitir un 308 real.
      Agregado al backlog como `property_legacy_redirect_not_308`.
      (2026-05-29)
- [x] Como anon: navegar directo a `/property/<slug>` → `200 OK`, sin
      meta-refresh (verificado con curl: `__next-page-redirect` count = 0).
      (2026-05-29)
- [x] Como anon: navegar a slug de property NO-active (pending
      `sunset-apartments-miami-c315`) → **renderiza la página 404**
      (heading "404", title "404: This page could not be found"). La RLS
      `for select to anon where listing_status='active'` la filtra. Nota:
      el status HTTP es `200` (mismo artefacto de streaming que el
      redirect — `notFound()` también viaja en el payload), pero el
      usuario ve 404. Funcionalmente correcto. (2026-05-29)
- [x] Como agent (marcus): el form de edición muestra la sección "URL
      pública" con el slug en un `<code>` read-only +
      "La URL no cambia aunque edites el título. Generada al crear la
      propiedad." **Inmutabilidad confirmada a nivel trigger DB:** un
      UPDATE directo del `title` NO regenera el `slug` (el trigger solo
      genera al crear). El link "Ver" del dashboard usa el slug.
      **OBS (bug ortogonal — YA CORREGIDO):** el form de edición NO
      persistía el cambio de título vía UI (la action redirigía a
      /dashboard pero el title seguía igual en DB). Confirmado como bug
      REAL (no artefacto): stale closure en el `useCallback` `submit` de
      `PropertyForm.tsx` que omitía `state.values` en sus deps y
      serializaba valores stale. **Corregido y verificado 2026-05-29**
      (`doSubmit` → useCallback con deps completas; reviewer APPROVED).
      Feature `property_edit_form_not_persisting` cerrada `done`.
      (2026-05-29)
- [x] Como agent: el form de **creación** NO muestra "URL pública"
      (0 ocurrencias). **Slug autogenerado confirmado:** al insertar una
      property nueva (title "Casa Smoke Test Pretty Url", city "Austin",
      type "house") el trigger generó
      `casa-smoke-test-pretty-url-austin-a74b` — formato
      `<title-slug>-<ciudad>-<4hex>` correcto (los 4 hex coinciden con el
      prefijo del UUID). La property fue navegable por su slug (200) y su
      UUID redirigió al slug. Limpiada tras el test. **OBS:** no se pudo
      publicar vía el form UI — los 3 inputs numéricos (precio/área/año)
      no registran su valor en el estado de React con playwright-cli
      (validación Zod los ve `null`), limitación de la herramienta con
      inputs controlados, no del feature. La garantía core se validó a
      nivel trigger DB. (2026-05-29)
- [x] Como user (elena) con notif `price_drop` que referencia property:
      abrir dropdown, click → la navegación termina en
      `/property/skyline-penthouse-new-york-8d2f` (slug). En Network se ve
      el RSC fetch al **UUID** (`8d2f4e57...` → 200 con el redirect en el
      payload RSC) seguido del fetch al **slug**. Confirma UUID→slug,
      aunque en navegación SPA el redirect viaja en el payload RSC (200),
      no como 308 HTTP (consistente con el hallazgo del primer check).
      (2026-05-29)
- [x] ~~Como agent: notif `visit_confirmed` → click → termina en
      `/property/<slug>`.~~ **SPEC ERRÓNEO — comportamiento real es
      correcto.** En `src/lib/notifications/derive.ts:43-45`, las notifs
      `visit_confirmed` y `visit_reminder` con `visit_id` navegan SIEMPRE
      a `/profile?tab=visits`, NUNCA a `/property/<slug>` (por diseño:
      gestión de visitas, no detalle público). Verificado como david:
      click en "Nueva visita agendada" → `/profile?tab=visits`. Las notifs
      que SÍ van a property (`new_property`/`price_drop`/`favorite_update`,
      derive.ts:38-41) ya se validaron en el check anterior. Este check
      del spec debe corregirse/eliminarse. (2026-05-29)
- [x] `/property/<slug>/schedule`: como **no-owner** (elena sobre
      `forest-retreat-portland-8086`) → 200, URL se mantiene, renderiza el
      scheduler ("Agendar una visita" / "Horarios disponibles" /
      "Confirmar visita"). Como **owner** (david sobre su propia property)
      → redirige a `/dashboard/properties/<uuid>/edit` (lo saca del flujo
      de agendar). Mismo comportamiento que con UUID. (2026-05-29)

### `admin_user_directory` (cerrada 2026-05-26)

Verificación manual original más la del fix 0026 de hoy.

- [x] Invite end-to-end OK (`broujeteixeiru-5511`, 2026-05-27): email
      llega → click link → set password → entra como agent.
- [ ] Suspend con 2 navegadores:
  - [ ] Navegador A (admin) suspende a marcus@luxe-estate.test.
  - [ ] Navegador B (Marcus logueado) intenta navegar → sale a /login.
  - [ ] Intentar login con cuenta suspendida → rechazado.
  - [ ] Reactivar desde A → B puede login.
- [ ] Cambio de rol con notification: cambiar rol de anna@luxe-estate.test
      a agent → badge de notif aparece en su sesión.
- [ ] Self-protection visual: en `/admin/users` la fila del admin
      caller está con bg-surface-soft y botón disabled.

### `invitation_status_indicator` (cerrada 2026-05-26)

- [x] Tab "Invitaciones" al final con badge count (2026-05-26 tras fix).
- [x] Fila pending muestra "Invitado pendiente" + Avatar away + botón
      disabled.
- [x] Tabs por rol excluyen pendings (verificado tab Agentes sin
      broujeteixeiru-5511).
- [ ] Confirmar email del invitado → fila desaparece de Invitaciones y
      aparece en tab del rol como Activo. **PARCIAL** (broujeteixeiru-5511
      confirmó OK el 2026-05-27 y pasó a Activo; queda re-test cuando
      rate-limit se libere).

### `notifications_dropdown` (cerrada 2026-05-26)

Smoke tests del spec §10 R10. La feature no tiene mockup y no hay
referencias previas en el repo de un panel similar, así que estos tests
son la primera validación visual.

> **Smoke ejecutado 2026-05-29 (Dario, playwright-cli headed + service role
> para datos + Network requests).** 8/10 PASAN, **1 FALLA** (mobile
> bottom-sheet + overlay rotos por `backdrop-blur` del nav), 1 NO ejecutado
> (empty state, requiere user limpio). Las 4 notifs del seed de elena
> estaban en estado leído (las marcó un smoke previo del 27-may); se
> resetearon a no-leídas para el test y se restauraron a leídas al cerrar.
> Bucket "Hoy" no aplica: las notifs son del 21-may/27-may, así que caen en
> "Esta semana" / "Anteriores" (bucketing por fecha correcto).

- [x] Abrir el panel con notifs sin leer (elena@luxe-estate.test): el
      panel abre como `dialog`, items con dot izquierdo (`bg-primary`) y
      `bg-primary-soft` en los 4 unread; íconos por tipo (info,
      chat_bubble, trending_down, notifications_active). Buckets reales:
      "Esta semana" + "Anteriores" (no "Hoy", ver nota arriba). (2026-05-29)
- [x] Click en notif con `property_id` (`price_drop`) → navega a
      `/property/skyline-penthouse-new-york-8d2f` (slug, no UUID — consistente
      con `property_pretty_urls`) y el conteo del bell baja 4→3 (dot
      desaparece). (2026-05-29)
- [x] Click en notif `new_message` (sin property_id) → NO navega (URL
      sigue `/`), solo marca leída (3→2). **OBS:** el panel se CIERRA tras
      el click (no queda abierto). Es por diseño: `handleItemClick` en
      `NotificationsDropdown.tsx:247` llama `onClose()` SIEMPRE, navegue o
      no. El spec no exige que quede abierto, así que se considera PASA.
      (2026-05-29)
- [x] Botón "Marcar todas como leídas" → panel SIGUE abierto, los items
      pierden dot y `bg-primary-soft` (0/0), el bell pasa de "2 sin leer"
      a "Notificaciones" (dot rojo apagado). (2026-05-29)
- [x] Insertar notif vía service role (`type=system`) con panel abierto y
      pestaña visible → tras ~34s la notif aparece sin recargar (4→5 items,
      bell "1 sin leer"). Polling de 30s (`POLL_INTERVAL_MS`) confirmado.
      (2026-05-29)
- [x] Pestaña inactiva (visibilitychange→hidden): 35s sin un solo poll a
      `/api/notifications/recent` (contador en 4, delta 0); volver a
      visible → 1 fetch inmediato (4→5). Pausa + reanudación correctas.
      (2026-05-29)
- [x] Mobile (≤640px): el panel se renderiza como bottom-sheet anclado
      abajo con overlay; click en overlay cierra. **FALLABA — CORREGIDO el
      mismo día.** El bug: a 375px el `dialog` (`fixed inset-x-0 bottom-0`)
      NO se anclaba al fondo del viewport (medido rectBottom=64 en vez de
      800), y el overlay solo cubría 64px. **Causa root:** el `<nav>` sticky
      tiene `backdrop-blur-md` (`backdrop-filter: blur(12px)`), que por spec
      CSS convierte al nav en el _containing block_ de sus descendientes
      `position: fixed`. Como el `NotificationsDropdown` se renderiza DENTRO
      del nav (el bell vive ahí), su `fixed` se anclaba al nav (~64px), no
      al viewport. **Fix aplicado** (reviewer APPROVED): (1) portalizar
      overlay+dialog a `document.body` con `createPortal` → recuperan el
      viewport como containing block; (2) anclar el popover DESKTOP por
      coordenadas reales del trigger (`getBoundingClientRect`, medido en
      runtime con listeners resize/scroll) en vez de offsets de clase
      mágicos, porque tras el portal el `sm:absolute` ya no anclaba al bell.
      Verificado post-fix: móvil rectBottom=800 + overlay full-screen +
      click-overlay cierra; desktop popover right coincide EXACTO con el
      bell (1200/1200 a 1280px, 828/828 a 900px), top=68, sigue al bell al
      scrollear. Bonus: se corrigió un radius asimétrico en el popover
      desktop (las 4 esquinas ahora a 16px=`rounded-lg`, igual que el avatar
      dropdown; antes el top quedaba recto por `rounded-t-none` + tokens de
      radius custom del proyecto donde `--radius-lg`=1rem, no 8px). (2026-05-29)
- [x] Desktop (≥640px): popover anclado al bell (top 68, ancho 352px a la
      derecha, no full-width); un click real fuera lo cierra. (Nota: el
      outside-close escucha `pointerdown`, así que un `.click()` sintético
      no lo dispara — solo el click real con mouse. No es bug.) (2026-05-29)
- [x] `Escape` cierra el panel y devuelve foco al bell (verificado en
      desktop). (2026-05-29)
- [ ] Empty state: con un user sin notificaciones → ver "No tienes
      notificaciones". **NO EJECUTADO** (requiere crear/truncar un user
      limpio; el componente `EmptyNotifications` existe pero no se validó
      en browser).

### `resend_invitation_button` (cerrada 2026-05-27)

- [x] Forzar `last_invited_at` al pasado → botón "Reenviar invitación"
      aparece en la fila pending (2026-05-27, broujeteixeiru-5511).
- [x] Click botón → loading → email nuevo llega a yopmail →
      confirmar OK (2026-05-27).
- [x] Si `last_invited_at < 1h` → botón "Pendiente" disabled con
      tooltip (verificado por el cálculo server-side).
- [x] Error 429 mapeado a "Demasiadas invitaciones recientes."
      (2026-05-27, gaummogrennonnoi-4517).
- [ ] **Re-test end-to-end del trigger 0026 con invite nuevo**:
      invitar yopmail desde cero → fila aparece como pending
      AUTOMÁTICAMENTE (sin backfill manual). **BLOQUEADO por rate-limit
      hasta ~2026-05-27 02:30 UTC**.

### `invite_error_landing` (cerrada 2026-05-27)

Cubre el primitivo `Toast` nuevo + el listener de errores de auth + la
migración de los 2 call sites existentes (VisitScheduler,
ResendInvitationButton).

**Listener — los 3 codes en URL manual:**

> ✅ Bug de StrictMode resuelto por `fix_auth_error_listener_and_toast_polish`
> (cerrada 2026-05-27): listener pasa a `useRef` como side-channel entre
> mounts para preservar el ParsedError. Falta validar en browser (dev +
> prod) que el toast aparece como se espera.

- [ ] Navegar a `http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
      → aparece toast warning con "El link de invitación expiró. Pídele
      al admin que te envíe uno nuevo." → URL queda `http://localhost:3000/`
      sin hash → toast desaparece solo a los ~6s.
- [ ] Navegar a `http://localhost:3000/#error=access_denied&error_code=access_denied&error_description=Unauthorized`
      → toast con "El link ya fue usado o no es válido. Si necesitas
      otro, pídeselo al admin."
- [ ] Navegar a `http://localhost:3000/#error=server_error&error_code=potato&error_description=test`
      → toast con copy fallback "Hubo un problema con tu link de
      autenticación. Intenta de nuevo o pídele al admin un link nuevo."
- [ ] Repetir el primer caso en `pnpm build && pnpm start` y reportar
      en notes si el bug existía en prod o no (StrictMode no aplica en
      prod, pero el fix con useRef es inocuo).

**Listener — casos negativos:**

- [x] `http://localhost:3000/` (sin hash) → NO aparece toast. (2026-05-26)
- [x] `http://localhost:3000/#new-in-market` → NO aparece toast; el hash
      se conserva en la URL. (2026-05-26)
- [x] `http://localhost:3000/#access_token=foo&type=signup` → NO aparece
      toast. (2026-05-26)

**Listener — interacción:**

> Desbloqueados por `fix_auth_error_listener_and_toast_polish` (cerrada
> 2026-05-27). Re-ejecutar.

- [ ] Test 1 + pulsar Escape antes de 6s → toast cierra inmediatamente.
- [ ] Test 1 + clickear botón X → toast cierra inmediatamente.
- [ ] Test 1 + Back del browser después del toast → navega a la página
      previa (no a la URL con hash), confirma que `replaceState` no creó
      entry en history.

**Flujo E2E real:**

- [ ] Como admin: invitar a un nuevo user yopmail → esperar ≥1h sin
      clickear el link → clickear el link expirado → invitado aterriza
      en `localhost:3000/` con toast warning del copy `otp_expired` →
      URL limpia tras el primer render. **Requiere rate-limit liberado**.

**Primitivo Toast en `/dev/ui`:**

- [x] Abrir `http://localhost:3000/dev/ui` → ver sección "Toast" con
      las 3 variants (success/warning/danger) → cada una usa el ícono
      default correcto (`check_circle` / `warning` / `error`), el color
      de fondo soft, el texto saturado. (2026-05-26)
- [x] Tab al botón close de cada variant → ring visible con el color
      del variant (success/warning/danger). (2026-05-26, validado en
      variant danger; las 3 comparten el mismo patrón `focus-visible:ring`
      en Toast.tsx)
- [x] Cerrar un toast con X → fila muestra botón "Reset" → click Reset
      reabre el toast. (2026-05-26)

> Issues visuales detectados en este smoke (2026-05-26):
> (1) los 3 toasts comparten posición fixed y se solapan en pantalla —
> esperado (showcase lo advierte);
> (2) el texto del mensaje NO está alineado verticalmente con el ícono
> (luce flotando arriba) — ~~RESUELTO~~ por
> `fix_auth_error_listener_and_toast_polish` (cerrada 2026-05-27);
> (3) el botón X no muestra `cursor-pointer` en hover — ~~RESUELTO~~ por
> el mismo fix.

**Polish post-fix (smoke browser-based, 2026-05-27):**

- [ ] `/dev/ui` sección Toast: las 3 variants (success/warning/danger)
      tienen ícono + texto + botón X centrados verticalmente (eje
      horizontal del toast pasa por el medio del ícono).
- [ ] `/dev/ui` sección Toast: hover sobre el botón X muestra
      `cursor: pointer` en las 3 variants.

**Migración VisitScheduler (smoke F):**

- [x] Login como user → ir a `/property/<id>/schedule` → seleccionar slot
      libre → "Confirmar visita" → aparece toast **success** con texto
      "Visita confirmada." → a los ~600ms redirige a `/profile?tab=visits`.
      (2026-05-26, validado con elena por Dario)
- [x] Validar visualmente que el toast pasó de pill (`rounded-full`)
      a recuadro (`rounded-lg`) — el shape cambió, debe verse centrado y
      legible (regresión visual conocida y aceptada, R6 §8). (2026-05-26)
- [x] El toast NO tiene botón X visible (`dismissible={false}`) y NO
      auto-desaparece — sólo el redirect lo descarta. (2026-05-26)

> Hallazgos del smoke F (2026-05-26):
> (1) El path real es `/property/<id>/schedule`, NO `/visit` — el spec del
> smoke estaba desactualizado. Path corregido inline.
> (2) Dario propuso URLs amigables (`/property/<slug>` en vez de UUID) —
> agregado al backlog como feature `property_pretty_urls`.

**Migración ResendInvitationButton (smoke G):**

- [ ] Login como admin → `/admin/users` → fila pending con link expirado
      → clickear "Reenviar invitación" → aparece toast **success**
      flotante (NO inline) con texto "Invitación reenviada a {nombre}."
      → auto-dismiss tras ~4s.
- [ ] Forzar 429 (clickear muchas veces seguidas hasta hit del rate-limit)
      → aparece toast **danger** con el mensaje del error ("Demasiadas
      invitaciones recientes.") → persiste hasta cerrar con X o Escape
      (no auto-dismiss en error).
- [ ] Validar que la fila admin NO se descuadra (ya no hay `<p>` debajo
      del botón ocupando ~20px de alto).
- [ ] El botón queda disabled tras success durante los ~4s → al cerrar
      el toast (auto-dismiss o manual) se re-habilita.

### `change_email_flow` (cerrada 2026-05-26)

Smoke tests del spec §12. La feature toca auth, race condition entre
email viejo y nuevo, y un route handler nuevo (`/auth/email-change`).

**A. Modal y validación cliente:**

- [ ] Login como `elena@luxe-estate.test` (user con identity email) →
      `/profile?tab=settings` → botón "Cambiar" visible y enabled.
- [ ] Click "Cambiar" → modal abre con correo actual prellenado en
      readonly, otros campos vacíos, focus en "Correo nuevo".
- [ ] Submit con email malformado (`foo`) → banner "Revisa los campos
      marcados.", desaparece al editar el campo.
- [ ] Submit con email igual al actual → banner `same_email`.
- [ ] Submit con email mismo case-different (mayúsculas) → banner
      `same_email`.
- [ ] Submit con password vacío → banner "La contraseña es obligatoria."

**B. Server Action:**

- [ ] Submit con password incorrecto → banner "Contraseña incorrecta."
- [ ] Submit con email de otro user del seed (ej.
      `marcus@luxe-estate.test`) → banner "Ya existe una cuenta con
      ese correo. Elige otro."
- [ ] Submit OK con email nuevo (yopmail nuevo) → form se reemplaza por
      bloque "Revisa tu correo nuevo" con los dos emails listados.
- [ ] Tras OK, **la sesión sigue activa**: navegar a `/` y volver a
      `/profile` sin bounce a `/login`.
- [ ] Tras OK, `auth.users.email` SIGUE siendo el viejo (verificar SQL
      vía MCP). `profiles.email` también.
- [ ] Spam: clickear submit 5+ veces seguidas → eventual 429 → banner
      `rate_limit`.

**C. Race y cierre del modal:**

- [ ] Cancel/Close/Escape durante `loading` → no cierra el modal hasta
      que la action termine.
- [ ] Cancel/Escape en `success` → modal cierra normalmente.
- [ ] Auto-cierre del modal a los 8s en `success` (esperar sin
      interacción).

**D. Route handler y flash:**

- [ ] Clickear el link del email **nuevo** (yopmail) → aterriza en
      `/profile?tab=settings&email_changed=pending` (si secure email
      change ON) → toast warning "Confirmaste un link..." → tras 6s,
      query param limpio.
- [ ] Clickear el link del email **viejo** → idem, otro toast `pending`.
- [ ] Tras AMBOS clicks: refresh `/profile` → ver email **nuevo** en
      el field readonly. `auth.users.email` y `profiles.email`
      coinciden con el nuevo (verifica trigger 0027 funcionando).
- [ ] El segundo de los dos clicks aterriza en `?email_changed=1` →
      toast success "Correo actualizado correctamente."

**E. Error y casos negativos del handler:**

- [ ] Esperar 24h con un link sin clickear → click → aterriza en `/`
      con toast del listener (`invite_error_landing`), no en
      `/profile?tab=settings`.
- [ ] Clickear un link y luego clickearlo de nuevo (ya consumido) →
      handler captura el error → `/profile?tab=settings&email_changed=error`
      → toast warning "No pudimos confirmar el cambio..."

**F. OAuth-only:**

- [ ] Login con Google con una cuenta nueva que NUNCA tuvo password →
      `/profile?tab=settings` → botón "Cambiar" disabled con tooltip y
      helper text.
- [ ] (Defense) Inspeccionar el botón en DevTools, removerle `disabled`
      manualmente y submit con cualquier email/password → action devuelve
      `oauth_only` → banner "Tu cuenta usa inicio de sesión con Google..."

**G. Login con email nuevo:**

- [ ] Tras confirmar ambos links, logout y login con el email nuevo +
      misma contraseña → entra al perfil con sesión válida.
- [ ] Logout y intentar login con el email viejo → error "Email o
      contraseña incorrectos."

---

## Cómo dejar pasar el rate-limit de Supabase

El plan Free de Supabase Cloud permite 3-4 emails por hora desde el
SMTP hosted. Si se excede, cualquier `inviteUserByEmail` devuelve
`error_code: over_email_send_rate_limit` con status 429.

Estrategias:

1. **Esperar 30-60 min** y reintentar.
2. **Configurar SMTP custom** en Supabase Auth settings (SendGrid,
   Resend, Mailgun). Out of scope MVP pero anotado como deuda.
3. Para validaciones que no requieren email real: usar SQL directo
   vía MCP para flippar `auth.users.invited_at` y observar el trigger.
