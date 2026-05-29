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

- [ ] Login con email/password de seed (admin@luxe-estate.test) →
      redirige a `/admin`.
- [ ] Login con seed agent (marcus@luxe-estate.test) → redirige a
      `/dashboard`.
- [ ] Login con seed user (elena@luxe-estate.test) → redirige a `/`.
- [ ] Signup con email nuevo → recibe correo de verificación → click
      link → entra a `/`.
- [ ] Signup con email ya registrado → error inline en form.
- [ ] Google OAuth → flujo completo.
- [ ] Request password reset → recibe correo → click link → cambia
      password → puede login con nueva.
- [ ] Middleware: navegar a `/profile` sin sesión → redirige a `/login`.
- [ ] Middleware: navegar a `/admin` siendo user → 404 (no admin).

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

- [ ] Mobile (≤640px): nav colapsa a hamburguesa abriendo drawer.
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

- [ ] Home pública: la sección "Nuevas en el mercado" muestra al menos
      20 cards; "Load more" rinde varios clicks (4-5) antes de agotarse.
- [ ] Home: variedad visual real — no se ve la misma foto de hero en 2
      cards adyacentes (validar haciendo scroll por las primeras 20).
- [ ] Chips de property_type filtran a counts visibles (House >10,
      Apartment >10, Villa >5, Penthouse >5).
- [ ] Toggle Buy/Rent: ambos lados muestran cards (no queda vacío en
      ninguno).
- [ ] Abrir 2-3 properties detail: galería con 6 imágenes (1 hero +
      5 thumbnails scrollables); el hero es coherente con el tipo
      (exterior de casa para `house`, fachada de building para
      `apartment`, etc.).
- [ ] Abrir una property tipo `condo` o `townhouse`: el hero usa el
      pool general (no hay `EXTERIOR_BY_TYPE` para esos tipos) — debe
      verse decente, no roto. Si se ve raro, agregar override al pool.
- [ ] Re-correr `pnpm db:seed`: imprime "→ ya existe property…" y
      "→ ya hay 6 imágenes…" sin insertar nada nuevo (idempotencia).

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

- [ ] Navegar a `/` (sin query) → TopNav 'Comprar' activo, 'Rentar'
      inactivo.
- [ ] En la home, clickear toggle "Comprar" → URL pasa a
      `/?listing=sale` → TopNav 'Comprar' SIGUE activo, 'Rentar'
      inactivo.
- [ ] Clickear toggle "Rentar" → URL pasa a `/?listing=rent` → TopNav
      'Rentar' activo, 'Comprar' inactivo.
- [ ] Clickear toggle "Todas" → URL vuelve a `/` → TopNav 'Comprar'
      activo nuevamente.
- [ ] Mobile drawer: abrir hamburguesa en cada uno de los 3 estados,
      verificar que el link resaltado coincide con el TopNav desktop.
- [ ] Navegar manualmente a `/?listing=foo` (valor desconocido) →
      NINGÚN link del TopNav queda activo (comportamiento defensivo
      intencional).

### `property_pretty_urls` (cerrada 2026-05-29)

URLs `/property/<uuid>` migradas a `/property/<slug>` con redirect 308
para links legacy. Slug autogenerado por trigger DB, inmutable.

- [ ] Como anon: navegar a una URL UUID legacy
      (`/property/<uuid-de-una-active>`) → URL del browser cambia a
      `/property/<slug>` con 308 (verificar en devtools Network).
      Detalle se renderiza normal.
- [ ] Como anon: navegar directo a `/property/<slug>` → 200, sin
      redirect (verificar en devtools).
- [ ] Como anon: navegar a `/property/<slug-de-archivada>` → 404 (la
      RLS `for select to anon where listing_status = 'active'` la
      filtra). Verificar con un slug obtenido directo de DB de una
      property archivada.
- [ ] Como agent: editar una property propia → la sección "URL pública"
      del form muestra el slug actual read-only. Cambiar el title +
      Guardar → la URL pública mostrada NO cambia (slug inmutable).
      Volver al dashboard, click en el title → URL navegada usa el slug.
- [ ] Como agent: crear property nueva → el form NO muestra "URL
      pública". Tras guardar como `published`, abrir desde el dashboard
      → la URL del browser tiene formato esperado
      `casa-...-ciudad-<4hex>`.
- [ ] Como user con notif pendiente que referencia property (p. ej.
      `new_property`): abrir dropdown, click → navega primero al UUID,
      luego 308 al slug. Verificar en Network tab que se ve el 308 (no
      es solo un client-side redirect).
- [ ] Como agent: agendar visita a property A → al recibir notif de
      tipo `visit_confirmed` (otro user), click → navegación final
      termina en `/property/<slug>`.
- [ ] `/property/<slug>/schedule` carga 200 para user no-owner; para
      owner redirige a dashboard. Mismo comportamiento que hoy con UUID.

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

- [ ] Abrir el panel con notifs sin leer (elena@luxe-estate.test tiene
      notificaciones del seed): ver bucket "Hoy" en el header, items con
      dot izquierdo y `bg-primary-soft` en los unread.
- [ ] Click en notif con `property_id` → navega a `/property/[id]` y
      desaparece el dot.
- [ ] Click en notif tipo `system` o `new_message` → solo marca como
      leída (dot desaparece), NO navega.
- [ ] Botón "Marcar todas como leídas" → todos los items pierden el dot
      sin cerrar el panel; el dot rojo del bell se apaga.
- [ ] Insertar notif vía SQL (`insert into notifications (recipient_id,
type, title) values (auth.uid(), 'system', 'Test');`) → con la
      pestaña visible y el panel abierto, esperar 30s → la notif aparece
      sin recargar.
- [ ] Pestaña inactiva 1 min → fetch pausado (verificar en Network tab
      de DevTools que no hay polls); volver al tab → fetch inmediato +
      reanuda polling.
- [ ] Mobile (≤640px): el panel se renderiza como bottom-sheet
      anclado abajo con overlay; click en overlay cierra.
- [ ] Desktop (≥640px): popover anclado al bell; click fuera cierra.
- [ ] `Escape` cierra el panel desde cualquier breakpoint.
- [ ] Empty state: con un user sin notificaciones (crear uno nuevo o
      truncate de la tabla para él) → ver "No tienes notificaciones".

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
