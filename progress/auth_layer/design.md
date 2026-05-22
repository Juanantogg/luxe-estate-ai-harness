# Design spec — auth_layer

Capa de autenticación reutilizable: Server Actions tipadas, route handlers
de callback/reset, helpers de redirección por rol, middleware raíz y la
pantalla intermedia "revisa tu correo" post-signup. **No** incluye la
pantalla de login/signup (esa es `login_screen`).

## Referencia visual

- No hay mockup específico para esta feature. La única superficie con UI
  propia es la pantalla intermedia post-signup, que se diseña improvisando
  dentro del sistema (`docs/design-system.md`) — referencias visuales:
  `docs/designs/social_login_and_registration/screen.png` para mantener
  coherencia tonal con el flujo de login.

---

## Tokens a usar

Para la pantalla intermedia `verify-email` (única superficie visual):

- Fondo: `bg-background` (clear-day) — coherente con el resto de pantallas.
- Card central: `bg-surface` + `shadow-soft` + `rounded-2xl`.
- Texto principal: `text-on-surface`.
- Texto secundario / instrucciones: `text-muted`.
- Acento (icono de email circular): `bg-primary-soft` + `text-primary`.
- Botón "Reenviar correo": `Button variant="secondary"`.
- Botón "Volver al inicio de sesión": `Button variant="ghost"`.
- Mensaje de éxito tras reenvío: `text-success` (mosque) + `bg-success-soft`.
- Mensaje de error / rate limit: `text-danger` + `bg-danger-soft`.

No se introducen tokens nuevos.

---

## Archivos a crear

| Path                                         | Tipo              | Propósito                                                                                                                                      |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth/schemas.ts`                    | Módulo zod        | Esquemas reutilizables (`emailSchema`, `passwordSchema`, `signUpSchema`, `updatePasswordSchema`)                                               |
| `src/lib/auth/errors.ts`                     | Módulo            | Tipo `AuthErrorCode`, mapeo `mapSupabaseError(err) → AuthError`                                                                                |
| `src/lib/auth/actions.ts`                    | Server Actions    | `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signOut`, `requestPasswordReset`, `updatePassword`, `resendVerificationEmail` |
| `src/lib/auth/redirect.ts`                   | Helpers           | `getRedirectPathForRole(role)`, `safeNextPath(next)`                                                                                           |
| `src/lib/auth/site-url.ts`                   | Helper            | `getSiteUrl()` — resuelve la URL base para construir `redirectTo`                                                                              |
| `src/app/auth/callback/route.ts`             | Route Handler GET | OAuth code exchange + redirección por rol; también maneja confirmación de email                                                                |
| `src/app/auth/reset/route.ts`                | Route Handler GET | Recibe link de reset (code/token), llama `exchangeCodeForSession`, redirige a `/auth/reset/new`                                                |
| `src/app/auth/reset/new/page.tsx`            | Server Component  | Renderiza form de nueva contraseña (form en Client Component hijo)                                                                             |
| `src/app/auth/reset/new/NewPasswordForm.tsx` | Client Component  | Form controlado; invoca Server Action `updatePassword`                                                                                         |
| `src/app/auth/verify-email/page.tsx`         | Server Component  | Pantalla "revisa tu correo" post-signup; lee `searchParams.email`                                                                              |
| `src/app/auth/verify-email/ResendButton.tsx` | Client Component  | Botón "Reenviar correo" con cooldown local; invoca `resendVerificationEmail`                                                                   |
| `middleware.ts` (raíz del repo)              | Middleware Next   | Importa y ejecuta `updateSession` de `src/lib/supabase/proxy.ts`                                                                               |

Notas:

- `schemas.ts` se mantiene separado de `actions.ts` para que la pantalla
  `login_screen` (otra feature) los pueda importar y reutilizar en
  validaciones client-side opcionales.
- `errors.ts` se mantiene separado porque tanto Server Actions como Route
  Handlers necesitan mapear errores y queremos un único punto de verdad.

---

## Interfaz de las Server Actions

### Tipo de retorno común

```ts
export type AuthSuccess<T = void> = { ok: true; data?: T };
export type AuthFailure = { ok: false; error: { code: AuthErrorCode; message: string } };
export type AuthResult<T = void> = AuthSuccess<T> | AuthFailure;
```

- **Por qué `{ ok, error }` y no throw**: las Server Actions retornan datos
  consumibles por `useActionState`/`useFormState` desde Client Components.
  Throw rompe el flujo, abre la error boundary, y obliga a redirect manual
  para mostrar el mensaje. Tradeoffs ampliados en "Alternativas consideradas".
- **Por qué `message` además de `code`**: el frontend usa `code` para
  decidir comportamiento (p. ej. `email_not_confirmed` → ofrecer reenvío)
  y `message` para mostrar al usuario en español. El `message` se genera
  server-side a partir del `code`, **nunca** se filtra el `message` original
  de Supabase (puede revelar internals/PII).

### Acciones (firmas exactas)

#### `signInWithPassword(formData: FormData): Promise<AuthResult>`

1. Parse `formData` con `signInSchema` (zod): `email` (string, email),
   `password` (string, min 1 — login no exige los 8 chars; eso es signup).
2. Si falla validación → `{ ok: false, error: { code: 'invalid_input', message } }`.
3. `await createClient()` desde `src/lib/supabase/server.ts`.
4. `supabase.auth.signInWithPassword({ email, password })`.
5. Mapear errores Supabase → `AuthErrorCode` (ver tabla).
6. Si éxito: leer `profile.role` (select `role from profiles where id = user.id`),
   calcular `getRedirectPathForRole(role)`, respetar `next` si llegó como
   campo oculto del form y pasa `safeNextPath`.
7. `redirect(targetPath)` — esto **no retorna** (Next aborta la ejecución).
   El tipo de retorno declarado es `Promise<AuthResult>` pero en éxito el
   redirect lanza `NEXT_REDIRECT`. El caller debe envolverlo correctamente
   en `useActionState` (Next ya maneja esta excepción internamente).
8. **`'use server'`** al inicio del archivo (export-level).

#### `signUpWithPassword(formData: FormData): Promise<AuthResult<{ email: string }>>`

1. Parse con `signUpSchema`: `email`, `password` (min 8 chars, debe tener
   al menos 1 letra y 1 número), `confirmPassword` (debe coincidir),
   `fullName` (string, 2-100 chars).
2. `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: <site>/auth/callback?type=signup } })`.
   - El `data.full_name` queda en `raw_user_meta_data`; el trigger
     `handle_new_user` lo copia a `profiles.full_name`.
   - `emailRedirectTo` apunta a `/auth/callback?type=signup` (mismo route
     handler que OAuth pero discrimina por param `type` o por presencia
     de `code`).
3. **No** hay sesión activa tras signUp (verificación obligatoria por
   config de Supabase). No se llama `redirect` aquí; el caller redirige a
   `/auth/verify-email?email=<email>`.
4. Retorno éxito: `{ ok: true, data: { email } }` para que el caller
   construya el redirect.
5. Mapeo de errores (Supabase devuelve `user_already_exists` /
   `weak_password` / `over_email_send_rate_limit`).

#### `signInWithGoogle(formData?: FormData): Promise<AuthResult>`

1. Leer `next` opcional del `formData` (si la pantalla login lo manda como
   hidden input).
2. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <site>/auth/callback?next=<safeNext>, queryParams: { access_type: 'offline', prompt: 'consent' } } })`.
3. Supabase devuelve `{ data: { url }, error }`. Si error → AuthFailure.
4. Si éxito: `redirect(data.url)` (URL de consentimiento de Google).
5. **Importante**: no se puede hacer redirect a URL externa desde un
   `<form action={...}>` clásico si la action es Server Action; Next 16
   maneja `redirect()` con URL absoluta correctamente y devuelve 303.
   Confirmar en implementación.

#### `signOut(): Promise<void>`

1. `await createClient()` → `supabase.auth.signOut()` (revoca sesión local;
   `scope: 'local'`).
2. `redirect('/login')`.
3. Sin retorno consumible: la action se invoca con `<form action={signOut}>`
   sin `useActionState`.

#### `requestPasswordReset(formData: FormData): Promise<AuthResult>`

1. Parse `email` con `emailSchema`.
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: <site>/auth/reset })`.
3. **Siempre** retorna `{ ok: true }` aunque el email no exista en la base
   (evita enumeración de cuentas). El mensaje al usuario es genérico:
   "Si la cuenta existe, te enviamos un enlace para restablecer tu
   contraseña."
4. Excepción: si Supabase devuelve `over_email_send_rate_limit`, sí se
   devuelve el error con código `rate_limited` para que el UI muestre
   "Demasiados intentos, espera unos minutos."

#### `updatePassword(formData: FormData): Promise<AuthResult>`

1. Parse con `updatePasswordSchema`: `password` (8+ chars, letra+número),
   `confirmPassword` (coincide).
2. **Precondición**: el usuario debe tener sesión activa de tipo `recovery`
   (Supabase la crea automáticamente al intercambiar el code del link de
   reset).
3. `supabase.auth.updateUser({ password })`.
4. Mapeo: si no hay sesión activa → `reset_token_invalid` ("El enlace
   expiró o ya fue usado. Solicita uno nuevo.").
5. Si éxito: `redirect('/login?reset=ok')` (la pantalla login lee este
   flag y muestra toast "Contraseña actualizada, ya puedes iniciar sesión").

#### `resendVerificationEmail(formData: FormData): Promise<AuthResult>`

1. Parse `email` con `emailSchema`.
2. `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: <site>/auth/callback?type=signup } })`.
3. Mismo patrón silencioso que reset: éxito genérico, salvo rate limit
   que sí se expone (`rate_limited`).

---

## Códigos de error (`AuthErrorCode`)

Catálogo cerrado para que el UI pueda razonar sin parsear strings:

| Código                | Origen Supabase típico                                | Mensaje al usuario (es)                                                       |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `invalid_input`       | Falla zod local                                       | "Revisa los campos marcados."                                                 |
| `invalid_credentials` | `invalid_credentials` / `invalid_grant`               | "Email o contraseña incorrectos."                                             |
| `email_not_confirmed` | `email_not_confirmed`                                 | "Confirma tu correo antes de iniciar sesión. ¿No te llegó? Reenvíalo."        |
| `email_taken`         | `user_already_exists` / `email_exists`                | "Ya existe una cuenta con ese correo. Inicia sesión."                         |
| `weak_password`       | `weak_password`                                       | "Contraseña demasiado débil. Usa al menos 8 caracteres con letras y números." |
| `rate_limited`        | `over_email_send_rate_limit` / `429`                  | "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."              |
| `oauth_failed`        | OAuth devolvió error o code inválido                  | "No pudimos completar el inicio de sesión con Google. Inténtalo de nuevo."    |
| `oauth_cancelled`     | OAuth callback sin `code` y con `error=access_denied` | "Cancelaste el inicio de sesión con Google."                                  |
| `reset_token_invalid` | No hay sesión recovery activa al `updateUser`         | "El enlace expiró o ya fue usado. Solicita uno nuevo."                        |
| `session_missing`     | `createClient()` sin user al exigirlo                 | "Tu sesión expiró. Vuelve a iniciar sesión."                                  |
| `network_error`       | Fetch reject / timeout                                | "Problema de conexión. Inténtalo de nuevo."                                   |
| `unknown`             | Cualquier otro                                        | "Algo salió mal. Inténtalo de nuevo."                                         |

`mapSupabaseError(err)` recibe el `AuthError` de Supabase y devuelve
`{ code, message }`. La función inspecciona `err.code` (Supabase 2.x lo
expone) y cae a `err.message`/`err.status` como fallback. **Nunca**
devuelve el `err.message` crudo en el mensaje final.

---

## Route Handlers

### `src/app/auth/callback/route.ts` (GET)

Maneja **dos** flujos en un solo handler:

- OAuth (Google): query `?code=<authcode>&next=<path>`.
- Confirmación de email tras signup: query `?code=<token>&type=signup&next=<path>`.

Pseudocódigo:

```ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const errorParam = searchParams.get('error');

  if (errorParam) {
    // Usuario canceló o Google rechazó (p. ej. error=access_denied).
    return NextResponse.redirect(`${origin}/login?error=oauth_cancelled`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  // Fetch profile.role para redirigir según rol (o respetar `next` si pasa safeNextPath).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session_missing`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Fallback: si por carrera el profile aún no existe (trigger handle_new_user
  // ya lo crea automáticamente), tratar como role 'user'.
  const role = profile?.role ?? 'user';
  const target = next ?? getRedirectPathForRole(role);
  return NextResponse.redirect(`${origin}${target}`);
}
```

### `src/app/auth/reset/route.ts` (GET)

Recibe el link del correo de reset (`?code=<recovery-token>`).

```ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=reset_token_invalid`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=reset_token_invalid`);
  }
  // Cookies de recovery quedan seteadas (Supabase lo hace dentro de exchange).
  return NextResponse.redirect(`${origin}/auth/reset/new`);
}
```

`/auth/reset/new/page.tsx` es Server Component que:

- Verifica `supabase.auth.getUser()`. Si no hay user → redirect a
  `/login?error=reset_token_invalid`.
- Renderiza la tarjeta visual con `<NewPasswordForm />` (Client Component
  que invoca la Server Action `updatePassword`).

---

## Helper `getRedirectPathForRole`

```ts
// src/lib/auth/redirect.ts
import type { Database } from '@/types/database';

export type UserRole = Database['public']['Enums']['user_role'];

export function getRedirectPathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'agent':
    case 'broker':
      return '/dashboard';
    case 'user':
    default:
      return '/';
  }
}

/**
 * Devuelve `next` si es una ruta interna segura, o `null` si no.
 * Anti open-redirect:
 *  - debe empezar con "/" pero no con "//" (que sería protocolo-relativo)
 *  - no puede empezar con "/auth/" (evita loops del callback)
 *  - no puede contener "\n" ni "\r" (header injection)
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/auth/')) return null;
  if (/[\r\n]/.test(raw)) return null;
  // Tope de longitud para evitar abuso
  if (raw.length > 512) return null;
  return raw;
}
```

`broker` se mapea a `/dashboard` igual que `agent` — coincide con la
decisión documentada en `docs/data-model.md` ("En el MVP, RLS de `broker`
= RLS de `agent`").

---

## Helper `getSiteUrl`

```ts
// src/lib/auth/site-url.ts
/**
 * URL base canónica del sitio. Se usa para construir redirectTo en
 * Supabase Auth (OAuth, reset password, signup email).
 *
 * Precedencia:
 *  1. NEXT_PUBLIC_SITE_URL (recomendado en prod)
 *  2. NEXT_PUBLIC_VERCEL_URL (preview deployments)
 *  3. http://localhost:3000 (dev)
 *
 * Nunca devuelve trailing slash.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
```

---

## Middleware raíz

Archivo nuevo `middleware.ts` en la **raíz del repo** (no en `src/`):

```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excluimos assets estáticos y endpoints que no deben tocar cookies.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};
```

El `updateSession` ya existe en `src/lib/supabase/proxy.ts` y maneja la
redirección de rutas protegidas. **No** se modifica en esta feature
(salvo el matcher anti-loop sobre `/auth/*` ya está implícito porque
`updateSession` solo redirige cuando la ruta es protegida; `/auth/*` no
está en `isProtectedPath`).

---

## Variables de entorno

Existentes (no se añaden valores nuevos, sí se documenta el uso):

- `NEXT_PUBLIC_SUPABASE_URL` — usado por los 3 clientes.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — clientes browser/server SSR.
- `SUPABASE_SERVICE_ROLE_KEY` — `createAdminClient`; **esta feature no lo
  usa** pero queda mencionado por completitud.

Nueva, opcional pero recomendada:

- `NEXT_PUBLIC_SITE_URL` — base URL canónica (sin trailing slash) para
  construir los `redirectTo` de OAuth y reset password. En desarrollo
  local puede omitirse (cae a `http://localhost:3000`). En Vercel preview
  el helper usa `NEXT_PUBLIC_VERCEL_URL` automáticamente. En producción
  **es obligatoria** porque `VERCEL_URL` apunta al hostname del deploy,
  no al dominio canónico.

El implementer agregará un `.env.example` (si no existe) con estas tres
variables documentadas. El humano configura los valores reales.

**Configuración requerida en el dashboard de Supabase** (no en código,
pero el implementer debe documentarlo en el test manual):

- En Auth → URL Configuration: añadir como "Redirect URLs"
  `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/reset`,
  y los equivalentes del dominio de producción.
- Auth → Providers → Google: habilitar y configurar Client ID / Secret.
- Auth → Email → Confirm signup: **activado** (verificación obligatoria).

---

## Pantalla intermedia post-signup

### Ruta

`src/app/auth/verify-email/page.tsx` — ruta pública `/auth/verify-email`.

### Layout (mobile-first)

Estructura semántica:

```
<main class="min-h-screen flex items-center justify-center px-4 py-12">
  <article class="bg-surface rounded-2xl shadow-soft p-6 sm:p-8 max-w-md w-full">
    <div class="mx-auto h-16 w-16 rounded-full bg-primary-soft flex items-center justify-center">
      <Icon name="mark_email_unread" size="lg" class="text-primary" />
    </div>
    <h1 class="mt-6 text-2xl font-bold text-on-surface text-center">Revisa tu correo</h1>
    <p class="mt-3 text-muted text-center">
      Te enviamos un enlace de confirmación a <strong>{email}</strong>.
      Ábrelo para activar tu cuenta.
    </p>
    <div class="mt-6 flex flex-col gap-3">
      <ResendButton email={email} />
      <Link href="/login"><Button variant="ghost" fullWidth>Volver al inicio de sesión</Button></Link>
    </div>
    <p class="mt-6 text-xs text-muted text-center">
      ¿No lo encuentras? Revisa la carpeta de spam o correo no deseado.
    </p>
  </article>
</main>
```

Breakpoints: la card es `max-w-md` (28rem) y se mantiene centrada en todos
los anchos. En `sm:` aumenta padding interno de `p-6` a `p-8`.

### Comportamiento

- `searchParams.email` (lectura async, Next 16). Si falta el email,
  renderizar texto genérico "Te enviamos un enlace de confirmación a tu
  correo" sin el strong.
- **Si el user llega ya autenticado** (p. ej. ya confirmó y volvió al
  link), el Server Component hace `supabase.auth.getUser()` → si hay user,
  `redirect(getRedirectPathForRole(role))`.
- `ResendButton` (Client Component):
  - Estado local `idle | sending | success | error`.
  - Cooldown local de 60s tras éxito (deshabilita el botón con countdown
    visible: "Reenviar (45s)").
  - Llama `resendVerificationEmail` con el email recibido por prop.
  - Mensaje `success` discreto debajo del botón con
    `text-success` + `bg-success-soft` + `rounded` + `px-3 py-2`.
  - Mensaje `error` con `text-danger` + `bg-danger-soft` (mismo patrón).
- Sin loaders pesados; el botón usa el `loading` prop existente de `Button`.

### A11y

- `<main>` envuelve la card; landmark único.
- `<h1>` es el primer heading.
- El icono decorativo tiene `aria-hidden="true"`.
- El botón "Reenviar" actualiza un `<p role="status" aria-live="polite">`
  con el mensaje de éxito/error tras la action.
- Contraste: `text-on-surface` sobre `bg-surface` (Nordic sobre blanco)
  cumple AAA. `text-muted` (`#5c706d`) sobre blanco cumple AA para texto
  normal.

---

## Tipografía

- Pantalla `verify-email`:
  - Heading: `text-2xl font-bold` (24px / 700) → equivale al token
    `headline-2` adaptado a un peso bold para llamar la atención en una
    pantalla minimalista.
  - Body principal: `text-base` (16px / 400).
  - Caption inferior: `text-xs` (12px / 400).
- Toda Inter, pesos 400 y 700 (ya cargados en `layout.tsx`).

---

## Componentes

### A reutilizar (ya existen en `src/components/ui/`)

- `Button` — usado en `verify-email` (variants `secondary` para "Reenviar"
  y `ghost` para "Volver"). Necesita prop `fullWidth` si no existe — si
  no existe, el implementer usa `className="w-full"` (no se añade prop
  nueva en esta feature).
- `Icon` — para el icono `mark_email_unread` del header de la card.
- `Card` — opcional para `verify-email`. Decisión: usar `<article>` con
  clases directas en lugar de `<Card>` porque la pantalla no tiene la
  estética de "card de listado", sino de modal/dialog estático.

### A crear

Ninguno reutilizable. `ResendButton` y `NewPasswordForm` son específicos
de sus rutas y viven junto a su `page.tsx`/`route.ts`.

### Estados visibles

- `ResendButton`:
  - `default` → "Reenviar correo".
  - `loading` → spinner del Button (`loading` prop).
  - `success` → mensaje verde + botón deshabilitado con countdown.
  - `error` → mensaje rojo + botón habilitado (puede reintentar pasado
    el cooldown).
- `NewPasswordForm`:
  - `default`, `submitting` (botón loading), `error` (mensaje inline
    bajo el campo), éxito redirige a `/login?reset=ok`.

---

## Datos

### Tablas que la feature toca

- `auth.users` — vía `supabase.auth.*` (no SELECT directo).
- `public.profiles` — SELECT de `role` en el callback y en
  `signInWithPassword` para decidir redirección post-login.

### Columnas necesarias

De `profiles`: solo `id` y `role`. RLS permite el SELECT porque la
política `profiles_select_authenticated` es `using (true)` para usuarios
autenticados (ya aplicada en migración 002).

### Server vs Client

- Todo el módulo `src/lib/auth/` es **server-only** (las Server Actions
  llevan `'use server'`; los helpers `redirect.ts`/`site-url.ts` son
  isomorfos pero no exportan secretos).
- `src/app/auth/callback/route.ts` y `src/app/auth/reset/route.ts` son
  Route Handlers (server).
- `src/app/auth/reset/new/page.tsx` y `src/app/auth/verify-email/page.tsx`
  son **Server Components** porque hacen `await createClient()` y
  redirigen condicionalmente.
- `NewPasswordForm.tsx` y `ResendButton.tsx` son **Client Components**
  con `'use client'`: necesitan `useActionState` (o equivalente) +
  `useState` para cooldown y estados locales.

---

## Interactividad

### Server Actions vs API routes

- Todas las mutaciones de auth → **Server Actions** (excepto callback de
  OAuth/reset, que requiere GET porque Supabase redirige al usuario al
  link del email/Google). Las route handlers son la única ruta válida
  para `exchangeCodeForSession` con un GET externo.

### Por qué `"use client"` donde se usa

- `ResendButton`: cooldown con `setTimeout`/`setInterval`, requiere
  `useState`/`useEffect`. No puede ser server.
- `NewPasswordForm`: validación inline antes de submit (matchear
  contraseñas) + `useActionState` para mostrar errores sin perder el
  contenido de los inputs en errores. Posible candidato a Server
  Component con `<form action={updatePassword}>` plano, pero perdemos
  el feedback granular sin un wrapper Client.

---

## Estados

### Loading

- Botones (Submit, Reenviar): usar el `loading` prop existente del
  componente `Button` (muestra spinner sobre el contenido a `opacity-0`).
- Páginas (`verify-email`, `reset/new`): no necesitan skeleton — son
  estáticas hasta que el user interactúa. El Server Component se renderiza
  en server y llega ya pintada.

### Empty / sin datos

No aplica — la feature no lista datos.

### Error

- Errores de Server Actions se devuelven como `AuthFailure` y se renderizan
  inline en el form (`text-danger`).
- Errores de Route Handlers redirigen a `/login?error=<code>` y la
  pantalla `login` (otra feature) muestra el toast/banner correspondiente.
  Esta feature **no** implementa el render del toast; solo define el
  contrato del query param `error=<AuthErrorCode>`.

---

## Notas para el implementer

- **`'use server'` por archivo**, no por export. Es obligatorio en Next
  16 para que las Server Actions sean utilizables desde Client Components.
- **`await cookies()` y `await headers()`** en Next 16. Los helpers
  `createClient()` ya lo manejan.
- **No** importar `createAdminClient` en esta feature. La inserción de
  notificaciones tras eventos de auth queda fuera de scope (la maneja
  el trigger `handle_new_user` y otras features).
- **Probar redirect 303 desde Server Action a URL externa** (caso Google
  OAuth). Si Next 16 retorna 307 y rompe el flujo, alternativa: la
  Server Action retorna `{ ok: true, data: { url } }` y el Client
  Component hace `window.location.href = url`. Documentado como riesgo.
- **No** crear las migraciones de auth aquí — los profiles ya están
  creados, el trigger `handle_new_user` ya está aplicado.
- **No** confundir el route handler `/auth/callback` con la página de
  login. El callback solo redirige; no renderiza UI.
- **Logs**: en errores no esperados (`unknown`), hacer
  `console.error('[auth]', codeMapeado, err)` en server para tener
  trazabilidad. Nunca en client.
- **No usar `revalidatePath`/`revalidateTag`** en estas Server Actions:
  no estamos invalidando data caches; estamos rotando sesión. El
  middleware ya refresca el token en el próximo request.

---

## Test manual

El implementer debe ejecutar estos pasos antes de marcar la feature como
lista para reviewer. Cada paso debe pasar.

1. **Signup con email/password (camino feliz)**
   - `pnpm dev`, ir a `/login?mode=signup` (renderiza la pantalla de
     login del MVP — si aún no existe, usar curl con `signUpWithPassword`).
   - Llenar `email`, `password` (≥8 chars con letra y número),
     `confirmPassword`, `fullName`.
   - Submit → redirect a `/auth/verify-email?email=<email>`.
   - Pantalla muestra el email. Botón "Reenviar correo" visible.
   - Revisar inbox (o tabla `auth.users` en Supabase): hay un email
     pendiente de confirmación.

2. **Signup con email ya existente**
   - Repetir el signup con un email ya registrado.
   - El form muestra inline "Ya existe una cuenta con ese correo. Inicia
     sesión." Sin redirect.

3. **Signup con contraseña débil**
   - Submit con password de 5 chars.
   - Validación zod local marca error "Contraseña demasiado débil…" antes
     de tocar Supabase.

4. **Confirmar email → login**
   - Abrir el link del email recibido. Llegada a
     `/auth/callback?code=...&type=signup`.
   - Callback intercambia el code, fetch profile.role (= `'user'`),
     redirect a `/`.
   - Loguear el usuario por primera vez: ir a `/login`, submit con las
     credenciales → redirect a `/` (rol user).

5. **Login con credenciales inválidas**
   - Email/password incorrectos → mensaje "Email o contraseña incorrectos."

6. **Login con email no confirmado**
   - Crear un user fresco, NO confirmar email, intentar login → mensaje
     "Confirma tu correo antes de iniciar sesión. ¿No te llegó? Reenvíalo."

7. **Reenviar verificación**
   - En `/auth/verify-email?email=<email>` apretar "Reenviar correo".
   - Botón pasa a `loading` → mensaje verde "Te enviamos un nuevo enlace."
   - Botón deshabilitado con countdown 60s.
   - Segundo email llega.

8. **OAuth Google (camino feliz)**
   - En `/login` apretar "Continuar con Google".
   - Redirect a accounts.google.com → consentir.
   - Vuelta a `/auth/callback?code=...` → exchange → fetch role → redirect
     a `/` (o `/dashboard` si el user es agent).

9. **OAuth Google (cancelado)**
   - Cancelar el consentimiento en Google.
   - Vuelta a `/auth/callback?error=access_denied` → redirect a
     `/login?error=oauth_cancelled`.

10. **Reset password — solicitud**
    - En `/login` apretar "Olvidé mi contraseña" → form con email.
    - Submit con email existente: mensaje genérico "Si la cuenta existe,
      te enviamos un enlace…".
    - Submit con email inexistente: **mismo mensaje genérico** (no leak).

11. **Reset password — uso del enlace**
    - Abrir el link del correo → `/auth/reset?code=...`.
    - Route handler intercambia code → redirect a `/auth/reset/new`.
    - Renderiza form de nueva contraseña.
    - Submit con password válida → redirect a `/login?reset=ok`.
    - Login con la nueva contraseña funciona.

12. **Reset password — enlace inválido/expirado**
    - Abrir un link manualmente con code inválido → redirect a
      `/login?error=reset_token_invalid`.

13. **SignOut**
    - Estando logueado, invocar `signOut` (botón del avatar dropdown
      cuando exista, o `curl` POST a la acción).
    - Sesión revocada → redirect a `/login`.
    - Recargar `/profile` → middleware redirige a
      `/login?next=/profile`.

14. **Middleware — ruta protegida sin sesión**
    - `curl -I http://localhost:3000/dashboard` → `302` a
      `/login?next=/dashboard`.

15. **Middleware — ruta protegida con sesión**
    - Logueado como agent → `GET /dashboard` responde 200.

16. **`next` post-login respetado**
    - Acceder a `/profile` sin sesión → redirect a `/login?next=/profile`.
    - Login exitoso → redirect a `/profile` (no a `/`).

17. **`next` malicioso rechazado**
    - Acceder manualmente a `/login?next=https://evil.com`.
    - Tras login, redirect a `/` (default por rol), **no** a evil.com.
    - Probar también `next=//evil.com` y `next=/auth/callback` → ambos
      ignorados.

---

## Riesgos

1. **Carrera entre `handle_new_user` trigger y el callback**
   El trigger inserta el row en `profiles` en el commit del INSERT a
   `auth.users`. En la práctica está disponible en el siguiente fetch,
   pero si ocurriera una latencia inusual, el callback haría
   `select role` y obtendría `null`. El fallback `role ?? 'user'`
   garantiza redirección segura (a `/`). El user puede recargar y la
   próxima vez ya cargará el rol correcto.
   **Mitigación adicional**: si `profile` es null, intentar un segundo
   fetch con backoff de 100ms (1 reintento). Si sigue null, redirigir
   a `/` y dejar que el dashboard del rol "correcto" se gane en el
   próximo login. **Decisión sugerida**: no reintentar; aceptar el
   fallback. El cost es 0 en práctica.

2. **Email enumeración vía signup**
   `signUp` con email existente devuelve `user_already_exists`. Esto
   permite enumerar cuentas. **Mitigación**: en signup sí devolvemos el
   error (porque ofrecemos UX clara "Inicia sesión"); en reset password
   sí silenciamos. Es un tradeoff conocido — Supabase ofrece flag
   "Confirm email on signup" que oculta el conflicto pero hace UX peor.
   **Decisión sugerida**: mantener como está; el risk es bajo para un
   proyecto de aprendizaje.

3. **Open-redirect vía `next`**
   Mitigado por `safeNextPath`. Cualquier path que no empiece con `/`,
   empiece con `//`, contenga newlines, o sea `/auth/...` se descarta.
   **Riesgo residual**: si un developer futuro consume `next` sin pasar
   por `safeNextPath`. Mitigación: documentado en el JSDoc del helper
   y mencionado en CLAUDE.md como decisión (a añadir tras review).

4. **Rate limits de Supabase Auth (email)**
   Supabase tiene un rate limit por defecto en el envío de emails
   (signup confirm, password reset, magic link): ~4 emails/hora por
   email. En desarrollo local probando flujos repetidamente se puede
   bloquear. **Mitigación**: documentar en el README cómo el implementer
   puede ajustar el rate limit en el dashboard de Supabase durante
   desarrollo. Sin código aquí.

5. **Redirect 303 desde Server Action a URL externa (Google OAuth)**
   Documentado arriba en "Notas para el implementer". Si Next 16 rompe
   este flujo, plan B es retornar `data.url` y redirigir client-side.

6. **`emailRedirectTo` no whitelisteado en Supabase**
   Si el implementer apunta el `redirectTo` a un dominio no listado en
   Auth → URL Configuration, Supabase rechaza el OAuth. Documentado en
   "Configuración requerida en el dashboard de Supabase".

7. **Sesión recovery confundida con sesión normal**
   Cuando el user hace click en el link de reset, Supabase setea una
   sesión `recovery`. Si el user navega a `/dashboard` antes de
   actualizar el password, técnicamente está "autenticado". El
   middleware no distingue ambos. **Mitigación**: la página
   `/auth/reset/new` debe fetchear y verificar que la sesión sea de
   tipo recovery vía `supabase.auth.getSession()` y leer
   `session.user.aud`. Si quisiéramos forzar update antes de cualquier
   navegación, habría que añadir un check global. **Decisión sugerida**:
   aceptar el riesgo bajo (el user perdería acceso real solo si conoce
   la sesión recovery; el fix es mínimo y se puede aplicar después).

8. **El user borra su cuenta en Supabase pero las cookies persisten**
   El middleware llama `getUser()` que revalida server-side; si el user
   no existe, `user` es `null` y el middleware redirige a `/login`. Sin
   riesgo material.

---

## Alternativas consideradas

### A. Estructura de retorno de errores

**Opción A1 — `{ ok, error }` (recomendada)**
Cada Server Action retorna `AuthResult` discriminada. El Client Component
usa `useActionState` y renderiza el error inline.

- ✅ El form mantiene los inputs en error sin código extra.
- ✅ El Client tipa el resultado.
- ❌ Más boilerplate en cada action que un throw simple.

**Opción A2 — throw + Next error boundary**
La action lanza `new AuthError(code, message)` y Next abre la error
boundary del segmento.

- ✅ Código más corto.
- ❌ El form pierde su estado (inputs vacíos tras error).
- ❌ Error boundary global no es granular por campo.
- ❌ Mezcla errores esperados (credenciales malas) con bugs.

**Opción A3 — `useFormState` con state plano (sin `ok`)**
La action devuelve directamente `{ code?, message?, fieldErrors? }`.

- ✅ Casi idéntica a A1, ligeramente menos verbose.
- ❌ Discriminación menos clara entre éxito y error; el Client tiene
  que detectar "ausencia de error" en lugar de "presencia de éxito".

**Recomendación**: **A1**. El proyecto ya usa Server Actions con UI
controlada (login_screen también va por este camino). La discriminada
es el patrón idiomático recomendado por la doc de Next 16.

### B. Pantalla intermedia post-signup

**Opción B1 — ruta dedicada `/auth/verify-email` (recomendada)**
Server Action redirige a esta ruta tras signup, pasando email por query
param.

- ✅ URL compartible / bookmarkable (en práctica no se necesita pero no
  estorba).
- ✅ Lógica clara: una ruta, una responsabilidad.
- ✅ Si el user vuelve después con la URL, la página detecta sesión
  activa y redirige.
- ❌ Un archivo más.

**Opción B2 — flag de estado en la propia página de signup**
El form de signup mantiene un `useState` que cambia tras éxito y
muestra la misma card transformada (texto distinto, mismo container).

- ✅ Cero rutas adicionales.
- ❌ El user no puede recargar la página sin perder el estado.
- ❌ Acopla `verify-email` a la feature `login_screen`. La separación
  permite que `auth_layer` sea reutilizable sin depender del
  futuro `/login`.

**Opción B3 — toast post-signup y mantenerse en `/login`**
Tras signup, mostrar toast "Revisa tu correo" y permanecer en login.

- ✅ Mínimo cambio.
- ❌ Toast efímero: si el user no lo lee, pierde la instrucción crítica.
- ❌ No hay UX dedicada para "reenviar correo".

**Recomendación**: **B1**. Es la mejor separación de responsabilidades y
la única que soporta correctamente el reenvío y el caso de regreso del
usuario.

### C. Reset password landing

**Opción C1 — Route Handler + Server Component con Client form (recomendada)**
`/auth/reset` es route handler GET que hace el exchange; redirige a
`/auth/reset/new` que es Server Component renderizando un form Client.

- ✅ Separa el "consumir token" del "renderizar form".
- ✅ Si el exchange falla, redirige limpio a `/login?error=...` sin
  renderizar el form roto.
- ✅ El Server Component verifica sesión recovery antes de renderizar.
- ❌ Dos archivos en lugar de uno.

**Opción C2 — Page Server Component que hace todo**
`/auth/reset/page.tsx` recibe el code por searchParam, hace el exchange
y renderiza el form. No hay route handler intermedio.

- ✅ Un archivo.
- ❌ Mezcla un side effect (mutar cookies/exchange) con un render. En
  Next 16 los Server Components no deberían tener side effects en el
  render path; el exchange-en-render rompe el modelo mental.
- ❌ Recargar la página re-intentaría el exchange, fallaría (code
  consumido) y mostraría error aunque el reset técnicamente funcionó.

**Opción C3 — Route handler que setea cookie y redirige a `/profile?reset=1`**
El user actualiza la contraseña desde la pantalla de perfil normal.

- ✅ Cero pantallas nuevas.
- ❌ El user no espera "ir al perfil" para resetear; UX confusa.
- ❌ Acopla con la feature `user_profile_screen` (que aún no existe en
  esta versión).

**Recomendación**: **C1**. Más limpia, más robusta ante recargas, y
respeta el modelo de Server Components sin side effects en render.

---

## Criterios de aceptación verificables

El reviewer marca cada uno tras leer código y ejecutar el test manual.

- [ ] Existe `src/lib/auth/actions.ts` con `'use server'` y exporta
      `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`,
      `signOut`, `requestPasswordReset`, `updatePassword`,
      `resendVerificationEmail`. Todas tipadas.
- [ ] Existe `src/lib/auth/schemas.ts` con esquemas zod usados por las
      actions. Las contraseñas exigen mínimo 8 chars con al menos 1 letra
      y 1 número.
- [ ] Existe `src/lib/auth/errors.ts` con `AuthErrorCode` (union type) y
      `mapSupabaseError` que **nunca** devuelve `err.message` crudo en
      `message`.
- [ ] Existe `src/lib/auth/redirect.ts` con `getRedirectPathForRole`
      (mapea `admin → /admin`, `agent|broker → /dashboard`,
      `user → /`, fallback `/`) y `safeNextPath` con los 6 checks
      documentados.
- [ ] Existe `src/lib/auth/site-url.ts` con `getSiteUrl`.
- [ ] Existe `src/app/auth/callback/route.ts` (GET) que maneja OAuth y
      confirmación de email; en éxito redirige por rol o respeta
      `next`; en error redirige a `/login?error=<code>`.
- [ ] Existe `src/app/auth/reset/route.ts` (GET) que intercambia el code
      de reset y redirige a `/auth/reset/new`.
- [ ] Existe `src/app/auth/reset/new/page.tsx` (Server Component) que
      verifica sesión recovery y renderiza `NewPasswordForm`.
- [ ] Existe `src/app/auth/reset/new/NewPasswordForm.tsx` (Client
      Component) que invoca `updatePassword`.
- [ ] Existe `src/app/auth/verify-email/page.tsx` (Server Component)
      que lee `searchParams.email`, redirige a home si hay sesión
      activa, y renderiza la card descrita con `ResendButton`.
- [ ] Existe `src/app/auth/verify-email/ResendButton.tsx` (Client
      Component) con cooldown 60s tras éxito.
- [ ] Existe `middleware.ts` en la raíz del repo que invoca
      `updateSession`. El `config.matcher` excluye `_next/static`,
      `_next/image`, `favicon.ico` y assets estáticos comunes.
- [ ] Cero hex literales en JSX/CSS de los archivos creados.
- [ ] Cero `console.log` debug; los `console.error` solo bajo
      `AuthErrorCode === 'unknown'`.
- [ ] `pnpm lint` y `pnpm type-check` pasan sin warnings.
- [ ] El `safeNextPath` rechaza correctamente: `https://evil`, `//evil`,
      `/auth/callback`, strings con `\n`, strings > 512 chars.
- [ ] Los 17 pasos del Test manual ejecutados y aprobados.
- [ ] `.env.example` documenta `NEXT_PUBLIC_SITE_URL` con explicación
      de cuándo es requerida.

---

## A11y (transversal)

- Todos los `<form>` con `<label htmlFor>` explícito o `aria-label`
  cuando no hay label visible (no es el caso aquí, todos tienen label).
- Mensajes de error con `role="alert"` y `aria-live="assertive"`.
- Mensaje de éxito ("correo reenviado") con `role="status"` y
  `aria-live="polite"`.
- Foco manejado por Next por defecto en cada navegación.
- `Button` ya incluye focus-visible ring en `ui_primitives`.
- Contraste: todos los pares usados (`text-on-surface` / `bg-surface`,
  `text-muted` / `bg-surface`, `text-on-primary` / `bg-primary`) cumplen
  AA mínimo. Tokens revisados contra WCAG 2.1 en `docs/design-system.md`.
