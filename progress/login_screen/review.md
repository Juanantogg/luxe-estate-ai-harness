# Review — login_screen

**Veredicto:** APPROVED
**Fecha:** 2026-05-22

## Acceptance criteria (uno por uno)

- [x] 1. `src/app/(auth)/login/page.tsx` renderiza la card de
     `social_login_and_registration` adaptada — SÍ. Server Component que
     renderiza badge cuadrada con icono `real_estate_agent`, título,
     subtítulo, `<Card variant="default" padding="lg">`, blobs decorativos
     blurred y footer con Privacidad/Términos/Ayuda. Coincide con el PNG
     salvo desviaciones documentadas (form email/password incluido en la
     card, copy en español).

- [x] 2. Solo email/password + Google (sin Apple/FB visibles) — SÍ.
     `SocialAuthButton` con `provider: 'google'` literal en el type; no hay
     ningún render de Apple, Facebook o GitHub.
     `(auth)/login/page.tsx:110` solo monta el botón Google. El form de
     email/password se monta justo debajo.

- [x] 3. Errores de formulario inline, no en alerts — SÍ.
     `AuthForm.tsx:35-38` define `SIGNUP_FIELD_ERRORS` que mapea
     `email_taken → email` y `weak_password → password`. Esos errores se
     pasan como prop `error` al `<Input>` correspondiente
     (`AuthForm.tsx:141, 160`), que ya pinta el mensaje `text-xs text-danger`
     bajo el campo con `aria-invalid` y `aria-describedby`. El banner global
     solo aparece para errores sin campo específico (`invalid_credentials`,
     `rate_limited`, `email_not_confirmed`, etc.), que es la decisión
     correcta de OWASP para login.

- [x] 4. Loading state en el botón submit — SÍ. `AuthForm.tsx:192-193`
     pasa `loading={pending} disabled={pending}` al `<Button>`. El primitivo
     `Button` ya pinta spinner + `aria-busy`. El botón Google replica el
     patrón con `useFormStatus` en `SocialAuthButton.tsx:61` (spinner
     `progress_activity` reemplaza el SVG mientras `pending`).

- [x] 5. Link toggle alterna entre login y signup en la misma URL con
     `?mode=signup` — SÍ. `page.tsx:49` lee `params.mode === 'signup'` y
     pasa `initialMode` al `<AuthForm key={mode}>`. El `<Link>` del toggle
     (`AuthForm.tsx:202-207`) cambia entre `/login` y `/login?mode=signup`,
     forzando re-render con `key` que reinicia los `useActionState`. Además
     `/signup` existe como alias 308 vía `permanentRedirect('/login?mode=signup')`,
     preservando deep links.

- [x] 6. Redirige según rol usando `getRedirectPathForRole` — SÍ. La
     pantalla delega a `signInWithPassword`, que ya implementa el flujo
     (`actions.ts:53-71`): lee `profiles.role`, calcula `next ?? getRedirectPathForRole(role)`
     y hace `redirect(target)`. El form inyecta `<input type="hidden"
name="next">` (`AuthForm.tsx:115`) con el valor saneado por
     `safeNextPath` en el Server Component (`page.tsx:51`).

- [x] 7. Decoración de fondo (blobs verdes blurred) como en el mockup —
     SÍ. `page.tsx:60-66`: dos blobs `rounded-full blur-3xl` con
     `bg-hint-green/30` (top-right) y `bg-primary/10` (bottom-left),
     contenedor `aria-hidden="true" pointer-events-none absolute inset-0
overflow-hidden opacity-40`. Replica exactamente lo descrito en el
     spec.

- [x] 8. Layout responsive: card centrada, `max-w-md` en móvil/desktop —
     SÍ. `page.tsx:70-71`: `<section className="relative z-10 w-full max-w-md">`.
     Mobile-first con `px-4 py-10 sm:py-12` y `sm:p-10` en la card. El
     layout `(auth)` ya centra con flex.

## Reglas duras

- [x] Cero hex en JSX (con excepción Google documentada). Solo 4 hex en
      `SocialAuthButton.tsx` para los `fill` del SVG de Google, documentados
      en JSDoc del componente (líneas 28-33) y en comentario adyacente al
      SVG (línea 86). Resto del repo: cero hex en JSX (`grep '\[#'`
      devuelve vacío en los archivos de la feature).
- [x] `await searchParams` en `page.tsx:48`. `searchParams: Promise<...>`
      correctamente tipado.
- [x] Server Components default: `login/page.tsx` y `signup/page.tsx` son
      Server (sin `"use client"`); solo `AuthForm` y `SocialAuthButton` lo
      son, lo cual está justificado por `useActionState` / `useFormStatus`
      / refs / focus management.
- [x] Textos en español. Grep de "sign up | sign in | welcome | forgot |
      continue with" devuelve vacío en los archivos nuevos.
- [x] Sin deps nuevas. `git diff package.json` devuelve vacío.
- [x] Mobile-first. Layout funciona en `max-w-md` con padding `px-4`;
      `sm:py-12` y `sm:p-10` solo agregan respiro en pantallas más grandes.
- [x] Tokens de `globals.css`: `bg-primary`, `text-on-primary`,
      `bg-hint-green/30`, `bg-surface`, `text-on-surface`, `text-muted`,
      `border-divider`, `bg-danger-soft`, `text-danger`, `bg-success-soft`,
      `text-success`, `text-primary`, `hover:text-primary-hover`,
      `shadow-soft`, `hover:shadow-soft-hover`. Todos respaldados por
      `@theme` en `src/app/globals.css`.
- [x] Lint OK (`./init.sh` paso 2).
- [x] Type-check OK (`./init.sh` paso 3).
- [x] Build OK (`pnpm build` compila las rutas `/login` y `/signup`
      correctamente, sin errores ni warnings).

## Desviaciones del spec

1. **Input de email controlado en `AuthForm`** — RAZONABLE. El spec
   reservaba el "Reenviar correo de confirmación" para casos de
   `email_not_confirmed`. Para construir el link a
   `/auth/verify-email?email=...` se necesita conocer el email que el
   usuario tipeó. Las alternativas eran: (a) leer `formRef.current` en
   render — rompe SSR y la regla de no leer DOM en render; (b) capturar
   el valor en el `onSubmit` — pero el form se envía vía Server Action,
   y al volver con error el componente ya re-renderizó sin acceso al
   FormData original; (c) controlar el input con `useState`. La opción
   (c) es la más limpia. Tradeoff: el campo deja de ser uncontrolled,
   pero con `autoComplete="username"`/`"email"` el navegador sigue
   pudiendo rellenarlo (el `onChange` se dispara también con autofill,
   así que `emailDraft` queda sincronizado). No introduce problemas de
   hidratación porque `useState('')` se inicializa con el mismo valor
   en server y client.

2. **`useActionState` además de `useFormStatus` en `SocialAuthButton`** —
   RAZONABLE. `signInWithGoogle` retorna `Promise<AuthResult>` (no
   `void`). La prop nativa `<form action>` espera `(fd: FormData) => void
| Promise<void>`, así que pasar la action directa daría error de
   tipos o, peor, descartaría silenciosamente el `AuthResult` con el
   error. Un wrapper `async (fd) => { await signInWithGoogle(fd); }`
   funcionaría a nivel de tipos pero perdería el error que el spec pide
   mostrar al usuario ("estados loading, error visible"). `useActionState`
   es exactamente la primitiva diseñada para este caso: tipa
   correctamente la action, expone el retorno como `state`, y el
   `formAction` retornado tiene la firma void compatible con `<form>`.
   El `useFormStatus` dentro de `GoogleButton` se mantiene porque el
   botón es un componente hijo que no recibe `pending` por prop. Pequeño
   detalle estilístico: se podría haber leído `pending` del tercer
   elemento de `useActionState` y pasarlo por prop al hijo, evitando
   `useFormStatus`. La elección actual es válida y deja `GoogleButton`
   auto-contenido.

## Issues bloqueadores (si los hay)

Ninguno.

## Issues menores (no bloquean APPROVED)

- `AuthForm.tsx:104` y `page.tsx:94,104` y `SocialAuthButton.tsx:51`
  usan `rounded` (= `rounded-md`/`rounded-DEFAULT`) en los banners; el
  spec ejemplificaba `rounded-lg`. Diferencia visual mínima y consistente
  con cómo Input/Button usan `rounded`. No es regresión.
- `AuthForm.tsx` declara `mode = initialMode` (línea 46) como const
  derivada, no lo usa como estado. Es correcto (el toggle es por
  navegación, no por estado interno), pero queda como variable
  intermedia que podría haberse inlineado. Cosmético.
- `page.tsx:51` usa `safeNextPath(params.next ?? null)` y luego lo pasa
  como prop al Client; el action vuelve a saneizarlo. Doble defensa
  como pide el spec — bien.
- Solo se modificó `signUpAndRedirect` en `actions.ts` (verificado con
  `git diff`). El resto de actions intactas.

## Recomendación final

APPROVED. La feature cumple los 8 criterios al pie, las dos desviaciones
del spec son justificadas técnicamente, no introduce deps, respeta tokens,
y todo el harness (`lint` + `type-check` + `build`) pasa verde. El leader
puede proceder a commitear y marcar la feature como `done`.
