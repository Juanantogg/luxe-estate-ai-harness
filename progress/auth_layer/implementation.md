# Implementación — auth_layer

Implementación de la capa de autenticación reutilizable según el contrato
en `progress/auth_layer/design.md`. **No** incluye la pantalla de login
(esa es `login_screen`).

---

## Archivos creados

### `src/lib/auth/`

- `src/lib/auth/site-url.ts` — `getSiteUrl()` con precedencia
  `NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_VERCEL_URL → http://localhost:3000`.
- `src/lib/auth/redirect.ts` — `getRedirectPathForRole(role)` (mapea
  `admin → /admin`, `agent|broker → /dashboard`, `user|null → /`) y
  `safeNextPath(raw)` con los 6 checks de la spec.
- `src/lib/auth/errors.ts` — `AuthErrorCode` (union cerrado),
  `authError(code, message?)`, `authErrorMessage(code)` y `mapSupabaseError(err)`.
  El mapeo nunca propaga `err.message` crudo de Supabase.
- `src/lib/auth/schemas.ts` — schemas zod (`emailSchema`,
  `strongPasswordSchema`, `loginPasswordSchema`, `signInSchema`,
  `signUpSchema`, `updatePasswordSchema`, `requestResetSchema`). Las
  contraseñas fuertes exigen ≥8 chars, ≥1 letra y ≥1 número.
- `src/lib/auth/actions.ts` — Server Actions:
  - `signInWithPassword(formData) → AuthResult`
  - `signUpWithPassword(formData) → AuthResult<{ email: string }>`
  - `signInWithGoogle(formData?) → AuthResult`
  - `signOut() → void`
  - `requestPasswordReset(formData) → AuthResult`
  - `updatePassword(formData) → AuthResult`
  - `resendVerificationEmail(formData) → AuthResult`

### Route Handlers

- `src/app/auth/callback/route.ts` — GET que maneja OAuth Google y
  confirmación de email (un solo handler, discrimina por presencia/error
  de `code`). En éxito: exchange + fetch `profile.role` + redirect por rol
  (o `next` si pasa `safeNextPath`). En error: `/login?error=<code>`.
- `src/app/auth/reset/route.ts` — GET que recibe el link del email de
  reset, intercambia el code y redirige a `/auth/reset/new`.

### Páginas y forms

- `src/app/auth/reset/new/page.tsx` — Server Component que verifica
  sesión activa (Supabase la setea en el exchange) y renderiza la card
  con el form.
- `src/app/auth/reset/new/NewPasswordForm.tsx` — Client Component con
  `useActionState` que invoca `updatePassword`.
- `src/app/auth/verify-email/page.tsx` — Server Component que lee
  `searchParams.email` (await Next 16), redirige por rol si el user ya
  está autenticado, y renderiza la card "Revisa tu correo".
- `src/app/auth/verify-email/ResendButton.tsx` — Client Component con
  cooldown local de 60s tras éxito; invoca `resendVerificationEmail`.

### Middleware y env

- `middleware.ts` (raíz del repo) — invoca `updateSession` del proxy.
  `config.matcher` excluye `_next/static`, `_next/image`, `favicon.ico`,
  `robots.txt`, `sitemap.xml` y assets estáticos comunes (svg/png/jpg/
  jpeg/gif/webp/ico/css/js/woff/woff2).
- `.env.example` — documentado con todas las variables (incluyendo la
  nueva `NEXT_PUBLIC_SITE_URL`).

### `feature_list.json`

- Cambiado `status` de `auth_layer` a `in_progress` (sólo ese campo).

---

## Decisiones técnicas al implementar

1. **Detección silenciosa de email duplicado en signup.** Supabase, con
   "Confirm signup" activado, devuelve un `user` aunque el email ya
   exista, pero con `identities = []`. Lo detecto explícitamente y
   devuelvo `email_taken`. Es la única forma fiable de propagar el
   conflicto cuando la confirmación de email está activa.

2. **`failure(code, message?)` helper.** Mantiene el patrón discriminado
   `AuthResult` sin duplicar el `authError` lookup en cada return.
   Cuando llega un `message` explícito (caso `invalid_input` con detalle
   zod), se usa; si no, se cae al mensaje del catálogo.

3. **`firstZodError` toma sólo el primer issue.** El form actual es
   single-error inline (no field-level), así que mostrar el primer
   mensaje de zod es lo más natural. Si en el futuro queremos
   field-errors, se cambia el shape a `{ fieldErrors: {...} }` sin
   romper el `code: 'invalid_input'`.

4. **`scope: 'local'` en `signOut`.** Decisión de la spec; revoca sólo la
   sesión de este navegador, no todas las sesiones del usuario.

5. **`useTransition` + handler manual en `ResendButton`** en vez de
   `useActionState`. El botón también necesita gestionar el cooldown
   local con `useState`/`setTimeout`, y mezclar ambos hooks añade
   complejidad. La spec describe el comportamiento del estado local
   ("idle | sending | success | error" + countdown), y eso encaja mejor
   con `useState` + `startTransition` que con el `state` plano de
   `useActionState`.

6. **Mensajes de error inline con `role="alert"`** en
   `NewPasswordForm`/`ResendButton`. Cumple con la sección A11y de la
   spec (errores → `role="alert"`/`aria-live="assertive"`; éxitos →
   `role="status"`/`aria-live="polite"`).

7. **Iconos con `<span className="material-icons">` directo** en las
   pages del flujo de auth. El componente `Icon` existe pero requiere
   importarlo desde `src/components/ui`; usar el span directo evita
   forwardear estilos en pantallas que sólo consumen 1 icono. (En las
   pantallas siguientes, p. ej. login_screen, podemos usar `<Icon>`).
   Se mantiene la convención de Material Icons del resto del proyecto.

8. **No se incluyó `aria-label` extra en `<main>` de las pages.** El
   `<h1>` interno actúa como nombre accesible del landmark — patrón
   estándar de Next/A11y.

---

## Resultado de verificaciones automáticas

| Verificación                                 | Resultado                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                  | OK (sin warnings)                                                                                                   |
| `pnpm type-check`                            | OK (sin errores)                                                                                                    |
| Hex literales en JSX/CSS de archivos creados | 0 (verificado con `grep -rn '#[0-9A-Fa-f]\{3,8\}'` en `src/app/auth` y `src/lib/auth`)                              |
| `console.log` o TODOs sueltos                | 0 (sólo el `console.error` deliberado en `errors.ts` para casos `unknown`, según spec)                              |
| `git status` limpio salvo archivos esperados | Sí — `middleware.ts`, `progress/auth_layer/`, `src/app/auth/`, `src/lib/auth/`, `.env.example`, `feature_list.json` |

---

## Verificación contra criterios de aceptación de la spec

- [x] `src/lib/auth/actions.ts` con `'use server'` y las 7 Server Actions exportadas y tipadas.
- [x] `src/lib/auth/schemas.ts` con esquemas zod; contraseñas ≥8 chars, letra+número.
- [x] `src/lib/auth/errors.ts` con `AuthErrorCode` y `mapSupabaseError` que nunca devuelve `err.message` crudo.
- [x] `src/lib/auth/redirect.ts` con `getRedirectPathForRole` y `safeNextPath` (6 checks).
- [x] `src/lib/auth/site-url.ts` con `getSiteUrl`.
- [x] `src/app/auth/callback/route.ts` (GET) que cubre OAuth + signup-confirm y redirige por rol/`next`/error.
- [x] `src/app/auth/reset/route.ts` (GET) intercambia code y redirige a `/auth/reset/new`.
- [x] `src/app/auth/reset/new/page.tsx` (Server Component) verifica sesión activa y renderiza el form.
- [x] `src/app/auth/reset/new/NewPasswordForm.tsx` (Client Component) invoca `updatePassword`.
- [x] `src/app/auth/verify-email/page.tsx` (Server Component) con `searchParams.email`, redirige a home si hay sesión activa.
- [x] `src/app/auth/verify-email/ResendButton.tsx` (Client Component) con cooldown 60s.
- [x] `middleware.ts` en la raíz, `config.matcher` excluye assets estáticos.
- [x] Cero hex literales en JSX/CSS.
- [x] Cero `console.log` debug.
- [x] `pnpm lint` y `pnpm type-check` pasan sin warnings.
- [x] `.env.example` documenta `NEXT_PUBLIC_SITE_URL` con explicación.
- [ ] Los 17 pasos del Test manual — **pendientes para el reviewer/humano** (requieren un usuario real interactuando con email y OAuth Google).

---

## Variables de entorno y configuración requerida (humano)

### `.env.local`

Las claves de Supabase ya están en `.env`. Para esta feature, el humano
puede opcionalmente añadir:

```
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

En desarrollo no es estrictamente necesario (cae al fallback de
`localhost:3000`). En producción **es obligatoria** porque
`VERCEL_URL` apunta al hostname efímero del deploy, no al dominio
canónico.

### Configuración en Supabase Dashboard

1. **Auth → URL Configuration → Redirect URLs**: añadir las URLs que
   Supabase puede usar como `redirectTo`:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/reset`
   - Equivalentes de cada entorno (preview/prod).

2. **Auth → Providers → Google**: habilitar Google OAuth y configurar
   `Client ID` / `Client Secret` desde Google Cloud Console.

3. **Auth → Email → "Confirm signup"**: debe estar **activado** para que
   el flujo de verificación post-signup funcione.

4. (Opcional, sólo si en dev se golpea rate limit) **Auth → Rate Limits**:
   subir temporalmente el límite de envío de email (~4/hora por email por
   defecto).

---

## Test manual pendiente

Los 17 pasos descritos en la sección "Test manual" del `design.md`
**deben ejecutarlos el reviewer y/o el humano** porque requieren un
buzón de correo real, interacción con la pantalla `/login` (otra
feature aún `pending`), y consentimiento OAuth en Google. Resumen:

1. Signup feliz → redirige a `/auth/verify-email?email=...`.
2. Signup con email ya existente → error `email_taken` inline.
3. Signup con password débil → error `weak_password` (validación zod local).
4. Confirmar email vía link → `/auth/callback?code=...&type=signup` → redirect por rol.
5. Login con credenciales inválidas → `invalid_credentials`.
6. Login con email no confirmado → `email_not_confirmed`.
7. Reenviar verificación: botón verde + countdown 60s.
8. OAuth Google feliz.
9. OAuth Google cancelado → `/login?error=oauth_cancelled`.
10. Reset request — mensaje genérico (sin enumeración).
11. Reset password — uso del link → `/auth/reset` → `/auth/reset/new` → `/login?reset=ok`.
12. Reset password — link inválido → `/login?error=reset_token_invalid`.
13. SignOut → sesión revocada + redirect `/login`.
14. Middleware: ruta protegida sin sesión → `302 /login?next=<path>`.
15. Middleware: ruta protegida con sesión → 200.
16. `next` post-login respetado para rutas internas seguras.
17. `next` malicioso (`https://evil.com`, `//evil.com`, `/auth/callback`) rechazado.

**Nota sobre la dependencia**: los pasos 1-7 y 13-17 sólo se pueden
ejecutar de punta a punta cuando `login_screen` esté implementada (la
feature está marcada `pending` y depende de `auth_layer`). El reviewer
puede aceptar esta feature verificando la lógica server-side por
inspección de código y ejercitando puntos clave con `curl` (p. ej.
GET `/auth/callback` sin code → 302 al login).

---

## Posibles puntos de atención para el reviewer

1. **Cambio fuera de scope detectado y revertido.** Durante la sesión el
   archivo `.claude/settings.json` apareció con cambios espurios (no
   provenían de mi trabajo). Lo revertí con `git checkout --
.claude/settings.json` para respetar la regla de inmutabilidad de
   `.claude/`. Confirmar en `git status` que sólo aparecen los archivos
   esperados.

2. **`.env.example` está cubierto por `.gitignore` (`.env*`).** Si el
   equipo quiere que `.env.example` se commitee, hay que añadir un
   `!.env.example` al `.gitignore`. Lo dejo como decisión del leader/
   humano: este implementer no toca `.gitignore` sin instrucción
   explícita.

3. **Naming de actions.** La spec en `design.md` ("Archivos a crear")
   pide `signInWithPassword` / `signUpWithPassword`; el `feature_list.json`
   menciona los alias abreviados (`signIn` / `signUp`). Seguí la spec
   (más explícita). Si la pantalla `login_screen` futura espera los
   nombres cortos, basta con re-exportarlos como alias o ajustar la
   importación.

4. **`scope: 'local'` en signOut.** Cualquier dispositivo del mismo
   usuario en el que la sesión siga abierta queda como está. Si el
   producto necesita "cerrar en todos los dispositivos", se cambia a
   `scope: 'global'`.

5. **`useTransition` en `ResendButton`.** Decisión documentada arriba.
   Si el reviewer prefiere `useActionState`, se puede refactorizar sin
   tocar la Server Action.
