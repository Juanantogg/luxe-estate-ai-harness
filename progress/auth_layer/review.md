# Review — auth_layer

**Veredicto:** APPROVED

Revisado por inspección estática + verificaciones automáticas. Los 17 pasos
de test manual end-to-end quedan diferidos hasta que `login_screen` exista
(la propia spec lo prevé y el implementer lo documentó). La lógica
server-side se valida por código + `./init.sh full` verde.

---

## Checklist (resumen por sección)

### Reglas duras — ✅

- ✅ **Cero hex literales** en JSX/TSX de los archivos creados.
  `grep -rnE '#[0-9A-Fa-f]{3,8}' src/lib/auth src/app/auth middleware.ts` → vacío.
- ✅ `'use server'` declarado correctamente en `src/lib/auth/actions.ts:1`
  (export-level). El resto de los archivos en `src/lib/auth/` son helpers
  isomorfos (sin `'use server'`) — correcto según la spec.
- ✅ Server Components por defecto: `verify-email/page.tsx` y
  `reset/new/page.tsx` son async server components que hacen
  `await createClient()` y redirección condicional sin `"use client"`.
  `NewPasswordForm.tsx:1` y `ResendButton.tsx:1` declaran `'use client'`
  con justificación clara (`useActionState`, `useState`+`useTransition`+
  cooldown).
- ✅ Next 16 awaits: `searchParams` se await en `verify-email/page.tsx:20`,
  los helpers `createClient` ya manejan `await cookies()` internamente,
  y en Route Handlers se usa `request.url` (sync).
- ✅ Textos al usuario en español neutro; los mensajes vienen siempre del
  catálogo en `errors.ts:29-42`, nunca se filtra `err.message` crudo de
  Supabase.
- ✅ Sin `createClient` directo de Supabase: todo pasa por
  `@/lib/supabase/server` (8 sitios verificados con grep).
- ✅ Mobile-first: cards usan `max-w-md w-full` + `px-4 py-12` + `p-6 sm:p-8`.
  Layout funcional en 360px sin overflow horizontal.
- ✅ Sin dependencias nuevas. `package.json` intacto (no aparece en
  `git status`).

### Cumplimiento de spec — ✅

**Server Actions (`src/lib/auth/actions.ts`):**

- ✅ Firmas con nombres largos según spec: `signInWithPassword`,
  `signUpWithPassword`, `signInWithGoogle`, `signOut`,
  `requestPasswordReset`, `updatePassword`, `resendVerificationEmail`
  (esta última no se pedía en el `acceptance` del feature_list pero sí
  en la spec/design — bien resuelto).
- ✅ Validación zod en cada action (`signInSchema`, `signUpSchema`,
  `updatePasswordSchema`, `requestResetSchema`).
- ✅ Retorno discriminado `AuthResult = AuthSuccess | AuthFailure`.
- ✅ Errores mapeados vía `mapSupabaseError` → catálogo cerrado
  `AuthErrorCode`. **Nunca** se devuelve `err.message` crudo (revisado
  línea por línea en `errors.ts:77-116`).
- ✅ `signUpWithPassword` no loguea al usuario; retorna
  `{ ok: true, data: { email } }` para que el caller redirija a
  `/auth/verify-email`. Detección extra de email duplicado vía
  `identities: []` — buena defensa contra el modo silencioso de Supabase.
- ✅ `redirect()` de Next nunca envuelto en try/catch (verificado con
  grep: 0 try/catch en `actions.ts` ni en los route handlers).
- ✅ `signOut({ scope: 'local' })` + `redirect('/login')`.
- ✅ `requestPasswordReset` siempre devuelve `ok: true` salvo
  `rate_limited`. Anti-enumeración correctamente implementado
  (`actions.ts:182-191`).

**Route handlers:**

- ✅ `/auth/callback` (`callback/route.ts`): `exchangeCodeForSession`,
  lee `next` con `safeNextPath`, redirige por rol (`profile.role ?? 'user'`)
  o respeta `next`. En errores redirige a `/login?error=<code>`.
- ✅ `/auth/reset` (`reset/route.ts`): exchange + redirect a
  `/auth/reset/new`. Fallback `/login?error=reset_token_invalid` si falla.

**Helpers:**

- ✅ `getRedirectPathForRole`: `admin → /admin`,
  `agent|broker → /dashboard`, `user|null|undefined → /` (default del
  switch). Cubre los 4 valores del enum (`user`, `agent`, `broker`,
  `admin`) según `src/types/database.ts:524`.
- ✅ `safeNextPath`: implementa los 6 checks documentados — empieza por
  `/`, no `//`, no `/auth/`, sin `\r`/`\n`, longitud ≤512, y guard
  `typeof === 'string'`.
- ✅ `getSiteUrl`: precedencia `NEXT_PUBLIC_SITE_URL` →
  `NEXT_PUBLIC_VERCEL_URL` → `http://localhost:3000`. Strip de trailing
  slash.

**`middleware.ts`:**

- ✅ En la **raíz** del repo (no en `src/`).
- ✅ Importa y delega a `updateSession` de `src/lib/supabase/proxy.ts`.
- ✅ `config.matcher` excluye `_next/static`, `_next/image`,
  `favicon.ico`, `robots.txt`, `sitemap.xml` y assets estáticos comunes
  (svg/png/jpg/jpeg/gif/webp/ico/css/js/woff/woff2).

**`verify-email/page.tsx`:**

- ✅ Si llega con sesión activa, redirige según rol (`page.tsx:27-34`).
- ✅ `ResendButton` con cooldown 60s implementado vía `useState` +
  `setTimeout` + `useTransition`.

**`reset/new/page.tsx`:**

- ✅ Server Component verifica sesión activa antes de renderizar
  (`page.tsx:13-20` → `redirect('/login?error=reset_token_invalid')` si
  no hay user).
- ✅ Client form (`NewPasswordForm.tsx`) llama a `updatePassword` vía
  `useActionState`.

### Calidad de código — ✅

- ✅ Cero `console.log`, `TODO`, `FIXME`. Único `console.error` en
  `errors.ts:114` para el caso `unknown` — justificado y documentado en la
  spec ("nunca en client", "trazabilidad de errores inesperados").
- ✅ Sin `any` en `src/lib/auth/` (grep limpio).
- ✅ Tipos exportados claros: `AuthErrorCode`, `AuthError`, `AuthResult`,
  `AuthSuccess`, `AuthFailure`, tipos zod inferidos (`SignInInput`, etc.).
- ✅ Errores de Supabase mapeados consistentemente, ninguno se traga
  silenciosamente: o se mapea, o cae a `'unknown'` con log server-side.
- ✅ `'use server'` + `export type` coexisten porque los tipos se eliden
  en compilación; el build de Next 16 lo confirma.

### Acceptance del `feature_list.json` — ✅ los 10

1. ✅ `src/lib/auth/actions.ts` con las Server Actions tipadas (las 7
   pedidas: signIn, signUp, signInWithGoogle, signOut,
   requestPasswordReset, updatePassword, + extra resendVerificationEmail).
2. ✅ `src/app/auth/callback/route.ts` maneja code exchange OAuth +
   confirmación de email (handler único que discrimina por presencia de
   `code` y `error`).
3. ✅ `src/app/auth/reset/route.ts` recibe el token y redirige a
   `/auth/reset/new`.
4. ✅ Validación con zod en cada action (email format, password ≥8 chars
   con letra+número, `confirmPassword` coincide en signup/update).
5. ✅ Errores como `{ ok: false, error: { code, message } }`, sin filtrar
   detalles internos (catálogo cerrado).
6. ✅ Helper `getRedirectPathForRole` en `src/lib/auth/redirect.ts`.
7. ✅ Post-login: cookies vía `createServerClient` (en el helper
   `server.ts`) + `redirect()` según rol en `signInWithPassword` y en
   `/auth/callback`.
8. ✅ Signup con verificación obligatoria: action no inicia sesión,
   devuelve `{ ok: true, data: { email } }` para que el caller redirija
   a `/auth/verify-email?email=...`. Pantalla intermedia implementada.
9. ✅ `middleware.ts` raíz que invoca `updateSession`.
10. ⏳ Test manual con curl/seed users — **no ejecutable end-to-end sin
    `login_screen`** (feature `pending` que depende de ésta).
    **Mitigación**: build verde + revisión de código + verificación
    aislada de helpers. El test manual completo se hará al cerrar
    `login_screen`.

El criterio 10 es el único parcial, pero **es esperado y está
documentado**: el implementer lo deja explícito en
`implementation.md:214-219` y la spec en `design.md:217-219` también
lo prevé ("El reviewer puede aceptar esta feature verificando la lógica
server-side por inspección de código"). Lo acepto como **aprobado con
observación** — la feature aún se considera APPROVED.

---

## Issues encontrados

Ninguno bloqueante.

---

## Observaciones (no bloqueantes)

1. **`.gitignore` se modificó pese a que el implementer reportó no
   tocarlo.** El reporte (`implementation.md:233-236`) dice "este
   implementer no toca `.gitignore` sin instrucción explícita", pero
   `git diff .gitignore` muestra que sí añadió `!.env.example*`. El
   cambio en sí es razonable (permite commit del `.env.example`), pero
   discrepa con lo que dice el reporte. No bloqueante; comentar al
   implementer en próximas sesiones para que el reporte coincida con la
   realidad.

2. **`exchangeCodeForSession` puede estar deprecated/renombrado en
   nuevas versiones de `@supabase/ssr`.** El método se llama así en
   Supabase JS v2 estable, pero conviene verificar en runtime cuando se
   prueben los flujos OAuth/reset de punta a punta. Si rompe, plan B
   documentado en design.md (refactor a `setSession`/`verifyOtp` según
   corresponda).

3. **El `acceptance` del `feature_list.json` no menciona
   `resendVerificationEmail`** pero la spec sí. El implementer hizo lo
   correcto siguiendo la spec. Sugiero al leader sincronizar el
   `acceptance` del feature_list o aceptar que la spec es más detallada
   (es lo natural). No requiere cambio en este merge.

4. **Pantalla `/auth/verify-email` con sesión activa redirige por rol,
   sin distinguir `recovery` vs `signed-in` normal.** Si un user que
   hizo reset-password navega manualmente a `/auth/verify-email`, podría
   redirigirse a su home antes de actualizar el password. La spec lo
   acepta como riesgo bajo (sección "Riesgos #7"). No bloquea ahora.

5. **`signInWithGoogle`: nada se verifica sobre la URL de Google que
   Supabase devuelve.** Es URL externa controlada por Supabase, así
   que no hay riesgo de open-redirect real (no proviene del cliente).
   Buena confianza en el SDK; lo dejo anotado.

6. **`useActionState` vs `useTransition` en `ResendButton`.** Decisión
   técnica razonable y documentada (`implementation.md:96-100`). Mantengo.

---

## Resultado de comandos

- `pnpm lint`: ✅ OK (sin warnings, `--max-warnings=0`).
- `pnpm type-check`: ✅ OK (`tsc --noEmit`).
- `pnpm build`: ✅ OK. Las 4 rutas auth aparecen como dinámicas (`ƒ`):
  `/auth/callback`, `/auth/reset`, `/auth/reset/new`, `/auth/verify-email`.
  Middleware registrado como `ƒ Proxy (Middleware)`.
- `./init.sh full`: ✅ verde end-to-end.
- `grep -rnE '#[0-9A-Fa-f]{3,8}' src/lib/auth src/app/auth middleware.ts`:
  ✅ vacío (cero hex literales).
- `grep 'console\.log\|TODO\|FIXME'` en auth: ✅ vacío.
- `grep 'any\b'` en `src/lib/auth/`: ✅ vacío.
- `grep 'try\s*{\|catch\s*('` en actions/route handlers: ✅ vacío (no
  envuelve `redirect()`).
- `grep 'createClient\b'` en auth: ✅ 100% desde `@/lib/supabase/server`.

---

## Conclusión

La capa de auth está implementada con calidad: catálogo de errores
cerrado, anti-enumeración en reset, anti open-redirect en `next`,
mensajes server-side derivados, RLS respetada (sólo `select role` de
profiles, que ya tiene política `authenticated`), Server Actions con
validación zod estricta, middleware raíz refrescando sesión.

El test manual end-to-end queda pendiente hasta `login_screen`. La
feature puede marcarse `done` por el leader cuando se cierre con commit;
si en el test manual posterior aparece algún issue, se abre una feature
de fix.
