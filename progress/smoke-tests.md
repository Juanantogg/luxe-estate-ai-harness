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

- [ ] TopNav variante `app` para user logueado: links Comprar/Rentar/
      Vender/Guardados + search + notif badge + avatar dropdown.
- [ ] TopNav variante `dashboard` para agent.
- [ ] TopNav variante `admin` para admin.
- [ ] TopNav variante `app` para user **no logueado**: muestra CTAs
      "Iniciar sesión" / "Registrarse" en lugar de avatar.
- [ ] Mobile (≤640px): nav colapsa a hamburguesa abriendo drawer.
- [ ] Avatar dropdown muestra links según rol y signOut funciona.
- [ ] Skip link de a11y: tab al cargar → enfoca "Saltar al contenido".

### `home_discover_screen` (cerrada 2026-05-22)

- [ ] Home pública (sin sesión) carga sin errores.
- [ ] Featured Collections muestra propiedades is_featured=true.
- [ ] New in Market grid responsivo (2 cols sm, 3 cols md, 4 cols lg).
- [ ] Toggle Buy/Rent filtra por listing_type.
- [ ] Chips de property_type filtran (All / House / Apartment / Villa /
      Penthouse).
- [ ] Heart en card sin sesión → redirige a /login con next.
- [ ] Heart en card con sesión → toggle favorite con optimistic UI.
- [ ] Load more aumenta resultados.

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
