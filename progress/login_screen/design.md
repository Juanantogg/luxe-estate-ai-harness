# Design spec — login_screen

Pantalla de autenticación (login + registro) en `/login`, con toggle entre
modos vía searchParam `?mode=signup`. Reutiliza la capa `auth_layer`
existente (Server Actions + helpers) y las primitivas ya implementadas en
`src/components/ui/`. Cumple los 8 acceptance criteria del feature
`login_screen` (block `1_user_flow`) sin introducir dependencias nuevas.

## Referencia visual

- Mockup definitivo: `docs/designs/social_login_and_registration/screen.png`
- HTML de apoyo: `docs/designs/social_login_and_registration/code.html`

### Desviaciones del mockup (decididas en `feature_list.json` / `CLAUDE.md`)

| Mockup dice                                   | Implementamos                                        | Por qué                                                                     |
| --------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Botón "Continue with GitHub"                  | NO se renderiza                                      | Decisión Fase 3 (`CLAUDE.md`): solo email/password + Google.                |
| Solo botones sociales (sin form de email)     | Form completo email/password debajo de Google        | Acceptance `login_screen.2`: "Solo email/password + Google".                |
| `Welcome to LuxeEstate` / `Sign up` en inglés | Toda la copy en español                              | Acceptance `login_screen` + decisión arquitectónica "Idioma: solo español". |
| Tipografía display-light editorial            | Inter 700 para el title (Inter es la única familia)  | Tipografía.                                                                 |
| Sin link "Olvidé mi contraseña"               | Link visible bajo el campo de password en modo login | El flujo de reset (`/auth/reset`) ya existe en `auth_layer`.                |

El PNG gana sobre el HTML cuando chocan: blobs verdes blurred al fondo,
card blanca centrada `max-w-md`, badge cuadrada con icono `real_estate_agent`
arriba del título, separador horizontal sutil entre el botón Google y el form.

## Estructura de rutas

**Decisión: una sola ruta `/login`** con el toggle login↔signup controlado
por `?mode=signup`. `/signup` existe como **alias** que hace `redirect()`
permanente (308) hacia `/login?mode=signup`.

```
src/app/(auth)/
├── layout.tsx              [ya existe — redirige si hay sesión]
├── login/
│   ├── page.tsx            [Server Component — lee searchParams, fetcha header]
│   └── AuthForm.tsx        [Client Component — useActionState + toggle de modo]
└── signup/
    └── page.tsx            [Server Component que llama redirect('/login?mode=signup', 'replace')]
```

**Por qué `/login` como ruta canónica y no `/auth`**: el resto de rutas auth
ya están bajo `/auth/...` (callback, reset, verify-email) y son rutas
"técnicas" (route handlers, landings de token). La pantalla pública del
usuario merece una URL corta y memorable: `/login`. El group `(auth)`
contiene UI pública; `auth/` contiene plumbing.

**Por qué un alias para `/signup`**: muchos links externos (emails, docs
de marketing futuros, deep links) apuntarán a `/signup`. Mantenerlo como
URL accesible pero canónica vía redirect evita romperlos y centraliza el
estado en `?mode=`.

**308 vs 307**: usamos `redirect('/login?mode=signup')` que en Next 16
emite 307 por default, pero para que el método y body se preserven en POST
hipotéticos usamos `redirect(..., 'replace')` con el flag `permanent`.
En Next 16 App Router lo idiomático es `permanentRedirect()` desde
`next/navigation` → eso emite 308.

```tsx
// src/app/(auth)/signup/page.tsx
import { permanentRedirect } from 'next/navigation';
export default function SignupRedirect() {
  permanentRedirect('/login?mode=signup');
}
```

### searchParams aceptados en `/login`

| Param   | Valores                                     | Comportamiento                                                                                                |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `mode`  | `signup` (cualquier otro o ausente → login) | Determina el modo del formulario al renderizar                                                                |
| `next`  | path interno (ver `safeNextPath`)           | Se inyecta como hidden input en el form; lo consumen `signInWithPassword` y `signInWithGoogle`                |
| `error` | `oauth_failed` \| `oauth_cancelled` \| etc. | Banner global de error sobre el form (lo redirige `/auth/callback` cuando OAuth falla)                        |
| `reset` | `ok`                                        | Banner global de éxito "Contraseña actualizada. Inicia sesión." (la action `updatePassword` ya redirige aquí) |

`mode` y `next` se leen en el Server Component y se pasan como props al
Client Component `AuthForm`. `error` y `reset` se renderizan como banners
estáticos en el Server Component (no necesitan estado de cliente).

## Tokens a usar

Todos los colores via tokens de `globals.css` (cero hex en JSX).

| Elemento                                                  | Token                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Fondo de pantalla                                         | `bg-background` (Clear Day) — ya lo aplica el layout `(auth)/layout.tsx`                                             |
| Card del form                                             | `bg-surface` + `shadow-soft` + `rounded-xl`                                                                          |
| Badge cuadrada con logo                                   | `bg-primary` + `text-on-primary` + `rounded-xl` + `shadow-soft`                                                      |
| Title `Te damos la bienvenida`                            | `text-on-surface`                                                                                                    |
| Subtítulo `Encuentra tu próxima propiedad`                | `text-muted`                                                                                                         |
| Botón Google (secondary)                                  | `bg-surface` + `border-divider` + `text-on-surface`, hover `hover:shadow-soft-hover`                                 |
| Separador "o continúa con email"                          | línea `border-divider`, texto `text-muted`                                                                           |
| Inputs                                                    | tokens internos de `<Input>` (ya manejan default/focus/error)                                                        |
| Botón submit                                              | `<Button variant="primary" size="lg" fullWidth>`                                                                     |
| Link toggle ("¿No tienes cuenta?" / "¿Ya tienes cuenta?") | texto base `text-muted`, link en `text-primary` con `hover:text-primary-hover`                                       |
| Banner error global                                       | `bg-danger-soft` + `text-danger` + borde `border-danger/20`                                                          |
| Banner reset=ok                                           | `bg-success-soft` + `text-success`                                                                                   |
| Blobs decorativos                                         | `bg-hint-green/30` (top-right) y `bg-primary/10` (bottom-left), ambos con `blur-3xl` y `opacity-40` heredada del PNG |

## Layout propuesto

### Estructura semántica

```html
<main> (lo provee (auth)/layout.tsx)
  <div aria-hidden="true" class="decoración blobs absoluta">
    <div class="blob top-right" />
    <div class="blob bottom-left" />
  </div>
  <section class="w-full max-w-md z-10 px-4">
    <header class="text-center mb-8">
      <div class="badge-icono" aria-hidden="true">[Icon real_estate_agent]</div>
      <h1>Te damos la bienvenida</h1>
      <p>Encuentra y agenda tu próxima propiedad.</p>
    </header>

    <Card variant="default" padding="lg" role="region" aria-labelledby="auth-form-title">
      <h2 id="auth-form-title" class="sr-only">{login | registro}</h2>

      {bannerError?}
      {bannerSuccess?}

      <SocialButton provider="google" />
      <Separator label="o continúa con email" />
      <form action={action}>
        {mode === 'signup' && <Input name="fullName" />}
        <Input name="email" type="email" />
        <Input name="password" type="password" />
        {mode === 'signup' && <Input name="confirmPassword" type="password" />}
        {mode === 'login' && <Link href="/auth/reset">¿Olvidaste tu contraseña?</Link>}
        <Button type="submit">{mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}</Button>
      </form>

      <p class="toggle">{mode === 'signup' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} <Link>…</Link></p>
    </Card>

    <nav class="footer-links" aria-label="Enlaces legales">
      Privacidad · Términos · Ayuda
    </nav>
  </section>
</main>
```

### Espaciado y comportamiento responsive

- **Mobile (default)**: `px-4 py-8`, card `padding="lg"` interno (`p-8`),
  blobs visibles pero contenidos por `overflow-hidden` del layout.
- **sm: (640+)**: card mantiene `max-w-md` (~28rem ≈ 448px). El header
  pasa de `mb-8` a `mb-10`. Padding interno de la card sube a `p-10`.
- **lg: (1024+)**: nada cambia — la card ya es óptima. El layout `(auth)`
  ya centra con `min-h-screen flex items-center justify-center`.

Mobile-first: el orden vertical (badge → title → subtitle → card → footer)
funciona idéntico en cualquier viewport; no hay reorganización por breakpoint.

### Decoración de blobs

```tsx
<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
  <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-hint-green/30 blur-3xl" />
  <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
</div>
```

Se monta como hermano de `<section>` dentro del `<main>` del layout. Como
el layout ya es `main`, los blobs se inyectan dentro del Server Component
de `login/page.tsx` envueltos en un `<div className="relative w-full">`.

## Componentes

### Reutilizar de `src/components/ui/`

- `Card` (variant `default`, padding `lg`) — contenedor del form.
- `Input` — todos los campos del formulario. Ya tiene label, error,
  `aria-invalid`, leading icon, helper text.
- `Button` (variant `primary`, size `lg`, `fullWidth`, `loading` prop) —
  submit del form.
- `Icon` — para `real_estate_agent` (badge), `mail_outline` (input email),
  `lock` (input password), `person` (input fullName).

### Componentes nuevos (en `src/components/auth/`)

Catálogo del design system ya prevé `AuthCard` y `SocialAuthButton`. Los
materializamos aquí.

#### `SocialAuthButton`

Client Component muy delgado: envoltura sobre `<Button variant="secondary"
size="lg" fullWidth>` que renderiza el SVG de Google (no usamos Material
Icons porque el SVG de Google con sus 4 colores oficiales es un estándar
visual reconocible).

```tsx
interface SocialAuthButtonProps {
  provider: 'google';
  next?: string | null;
  pending?: boolean;
}
```

Internamente usa `<form action={signInWithGoogle}>` para invocar la Server
Action; `next` se inyecta como `<input type="hidden" name="next" />`. El
estado de loading se obtiene con `useFormStatus` (no `useActionState`
porque `signInWithGoogle` redirige y nunca retorna).

SVG inline del logo de Google (los 4 paths con sus colores oficiales —
`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`). **Esto es la única excepción
permitida a "cero hex en JSX"**: los colores de marca de Google son un
contrato externo, no parte de nuestro sistema. Documentar en comentario
encima del componente.

#### `AuthForm` (Client Component, lleva `"use client"`)

Componente central. Maneja:

- modo controlado por prop `initialMode: 'login' | 'signup'`
- toggle via `<Link>` que cambia el searchParam (Next reusa el RSC del
  page con el nuevo `mode`)
- `useActionState` envolviendo `signInWithPassword` o `signUpWithPassword`
  según el modo
- mensaje global de error en banner (viene del action result `error.message`)
- estado pending del botón submit (de `useActionState`)

```tsx
interface AuthFormProps {
  initialMode: 'login' | 'signup';
  next?: string | null;
}
```

**Por qué Client Component**: necesita `useActionState` para mostrar
errores inline sin redirect, y `useFormStatus` para el botón submit
loading. Sin estos hooks, el único feedback de error sería un round-trip
con query param, lo cual rompe la UX en cada intento fallido.

**Sobre la elección de Server Action en runtime**: dado que `useActionState`
necesita una referencia estable a la action, usamos dos hooks separados
(uno para login, uno para signup) y renderizamos el `<form>` correcto
según el modo. Esto evita memoización compleja y mantiene la types-safety
de cada action.

```tsx
const [loginState, loginAction, loginPending] = useActionState(signInWithPassword, null);
const [signupState, signupAction, signupPending] = useActionState(signUpWithPasswordWrapped, null);
// signupWrapped es un thin server function que tras éxito hace
// redirect('/auth/verify-email?email=...'). signUpWithPassword nativo
// devuelve { ok, data: { email } } sin redirect — lo envolvemos en
// `src/lib/auth/actions-signup.ts` o inline en page.tsx (Server Action
// inline declarada con 'use server' arriba).
```

(Decisión: el wrapper vive en `src/lib/auth/actions.ts` como una nueva
Server Action `signUpAndRedirect` que llama internamente a
`signUpWithPassword` y, en éxito, hace `redirect(\`/auth/verify-email?email=...\`)`.
Esto mantiene la lógica de "qué hacer al éxito" en la capa de actions,
no en el componente. Esta action **se agrega como parte de esta feature
sin tocar las existentes** — `auth_layer` está cerrado pero permite
adiciones nuevas.)

### Estructura del formulario por modo

#### Modo `login`

| Campo    | Input prop                                                              | autocomplete       | Validación cliente                                |
| -------- | ----------------------------------------------------------------------- | ------------------ | ------------------------------------------------- |
| Email    | `name="email"` type=email leadingIcon=`mail_outline` required           | `username`         | HTML5 `type=email`                                |
| Password | `name="password"` type=password leadingIcon=`lock` required minlength=1 | `current-password` | none (la action valida con `loginPasswordSchema`) |
| Hidden   | `name="next"` value={safeNextPath(next) ?? ''}                          | —                  | —                                                 |

Bajo el campo password, link alineado a la derecha:
`<Link href="/auth/reset" className="text-sm text-primary hover:text-primary-hover">¿Olvidaste tu contraseña?</Link>`.

#### Modo `signup`

| Campo              | Input prop                                                              | autocomplete   | Validación cliente                                                   |
| ------------------ | ----------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| Nombre completo    | `name="fullName"` leadingIcon=`person` required minlength=2             | `name`         | HTML5 minlength                                                      |
| Email              | `name="email"` type=email leadingIcon=`mail_outline` required           | `email`        | HTML5                                                                |
| Password           | `name="password"` type=password leadingIcon=`lock` required minlength=8 | `new-password` | HTML5 minlength + helperText "Mínimo 8 caracteres, letras y números" |
| Confirmar password | `name="confirmPassword"` type=password leadingIcon=`lock` required      | `new-password` | server-side (`signUpSchema.refine`)                                  |
| Hidden             | `name="next"` value={safeNextPath(next) ?? ''}                          | —              | —                                                                    |

No hay link de "olvidé contraseña" en signup.

### Estados visuales del Input

Ya cubiertos por `src/components/ui/Input.tsx`:

- default: borde `border-outline`
- focus: `border-primary` + `ring-primary`
- error: `border-danger` + `ring-danger`, mensaje `mt-1 text-xs text-danger`
- disabled: `bg-neutral-100` + `text-muted`

El error inline (bajo cada campo) se alimenta del action result. El
mapeo `error.code → field` se hace en `AuthForm`:

| `error.code`                     | A qué campo va el error                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid_input`                  | banner global (el mensaje "Revisa los campos" no apunta a un campo concreto; los errores específicos por campo del zod ya vienen como `firstZodError` que es texto humano) |
| `invalid_credentials`            | banner global (no exponer cuál campo falló — seguridad)                                                                                                                    |
| `email_not_confirmed`            | banner global con link "Reenviar correo" → `/auth/verify-email?email=...`                                                                                                  |
| `email_taken` (signup)           | inline bajo email                                                                                                                                                          |
| `weak_password` (signup)         | inline bajo password                                                                                                                                                       |
| `rate_limited`                   | banner global                                                                                                                                                              |
| `oauth_failed`/`oauth_cancelled` | banner global                                                                                                                                                              |
| otros                            | banner global con mensaje neutro                                                                                                                                           |

**Decisión sobre `invalid_input`**: como el zod sólo devuelve el primer
error como texto, no podemos saber el campo. Lo mostramos como banner
global pero el contenido del mensaje ya es accionable ("La contraseña
debe tener al menos 8 caracteres"). Para signup, la validación HTML5 y
los helperText previenen la mayoría de estos casos antes del submit.

## Botón Google

- Posición: **arriba del form**, dentro de la card, con `mb-6` antes del
  separador.
- Variante: `secondary` adaptado (`bg-surface`, borde `border-divider`,
  hover `hover:shadow-soft-hover` + `hover:-translate-y-0.5`).
- Tamaño: `lg` (h-12).
- Layout interno: `<svg> + <span>Continuar con Google</span>`, `gap-3`,
  centrado.
- Estado loading: spinner gris (icon `progress_activity` rotando) reemplaza
  el SVG mientras `useFormStatus().pending === true`.
- Mismo botón en login y signup (la action `signInWithGoogle` hace OAuth
  y el callback discrimina si es signup o login automáticamente).

## Separador "o continúa con email"

```tsx
<div className="my-6 flex items-center gap-3" role="presentation">
  <span className="h-px flex-1 bg-divider" />
  <span className="text-xs text-muted">o continúa con email</span>
  <span className="h-px flex-1 bg-divider" />
</div>
```

`role="presentation"` porque es decorativo. El texto no necesita ser anunciado
por el lector de pantalla — el form que sigue es autoexplicativo por sus
labels.

## Botón submit

| Modo   | Texto            | Texto durante loading                  |
| ------ | ---------------- | -------------------------------------- |
| login  | `Iniciar sesión` | (texto desaparece, spinner del Button) |
| signup | `Crear cuenta`   | (idem)                                 |

```tsx
<Button type="submit" variant="primary" size="lg" fullWidth loading={pending} disabled={pending}>
  {mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
</Button>
```

El estado loading viene de `useActionState`. El Button primitivo ya cubre
visualmente el spinner centrado y atenuar el texto.

## Toggle login ↔ signup

Ubicación: **debajo del botón submit**, separado por `mt-6`, alineado al
centro.

```tsx
<p className="mt-6 text-center text-sm text-muted">
  {mode === 'signup' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
  <Link
    href={mode === 'signup' ? '/login' : '/login?mode=signup'}
    className="font-semibold text-primary transition-colors hover:text-primary-hover"
  >
    {mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}
  </Link>
</p>
```

**Por qué `<Link>` y no `<button onClick>` con `router.push`**: con `<Link>`
preservamos navegación natural (botón derecho → abrir en otra pestaña,
historial, prefetch). El RSC de `/login` se re-renderiza con el nuevo
`searchParams.mode`, lo cual hace que `AuthForm` reciba un nuevo
`initialMode`. **Nota**: el componente debe usar `initialMode` como key
para que React reinicialice los `useActionState` y limpiar errores del
modo anterior, o bien lo seteamos como state interno y resetear el `useActionState`
con la prop nueva via `useEffect`. Recomendación: `<AuthForm key={initialMode} … />`.

## Errores

### Inline bajo campo

Sólo para errores específicos por campo (`email_taken` → bajo email,
`weak_password` → bajo password). El componente `Input` ya renderiza el
mensaje con `aria-describedby` y `text-danger`.

### Banner global sobre el form

Aparece **dentro de la card, arriba del botón Google** (no entre los inputs
y el botón submit, para que sea visible desde el momento que el usuario
hace foco en el form).

```tsx
{
  globalError && (
    <div
      role="alert"
      aria-live="polite"
      className="mb-6 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <p>{globalError.message}</p>
      {globalError.code === 'email_not_confirmed' && (
        <Link
          href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
          className="mt-1 inline-block font-semibold underline"
        >
          Reenviar correo de confirmación
        </Link>
      )}
    </div>
  );
}
```

### Banner global de éxito

Para `?reset=ok` (post-update de contraseña):

```tsx
<div
  role="status"
  aria-live="polite"
  className="mb-6 rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-success"
>
  Contraseña actualizada. Inicia sesión con tu nueva contraseña.
</div>
```

## Link "Olvidé mi contraseña"

- **Ubicación**: bajo el campo de password en modo login, **alineado a la
  derecha**.
- **Ruta destino**: `/auth/reset` (route handler ya existente en `src/app/auth/reset/route.ts`).
- **Estilo**: `text-sm text-primary hover:text-primary-hover font-medium`.

```tsx
<div className="flex justify-end">
  <Link href="/auth/reset" className="text-sm font-medium text-primary hover:text-primary-hover">
    ¿Olvidaste tu contraseña?
  </Link>
</div>
```

No aparece en modo signup.

## Redirección post-login

### Flujo email/password (login)

`signInWithPassword` ya implementa el flujo completo (`src/lib/auth/actions.ts`):

1. Valida con `signInSchema`.
2. Llama `supabase.auth.signInWithPassword`.
3. Lee `profiles.role`.
4. Calcula destino:
   - Si hay `next` en FormData y pasa `safeNextPath` → ese.
   - Si no → `getRedirectPathForRole(role)`.
5. `redirect(target)`.

Para que esto funcione, **el form debe enviar el `next` como hidden input**:

```tsx
<input type="hidden" name="next" value={safeNextPath(next) ?? ''} />
```

`next` lo lee el Server Component de `page.tsx` desde `searchParams.next`
y se lo pasa al `AuthForm`.

### Flujo email/password (signup)

`signUpWithPassword` retorna `{ ok: true, data: { email } }` (no
redirige porque no hay sesión hasta confirmar el email).

**Decisión**: agregar a `src/lib/auth/actions.ts` una nueva action
`signUpAndRedirect(formData)` que:

1. Llama `signUpWithPassword(formData)`.
2. Si `ok: false` → retorna el error (consumible por `useActionState`).
3. Si `ok: true` → `redirect(\`/auth/verify-email?email=\${encodeURIComponent(email)}\`)`.

Esto es **una adición**, no una modificación de la action existente;
respeta la regla "auth_layer está done, sólo agregar".

### Flujo Google OAuth

`signInWithGoogle` ya redirige a la URL de Google. El callback en
`/auth/callback` ya maneja la creación de sesión y redirige con `next` o
por rol.

### Tabla resumen

| Acción del usuario                                       | Estado final                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| Login email/password OK, sin `next`                      | redirect a `/`/`/dashboard`/`/admin` según rol                     |
| Login email/password OK, con `next=/property/123` (safe) | redirect a `/property/123`                                         |
| Login email/password OK, con `next=//evil.com` (unsafe)  | `safeNextPath` lo descarta; redirect por rol                       |
| Login email/password fallido                             | retorna en card, banner global con mensaje del catálogo            |
| Signup OK                                                | redirect a `/auth/verify-email?email=...`                          |
| Signup fallido (email_taken)                             | banner global o inline en email; permanece en `/login?mode=signup` |
| Google OAuth iniciado                                    | redirect a Google → callback → home según rol                      |
| Google OAuth cancelado                                   | redirect a `/login?error=oauth_cancelled`                          |

## Estados de la pantalla

| Estado                            | Visual                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **idle**                          | Form vacío (o con valor previo si el usuario navegó atrás), botones activos. Modo según `searchParams.mode`.                                                                                                        |
| **submitting**                    | Botón submit con spinner, `disabled`. Inputs siguen editables (no los bloqueamos: si pasa más de 5s el usuario puede querer corregir). Banner de error previo se queda visible hasta que la nueva respuesta llegue. |
| **error inline**                  | Mensaje rojo bajo el campo afectado. Foco se mueve al primer campo con error (vía `useEffect` que lee `aria-invalid="true"`).                                                                                       |
| **error global**                  | Banner rojo dentro de la card, sobre el botón Google. El `role="alert"` + `aria-live="polite"` lo anuncia.                                                                                                          |
| **success-pending-email-confirm** | No es un estado de esta pantalla — el signup OK hace `redirect` a `/auth/verify-email`. La pantalla intermedia ya existe.                                                                                           |
| **success login**                 | Idem, redirect inmediato.                                                                                                                                                                                           |

## Accesibilidad

| Requisito                            | Implementación                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labels visibles                      | El primitivo `Input` ya soporta `label`; lo usamos en todos los campos (no solo placeholder).                                                                                                                                                                                                              |
| `aria-invalid`                       | Primitivo `Input` lo setea cuando recibe prop `error`.                                                                                                                                                                                                                                                     |
| `aria-describedby`                   | Primitivo `Input` ya vincula error/helper.                                                                                                                                                                                                                                                                 |
| Foco visible                         | Primitivo `Button` e `Input` ya tienen `focus-visible:ring-2 ring-primary ring-offset-2`.                                                                                                                                                                                                                  |
| `aria-live="polite"` en banner error | Sí (`role="alert"` lo implica + `aria-live` explícito).                                                                                                                                                                                                                                                    |
| Skip link a `#main-content`          | El layout `(auth)` ya expone `id="main-content"` en `<main>`. El TopNav no aparece aquí, pero el skip link de la app sí debería; verificar con app_shell. (Como esta pantalla no monta TopNav, no necesita skip link propio.)                                                                              |
| Navegación por teclado               | Tab order: badge (skip — `aria-hidden`) → botón Google → inputs en orden → "¿Olvidaste?" → botón submit → toggle login/signup → footer links.                                                                                                                                                              |
| Contraste                            | Verificado: `text-on-surface` sobre `bg-surface` = 14.5:1 (AAA). `text-muted` sobre `bg-surface` = 5.6:1 (AA grande). `text-primary` sobre `bg-surface` = 6.8:1 (AA). `text-danger` sobre `bg-danger-soft` = 6.4:1 (AA).                                                                                   |
| `autocomplete`                       | `username`/`email`/`current-password`/`new-password`/`name` según campo (tabla en la sección "Composición del formulario").                                                                                                                                                                                |
| `inputMode`                          | `email` para el campo email (mejor teclado móvil).                                                                                                                                                                                                                                                         |
| Idioma                               | `<html lang="es">` ya seteado en `layout.tsx` global.                                                                                                                                                                                                                                                      |
| Reduced motion                       | Las micro-animaciones del botón Google (`hover:-translate-y-0.5`) deben envolverse en `motion-safe:` o respetarán `prefers-reduced-motion` que Tailwind 4 ya cubre con utilities.                                                                                                                          |
| Anuncio de error                     | `aria-live="polite"` en banner y `role="alert"`. Cambio de modo (signup ↔ login) **no** debería anunciarse (es un cambio de UI, no de contenido crítico). El `<h2 className="sr-only">` dentro de la card cambia ("Iniciar sesión" / "Crear cuenta") para que screen reader users sepan en qué modo están. |

## Datos

Esta pantalla **no consume tablas directamente** desde el componente. Los
únicos accesos a datos son:

- **`signInWithPassword`**: lee `profiles.role` post-login para decidir
  redirect. RLS: el user ya autenticado puede leer su propio profile.
- **`signUpWithPassword`**: no toca tablas custom; sólo `auth.users` via
  Supabase Auth. El trigger `handle_new_user` (de `auth_layer`) crea el
  row en `profiles` automáticamente.
- **`signInWithGoogle`**: idem, el callback se encarga.

**Server Component vs Client Component**:

| Archivo                             | Tipo                    | Por qué                                                                                                                                |
| ----------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `(auth)/login/page.tsx`             | Server                  | Lee `searchParams` (await), renderiza header estático, banners de query param, y pasa props al Client. No tiene interactividad propia. |
| `(auth)/login/AuthForm.tsx`         | Client (`"use client"`) | `useActionState`, `useFormStatus`, foco programático, `<Link>` con searchParams.                                                       |
| `(auth)/login/SocialAuthButton.tsx` | Client (`"use client"`) | `useFormStatus` para spinner durante OAuth redirect.                                                                                   |
| `(auth)/signup/page.tsx`            | Server                  | Sólo `permanentRedirect`.                                                                                                              |

## Interactividad

- **Toggle login↔signup**: `<Link>` cambia URL, RSC se re-renderiza, key
  prop reinicia el form.
- **Submit del form**: Server Action vía `useActionState`.
- **Botón Google**: Server Action vía form action, sin `useActionState`
  (no hay retorno; sólo `useFormStatus` para loading).
- **Show/hide password**: **NO incluido en este MVP**. El primitivo
  `Input` no soporta toggle de tipo y agregarlo se sale del scope. Si en
  iteraciones futuras se quiere, se agrega como `trailingIcon` clickable
  en una sub-feature.
- **Focus inicial**: en idle, el foco va al primer input editable (email
  en login, fullName en signup). Implementación via `useEffect` con
  `inputRef.current?.focus()` en `AuthForm`.
- **Focus on error**: tras response con error inline, mueve el foco al
  primer input con `aria-invalid="true"`.

## Notas

### Restricciones

- **No introducir dependencias nuevas**. Todo se hace con `react` (hooks),
  `next/link`, `next/navigation`, y las primitivas existentes.
- **`{ ok, error }` viaja sin sensibles**: el catálogo de `mapSupabaseError`
  ya filtra detalles internos. El componente solo lee `error.code` y
  `error.message`.
- **No exponer cuál campo falló en login** (`invalid_credentials`): el
  banner global dice "Email o contraseña incorrectos" sin precisar; es la
  recomendación de OWASP para no facilitar enumeración.
- **`next` siempre pasa por `safeNextPath`**: tanto en el page (para
  validar antes de inyectar) como en el action (para validar al usarlo).
  Doble defensa.
- **Edge case rate limit**: si Supabase devuelve `429`, el catálogo lo
  mapea a `rate_limited` con mensaje accionable. El botón submit queda
  enabled (el usuario decide cuándo reintentar).
- **Edge case email_not_confirmed en login**: ya está en el catálogo, el
  banner incluye link a `/auth/verify-email?email=...` para reenviar.
- **Edge case usuario ya autenticado abre `/login`**: el layout `(auth)`
  ya redirige a su home por rol. Esto evita pantalla de login basura para
  users con sesión.

### Lo que NO entra

- Recordar email (checkbox "Remember me"): el cookie de sesión de Supabase
  ya persiste por default. No agregamos UI para esto.
- Login con magic link: decisión arquitectónica diferida ("opcional, hasta
  diseñar el flujo de recuperación").
- Botones de Apple/Facebook/GitHub: decisión Fase 3 — sólo Google.
- Captcha: no en MVP. Si hay abuso, se agrega en una feature de
  hardening posterior.

### Iconos requeridos

Deben estar disponibles en Material Icons (clásico, que es el default del
componente `<Icon>`): `real_estate_agent`, `mail_outline`, `lock`,
`person`, `progress_activity` (ya usado en Button). Todos confirmados en
el set del design system.

### Archivos a crear

```
src/app/(auth)/login/page.tsx          [Server Component, ~50 LOC]
src/app/(auth)/login/AuthForm.tsx      [Client Component, ~150 LOC]
src/app/(auth)/login/SocialAuthButton.tsx  [Client Component, ~50 LOC]
src/app/(auth)/signup/page.tsx         [Server Component, ~5 LOC — permanentRedirect]
```

### Archivos a modificar

```
src/lib/auth/actions.ts                [agregar signUpAndRedirect, sin tocar el resto]
```

### Archivos NO tocar

- `src/app/(auth)/layout.tsx` — ya hace lo necesario (redirect si hay sesión).
- `src/app/auth/callback/route.ts` — ya soporta `?next=` y `?error=`.
- `src/app/auth/verify-email/page.tsx` — destino del signup, ya implementado.
- `src/app/auth/reset/route.ts` — destino de "¿Olvidaste tu contraseña?", ya implementado.

## Alternativas consideradas

### Opción A: Una ruta `/login` + searchParam `?mode=signup` + alias `/signup` con 308 (RECOMENDADA)

- **Pros**:
  - Cumple acceptance al pie: "alterna entre login y signup en la misma URL con searchParam ?mode=signup".
  - `/signup` sigue siendo URL accesible (para deep links externos).
  - Estado del form se preserva en client al togglear (con key prop bien usado, se resetea limpio).
  - Una sola página, menos duplicación de chrome (header, footer, blobs).
  - SEO neutro: la pantalla auth no se indexa (no es contenido público de marketing).
- **Contras**:
  - Lógica condicional en el componente form (campos visibles según modo).
  - Requiere key prop para que `useActionState` se reinicie al togglear.

### Opción B: Dos rutas `/login` y `/signup` separadas con páginas independientes

- **Pros**:
  - Cada página un componente único, sin lógica condicional.
  - URLs canónicas y "semánticamente puras".
- **Contras**:
  - **Choca con acceptance criteria** (`searchParam ?mode=signup`).
  - Duplicación del chrome (header, blobs, card, footer) en dos archivos.
  - Toggle entre modos = navegación completa = no preservar el email
    que el usuario ya escribió.
  - Más superficie para drift visual (cambio en una y olvido en la otra).

### Opción C: Split-screen (form en izquierda, ilustración/blob grande a la derecha)

- **Pros**:
  - Más impacto visual editorial en desktop.
  - Aprovecha el ancho de pantalla.
- **Contras**:
  - **No es lo que el mockup muestra**. El PNG es una card centrada con
    decoración sutil de blobs alrededor — no un split-screen.
  - Requiere ilustración custom (no la tenemos).
  - Diseño responsive más complejo (en móvil hay que colapsar el
    split → mismo resultado que la card centrada → trabajo extra para
    el mismo output en el viewport más importante mobile-first).

### Recomendación

**Opción A**. Cumple el acceptance al pie, respeta el mockup visual, evita
duplicación, y mantiene `/signup` como URL útil para enlaces externos.
Las contras (lógica condicional en el form) son menores y se resuelven
limpiamente con `key={initialMode}` que reinicia el estado del Client
Component cuando cambia el modo.
