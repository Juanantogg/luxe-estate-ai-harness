# Design spec — change_email_flow

> Feature `requires_approval: true`. Toca auth, hay race condition entre
> email viejo y nuevo, y necesita un route handler nuevo. Esta spec se
> abre a aprobación humana antes de cerrar al implementer.

---

## 1. Resumen

Hoy en `/profile?tab=settings` el botón **"Cambiar"** del email queda
**disabled** con tooltip "Próximamente" (ver
`src/components/profile/SettingsPanel.tsx:49-58`). Esta feature lo
materializa: al clickear se abre un **modal** con un form (email nuevo

- password actual para re-autenticar). Al enviar, una Server Action
  nueva `changeEmail` re-autentica con `signInWithPassword(emailViejo,
password)` y luego llama a `supabase.auth.updateUser({ email })`.
  Supabase envía un link de confirmación al email nuevo y mantiene el
  viejo activo hasta que el user clickea ese link. Un route handler
  nuevo en `/auth/email-change` hace el code-exchange y devuelve al
  user a `/profile?tab=settings&email_changed=1` con un toast de éxito
  (reusando el primitivo `Toast` introducido por `invite_error_landing`).

Se hace ahora porque `user_profile_screen` se cerró dejando esta deuda
explícita y porque el primitivo `Toast` ya está disponible.

---

## 2. Referencia visual

- Mockup contexto: `docs/designs/user_profile_screen/screen.png`
  (panel "Account Preferences" abajo a la izquierda).
- HTML contexto: `docs/designs/user_profile_screen/code.html`
  (bloque del input email).
- **No hay mockup propio del modal.** Esta feature inventa el panel,
  pero respetando 100% el sistema de tokens (`docs/design-system.md`)
  y el patrón de modales existente (focus-trap propio, sin Radix,
  sin `<dialog>` nativo — ver `FiltersModal.tsx` y `InviteUserDialog.tsx`).

---

## 3. Decisiones cerradas

### D1 — Modal con focus-trap propio, NO panel inline. CERRADA por la designer.

Razón: el resto del repo usa modales custom con focus-trap propio para
flujos que requieren confirmación (FiltersModal, InviteUserDialog,
ChangeRoleConfirmDialog, ProfileAvatarEditor). Inline en la tab
Settings dispersaría la atención del user y obligaría a re-layout del
grid de 2 columnas; modal es coherente con el patrón existente.

**No hay primitivo `Modal` reusable**. Se copia el patrón de
`InviteUserDialog.tsx` (el más cercano: form simple, focus inicial en
el input clave, auto-cierre tras éxito) y se queda como deuda menor
extraer un primitivo si emerge el 4° o 5° call site. **No** se incluye
extracción de `Modal` primitivo en este PR — fuera de scope.

### D2 — Re-autenticación: `signInWithPassword(emailViejo, password)`. CERRADA por la designer.

Supabase Auth **no expone** un endpoint `reauthenticate(password)` para
sesiones email/password. Las opciones reales son:

1. **`signInWithPassword({ email: emailViejo, password })`**: si vuelve
   `ok`, validamos identidad. Se invoca dentro del Server Action,
   nunca desde el client.
2. `supabase.auth.reauthenticate()`: solo aplica al flujo de cambio de
   password con `MFA` activado; no sirve acá (es OTP por email, lo
   que duplicaría el problema que tratamos de evitar).
3. Llamar directo a `updateUser({ email })` sin re-auth: deja la
   superficie abierta a "session hijacking" — si alguien capturó la
   sesión, puede secuestrar la cuenta cambiando el email.

**Decisión**: opción 1. Trade-off documentado:

- **Pros**: usa una API estable, no requiere SMTP extra, valida la
  contraseña actual sin reset.
- **Contras**: si el usuario tiene rate-limit hit en login (5 intentos
  fallidos / 5 min según Supabase Cloud defaults), también lo tiene
  acá. Se mapea el `code: 'rate_limited'` al copy correspondiente.
- **OAuth-only users**: si el user se registró vía Google y NUNCA seteó
  password, `signInWithPassword` devuelve `invalid_credentials`. Para
  el MVP **no soportamos cambio de email a users OAuth-only**: el
  botón "Cambiar" se renderiza disabled con tooltip explicativo en ese
  caso. La detección server-side se hace leyendo
  `user.identities.some(i => i.provider === 'email')` en el `page.tsx`
  del perfil y se pasa el flag a `SettingsPanel`. Documentado como
  riesgo R3 y deuda en §10.

### D3 — Race condition email viejo / nuevo. CERRADA por la designer.

Comportamiento default de Supabase Auth Cloud (verificado en docs
oficiales 2026): cuando se llama `updateUser({ email: nuevo })`:

- Si la opción `Secure email change` está **ON** (default en Supabase
  Cloud 2024+): Supabase manda **dos** emails:
  1. Al email **viejo** con link `/auth/v1/verify?type=email_change_current`
     que confirma desde el lado original.
  2. Al email **nuevo** con link `/auth/v1/verify?type=email_change_new`
     que confirma desde el lado nuevo.
     El email solo se cambia cuando **ambos** se confirman.
- Si está **OFF**: solo se manda al email nuevo. Un link basta.

**Decisión**: asumimos el default Supabase Cloud (`Secure email change
= ON`). El copy del modal y del toast indican explícitamente que
"recibirás un link en tu correo nuevo y otro en tu correo actual,
debes confirmar **ambos**". El route handler `/auth/email-change`
trata ambos casos de la misma forma (basta con el `code` exchange para
cerrar el flujo); Supabase internamente sabe cuál falta confirmar y
recién dispara el cambio cuando completa la pareja.

**No** se intenta detectar/forzar el toggle de "Secure email change"
desde el código: es config del dashboard. Documentado como riesgo R1.

**Mientras tanto**:

- `auth.users.email` sigue siendo el viejo.
- `profiles.email` (mirror manejado por `handle_new_user` y trigger
  `on_auth_user_updated_email` — verificar existencia, si no existe es
  deuda diferida) sigue siendo el viejo.
- La sesión del user sigue activa. Puede seguir usando la app
  normalmente con el email viejo.

**Por qué no actualizamos `profiles.email` optimistamente**: el flujo
puede no completarse (user nunca clickea, link expira, otro user ya
reclamó ese email entre el send y el confirm). Si actualizamos
`profiles.email` y luego el cambio falla, queda inconsistencia.
Esperamos a la confirmación.

**Sincronización de `profiles.email` post-confirmación**:
verificación previa requerida en `src/types/database.ts` y revisar
si existe trigger `on_auth_user_updated_email` que mantenga
`profiles.email` en sync. Si **no existe**, esta feature **debe**
agregar migración `0027_profiles_sync_on_email_update.sql` con
trigger `AFTER UPDATE OF email ON auth.users` que haga
`UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id`,
`SECURITY DEFINER`, `SET search_path = public`, mismo patrón que
0023/0026. **Punto abierto para el implementer**: verificar primero
con MCP (`list_tables` + `execute_sql` para ver triggers de
`auth.users`) y, si no existe, escribir la migración como parte del
PR.

### D4 — Manejo de errores: catálogo cerrado en español. CERRADA por la designer.

Reusamos el patrón `AuthError { code, message }` existente
(`src/lib/auth/errors.ts`). Códigos nuevos específicos de esta
feature:

| Código (nuevo o reusado)        | Cuándo se devuelve                                                                                 | Mensaje en español                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `invalid_input` (reusado)       | zod falla (email malformado, password vacío, mismo email que el actual)                            | "Revisa los campos marcados."                                                                     |
| `invalid_credentials` (reusado) | `signInWithPassword(emailViejo, password)` devuelve `invalid_credentials`                          | "Contraseña incorrecta."                                                                          |
| `email_taken` (reusado)         | `updateUser({ email })` devuelve `email_exists` / `user_already_exists`                            | "Ya existe una cuenta con ese correo. Elige otro."                                                |
| `same_email` (**nuevo**)        | El email nuevo coincide con el actual (case-insensitive). Validación zod local + chequeo en action | "El correo nuevo debe ser distinto al actual."                                                    |
| `rate_limited` (reusado)        | 429 desde Supabase (re-auth o updateUser)                                                          | "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."                                  |
| `session_missing` (reusado)     | `getUser()` devuelve null en la action (sesión expiró)                                             | "Tu sesión expiró. Vuelve a iniciar sesión."                                                      |
| `oauth_only` (**nuevo**)        | El user no tiene identity `email` (registro vía Google sin password)                               | "Tu cuenta usa inicio de sesión con Google. No es posible cambiar el correo desde acá por ahora." |
| `unknown` (reusado)             | Cualquier otro error inesperado                                                                    | "Algo salió mal. Inténtalo de nuevo."                                                             |

**Por qué `same_email` como código nuevo**: es una validación específica
de este flujo. Se chequea **dos veces** (defense-in-depth):

1. **Client** antes de habilitar el botón submit (lint visual del
   form). No bloquea el envío para que el error UX llegue por la action.
2. **Server** en zod refinement con comparación case-insensitive y
   trim. Si llega al server con same email, devolvemos `same_email`.

**Por qué `oauth_only` como código nuevo**: se mapea a un caso muy
específico de UX (botón disabled + tooltip + retornar `oauth_only` si
de alguna manera el form llegara a submit). Sin código propio, el
mensaje genérico confunde al user.

**Errores que se silencian (no se exponen)**:

- Supabase devuelve `email_address_invalid` (formato): se mapea a
  `invalid_input` con mensaje "Correo inválido."
- Supabase devuelve `email_change_token_already_used`: se mapea a
  `unknown` en el route handler (no en la action; pasa al confirmar el
  link, no al solicitar) — el handler redirige a `/profile?tab=settings&email_changed=error&code=link_used`.

### D5 — Copy del modal y del toast. CERRADA por la designer.

Listado completo en §7. El usuario lo aprueba como contrato literal.

### D6 — Sin email-pre-existente check antes del updateUser. CERRADA por la designer.

No se hace un `select * from profiles where email = ?` previo. Razón:

1. **Enumeración**: el caller (admin o user) podría usar este endpoint
   para descubrir si un email existe en la base.
2. **Race**: entre el check y el `updateUser`, otro user podría tomarlo.
3. **Supabase ya valida**: devuelve `email_exists` si el email está
   tomado en `auth.users`. Lo mapeamos a `email_taken`.

### D7 — Ubicación de la Server Action y del route handler. CERRADA por la designer.

- Server Action `changeEmail`: **en `src/lib/profile/actions.ts`**
  (no en `src/lib/auth/actions.ts`). Razón: el call site es el panel
  de **perfil**, no el flujo de auth. `src/lib/auth/actions.ts` se
  reserva para acciones que pueden invocarse SIN sesión activa
  (login/signup/reset). Esta acción exige sesión.
- Tipos/schemas: `src/lib/profile/schemas.ts` agrega
  `changeEmailSchema` (zod).
- Route handler: `src/app/auth/email-change/route.ts`. Coherente con
  `auth/callback/route.ts`, `auth/reset/route.ts`, `auth/verify-email/`.
- Toast de éxito post-confirmación: se renderiza en el panel
  `SettingsPanel` (Server Component) cuando detecta
  `searchParams.email_changed === '1'`. Por ser SC, no podemos usar
  `useState` para abrir el `Toast`. **Decisión**: agregar un Client
  Component chico `EmailChangedFlash` que recibe el flag como prop y
  monta `<Toast variant="success" message="..." />` con
  `useState(open=true)` inicial. Mismo patrón que
  `AuthErrorHashListener`. Vive en `src/components/profile/`.

---

## 4. Componentes nuevos / modificados

### Archivos a crear

| Archivo                                                      | Tipo             | Responsabilidad                                                                                              |
| ------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/components/profile/ChangeEmailDialog.tsx`               | Client Component | Modal con form (email nuevo + password actual). Reproduce el patrón de `InviteUserDialog.tsx`.               |
| `src/components/profile/EmailChangedFlash.tsx`               | Client Component | Lee prop `kind: 'success' \| 'error' \| null` y renderiza `<Toast>` correspondiente con auto-dismiss 6s.     |
| `src/app/auth/email-change/route.ts`                         | Route handler    | `GET` que recibe `?code=...&type=email_change`, hace `exchangeCodeForSession`, redirige al perfil con flash. |
| `progress/change_email_flow/design.md`                       | spec             | Este archivo.                                                                                                |
| `supabase/migrations/0027_profiles_sync_on_email_update.sql` | migración        | **Solo si** verificación previa muestra que el trigger no existe. Ver §3 D3.                                 |

### Archivos a modificar

| Archivo                                    | Cambio                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/profile/SettingsPanel.tsx` | (a) recibe nueva prop `canChangeEmail: boolean`; (b) reemplaza el `<button disabled>` por uno que abre el dialog (si `canChangeEmail`) o queda disabled con tooltip "Tu cuenta usa Google; no es posible cambiar el correo desde acá" (si !canChangeEmail). |
| `src/components/profile/index.ts`          | Exportar `ChangeEmailDialog`, `EmailChangedFlash`.                                                                                                                                                                                                          |
| `src/lib/profile/actions.ts`               | Agregar `changeEmail(formData): Promise<ChangeEmailResult>`. **No** tocar `uploadAvatar` ni `removeAvatar`.                                                                                                                                                 |
| `src/lib/profile/schemas.ts`               | Agregar `changeEmailSchema` (zod object con `email`, `password`, `currentEmail` y `.refine` para `same_email`). **No** tocar `avatarFileSchema`.                                                                                                            |
| `src/app/(app)/profile/page.tsx`           | (a) Calcular `canChangeEmail` desde `user.identities` (con guard a `null`); (b) leer `searchParams.email_changed` y pasarlo a `EmailChangedFlash`; (c) pasar `canChangeEmail` a `SettingsPanel`.                                                            |

### Archivos que **NO** se tocan

- `CLAUDE.md`, `AGENTS.md`, `.claude/`, `feature_list.json` (gestión
  del leader).
- `src/lib/auth/actions.ts` (la action vive en profile).
- `src/lib/auth/errors.ts` — los códigos nuevos `same_email` y
  `oauth_only` se agregan **inline** en la action como `AuthError`
  pero **no** se incorporan al union `AuthErrorCode`. Trade-off: el
  type queda menos estricto pero `src/lib/auth/errors.ts` no se ensucia
  con códigos de profile. Si emerge un 2° uso, se promueve. **Punto
  abierto menor para el implementer/reviewer**: si prefieren type-strict,
  ampliar `AuthErrorCode` con los 2 códigos nuevos y agregar al
  catálogo `MESSAGES`. Recomendación de la designer: dejar inline en la
  action.
- `src/components/ui/` (el primitivo `Toast` ya existe).

---

## 5. Server Action `changeEmail`

### Firma

```ts
// src/lib/profile/actions.ts

export type ChangeEmailErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_taken'
  | 'same_email'
  | 'rate_limited'
  | 'session_missing'
  | 'oauth_only'
  | 'unknown';

export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; error: { code: ChangeEmailErrorCode; message: string } };

export async function changeEmail(formData: FormData): Promise<ChangeEmailResult>;
```

### Shape del FormData

| Key        | Tipo     | Requerido | Notas                                                               |
| ---------- | -------- | --------- | ------------------------------------------------------------------- |
| `email`    | `string` | sí        | Email nuevo. Validado por `emailSchema` reutilizado de auth.        |
| `password` | `string` | sí        | Password actual del user. Validado solo presencia (no complejidad). |

**No** se incluye `currentEmail` en el FormData: lo lee la action
server-side de `auth.getUser()`. Eso evita spoofing y simplifica el form.

### Validación zod (`src/lib/profile/schemas.ts`)

```ts
import { z } from 'zod';
import { emailSchema, loginPasswordSchema } from '@/lib/auth/schemas';

export const changeEmailSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
```

El check `same_email` **no** va en el schema (necesita comparar contra
la sesión, que solo se obtiene en la action). Se hace inline en la
action después de leer `user.email`.

### Pasos internos (pseudocódigo)

```ts
'use server';

export async function changeEmail(formData: FormData): Promise<ChangeEmailResult> {
  // 1. Validar form con zod
  const parsed = changeEmailSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid_input', message: firstZodError(parsed.error) } };
  }

  // 2. Leer user actual
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'session_missing', message: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
    };
  }

  // 3. Validar oauth-only (defense-in-depth: el botón ya está disabled,
  //    pero alguien podría POSTear el form directamente)
  const hasEmailIdentity = user.identities?.some((i) => i.provider === 'email') ?? false;
  if (!hasEmailIdentity) {
    return {
      ok: false,
      error: {
        code: 'oauth_only',
        message:
          'Tu cuenta usa inicio de sesión con Google. No es posible cambiar el correo desde acá por ahora.',
      },
    };
  }

  // 4. Validar same_email
  const currentEmail = (user.email ?? '').toLowerCase();
  const newEmail = parsed.data.email.toLowerCase();
  if (currentEmail === newEmail) {
    return {
      ok: false,
      error: { code: 'same_email', message: 'El correo nuevo debe ser distinto al actual.' },
    };
  }

  // 5. Re-autenticar con email viejo + password
  //    IMPORTANTE: usar el mismo `supabase` cliente. signInWithPassword
  //    NO debería invalidar la sesión actual si las credenciales son
  //    correctas (solo "renueva" el JWT). VERIFICAR en smoke test que
  //    tras éxito el user sigue logueado en la página /profile.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: parsed.data.password,
  });
  if (signInError) {
    const mapped = mapSupabaseError(signInError);
    // Solo nos interesan invalid_credentials y rate_limited acá.
    // Cualquier otro lo tratamos como unknown.
    if (mapped.code === 'invalid_credentials') {
      return {
        ok: false,
        error: { code: 'invalid_credentials', message: 'Contraseña incorrecta.' },
      };
    }
    if (mapped.code === 'rate_limited') {
      return {
        ok: false,
        error: {
          code: 'rate_limited',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
      };
    }
    console.warn('[changeEmail] re-auth failed unexpectedly', signInError);
    return {
      ok: false,
      error: { code: 'unknown', message: 'Algo salió mal. Inténtalo de nuevo.' },
    };
  }

  // 6. updateUser({ email })
  //    Supabase manda email(s) de confirmación automáticamente.
  //    `emailRedirectTo` debe apuntar al route handler nuevo.
  const { error: updateError } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${getSiteUrl()}/auth/email-change` },
  );
  if (updateError) {
    const mapped = mapSupabaseError(updateError);
    if (mapped.code === 'email_taken') {
      return {
        ok: false,
        error: { code: 'email_taken', message: 'Ya existe una cuenta con ese correo. Elige otro.' },
      };
    }
    if (mapped.code === 'rate_limited') {
      return {
        ok: false,
        error: {
          code: 'rate_limited',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
      };
    }
    console.warn('[changeEmail] updateUser failed unexpectedly', updateError);
    return {
      ok: false,
      error: { code: 'unknown', message: 'Algo salió mal. Inténtalo de nuevo.' },
    };
  }

  // 7. NO revalidamos /profile todavía: el email no cambió aún. Solo
  //    cambia cuando el user clickea el(los) link(s) del correo.
  return { ok: true };
}
```

### Notas críticas

- **No** se invoca `revalidatePath('/profile')` ni `revalidatePath('/')`
  tras `ok: true`. El email todavía no cambió.
- **No** se invoca `redirect()` desde la action. El client maneja
  el cierre del modal y muestra el mensaje "Revisá tu correo nuevo (X)..."
  inline (NO toast — el toast es para el flash post-confirmación, no
  para el submit del modal).
- **Logging**: cualquier `console.warn` que loguee error de Supabase
  NO incluye `parsed.data.email` ni `password`. Solo `error.code` y
  `error.status`. Evita PII en logs.

---

## 6. Route handler `/auth/email-change/route.ts`

### Qué params recibe

Supabase, tras confirmar el link, redirige al `emailRedirectTo` que le
pasamos en `updateUser`. La URL tiene la forma:

```
GET /auth/email-change?code=<recovery-token>&type=email_change
```

`code` siempre presente en éxito. `type` puede ser `email_change` (default
Supabase Cloud); no lo usamos para nada — el `code` exchange basta.

En error, Supabase **no** redirige al `emailRedirectTo`: redirige a
`SITE_URL` raíz con el error en el **URL fragment**:

```
http://localhost:3000/#error=access_denied&error_code=otp_expired&...
```

Ese caso lo cubre `AuthErrorHashListener` (feature `invite_error_landing`).
No es responsabilidad de este handler.

### Qué hace

```ts
// src/app/auth/email-change/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing del link de confirmación de cambio de email.
 *
 * Flujo:
 *  - Recibe `?code=<token>`.
 *  - Hace `exchangeCodeForSession` para que Supabase aplique el cambio
 *    y refresque la sesión con el email nuevo.
 *  - En éxito → redirect a `/profile?tab=settings&email_changed=1`.
 *  - En fallo → redirect a `/profile?tab=settings&email_changed=error`.
 *
 * NOTA "Secure email change": si el toggle está ON (default Cloud), el
 * cambio se aplica solo cuando AMBOS links (viejo y nuevo) fueron
 * confirmados. El `exchangeCodeForSession` del primer link igualmente
 * devuelve `ok` (registra la confirmación en auth.users.email_change_*).
 * El segundo link cierra el cambio. Cualquiera de los dos termina acá.
 *
 * El usuario verá el toast de éxito tras confirmar AMBOS links, pero
 * también tras confirmar solo UNO (el primero). Es deliberado: el copy
 * del toast usa "Revisá tu otro correo para terminar el cambio" si la
 * action detecta que el email viejo aún figura en `auth.users.email`,
 * o "Correo actualizado" si el email ya es el nuevo. Ver §7 copy.
 *
 * Para detectar cuál es el caso, el handler lee `user.email` tras el
 * exchange y pasa `email_changed=pending` (aún viejo) o
 * `email_changed=1` (ya nuevo) en el query param.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  // Defensa: si Supabase mandó error en query (raro, generalmente va en fragment).
  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn('[email-change] exchange failed', { code: error.code, status: error.status });
    return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=error`);
  }

  // Detectar si el cambio ya se completó (secure email change ON requiere
  // ambos links). Si user.email_change_sent_at sigue presente, falta el otro.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // user.new_email es el campo que Supabase mantiene hasta completar el cambio.
  // Si está presente, falta confirmar el otro lado.
  const stillPending =
    user &&
    typeof (user as { new_email?: string }).new_email === 'string' &&
    (user as { new_email?: string }).new_email !== null;

  const flag = stillPending ? 'pending' : '1';
  return NextResponse.redirect(`${origin}/profile?tab=settings&email_changed=${flag}`);
}
```

### Notas

- **No** se valida que haya sesión previa al exchange: el
  `exchangeCodeForSession` la crea/refresca por sí mismo. Si el user
  no estaba logueado, queda logueado tras el exchange.
- El handler **no** llama a `redirect()` de Next; usa `NextResponse.redirect`
  con `origin` absoluto. Patrón coherente con `auth/callback/route.ts`
  y `auth/reset/route.ts`.
- **Defensa contra inyección de query param**: el flag de query solo
  puede ser `1`, `pending` o `error`. El cliente (`page.tsx`) lo parsea
  con un union estricto, y `EmailChangedFlash` muestra copy adecuado
  o `null` si el valor no matchea.

---

## 7. Copy en español (literal)

### Botón "Cambiar" en `SettingsPanel`

Estado **habilitado** (`canChangeEmail === true`):

- Texto: `Cambiar`
- `aria-label`: `Cambiar dirección de correo`
- Hover/focus: estilo `text-primary hover:underline` (mismo que un
  link textual; matches mockup).

Estado **disabled** (`canChangeEmail === false`, OAuth-only):

- Texto: `Cambiar`
- `disabled`, `aria-disabled="true"`
- `title`: `Tu cuenta usa Google; no es posible cambiar el correo desde acá por ahora.`
- `aria-label`: `Cambiar dirección de correo (no disponible para cuentas de Google)`

Helper text bajo el field (mantiene el actual hasta que la feature
materialice, luego se reemplaza):

- Si `canChangeEmail === true`: **se quita** el helper actual
  ("El cambio de email estará disponible próximamente.").
- Si `canChangeEmail === false`: helper queda como
  `Para cambiar el correo de una cuenta de Google, inicia sesión con Google y actualízalo desde tu cuenta.` (texto nuevo).

### Modal `ChangeEmailDialog`

- **Título** (`<h2 id="...">`): `Cambiar dirección de correo`
- **Descripción superior** (`<p>` sub-título): `Recibirás un link de confirmación en tu correo nuevo y otro en tu correo actual. Hasta que confirmes ambos, tu correo seguirá siendo el actual.`
- **Label "correo actual"** (campo readonly informativo, NO editable, NO en FormData): `Correo actual`
  - Value: `user.email`
- **Label "correo nuevo"**: `Correo nuevo`
- **Placeholder**: `tu-nuevo-correo@ejemplo.com`
- **Helper text** (debajo): `Debe ser distinto al correo actual.`
- **Label "contraseña"**: `Contraseña actual`
- **Placeholder**: `Tu contraseña`
- **Helper text** (debajo): `Confirmamos tu identidad antes de enviar los links.`
- **Botón submit (idle)**: `Enviar links de confirmación`
- **Botón submit (loading)**: `Enviando…`
- **Botón cancelar**: `Cancelar`
- **Botón close (X esquina sup-der)**: `aria-label="Cerrar"`

### Mensaje post-submit exitoso (inline en el modal, NO toast)

Sustituye el form por un bloque centrado:

- **Ícono**: `mark_email_unread` (Material), `text-primary`, `size lg`.
- **Título** (`<h3>`): `Revisa tu correo nuevo`
- **Cuerpo**: `Te enviamos un link de confirmación a {emailNuevo}. También enviamos uno a tu correo actual ({emailViejo}). Tu correo cambiará cuando confirmes ambos.`
- **Sub-cuerpo (más chico)**: `Mientras tanto, tu correo actual sigue siendo válido para iniciar sesión.`
- **Botón** (único, `variant="ghost"`): `Cerrar`
- Tras 8s sin acción, el modal se auto-cierra (no crítico, solo UX).
  Si el user lo cierra antes con X / Cancel / Escape, también ok.

### Errores inline en el modal

Bajo el form (encima del botón submit):

- Banner `bg-danger-soft text-danger rounded p-3 text-sm` con
  `role="alert" aria-live="assertive"`.
- Mensaje según `error.code`: usa el catálogo de §3 D4 literal.
- El banner desaparece cuando el user edita cualquier campo
  (`setError(null)` en `onChange`).

### Toast post-confirmación (flash, vía `EmailChangedFlash`)

Disparado por `?email_changed=1|pending|error`:

| flag      | variant | message                                                                                                     |
| --------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `1`       | success | `Correo actualizado correctamente.`                                                                         |
| `pending` | warning | `Confirmaste un link. Revisa tu otro correo para terminar de cambiar el email.`                             |
| `error`   | warning | `No pudimos confirmar el cambio. El link puede haber expirado o ya fue usado. Intenta solicitar uno nuevo.` |

`autoDismissMs: 6000` para los 3.

Tras el toast, `EmailChangedFlash` hace `router.replace('/profile?tab=settings')`
para limpiar el query param de la URL. **Decisión**: usamos `router.replace`
(Next), NO `history.replaceState`, porque queremos que React refresque
los Server Components que dependen de `searchParams` y, en el caso
`pending → 1`, futuras navegaciones reflejen el nuevo email en el
header del perfil. `router.replace` no agrega entry al history stack.

---

## 8. Estados de UI (modal)

### `idle`

- Form vacío (email + password vacíos).
- Botón submit `disabled` hasta que ambos campos tengan al menos 1 char
  (UX rápida; la validación dura ocurre en zod).
- Sin banner de error.

### `loading`

- `Button` con `loading` prop (spinner integrado).
- `disabled` en todos los inputs (`<fieldset disabled>` wrapper).
- Botones cancel + close también disabled (evita race del cierre vs submit).

### `success`

- Form se reemplaza por el bloque "Revisa tu correo nuevo" (ver §7).
- Auto-cierre del modal a los 8s.
- Mientras el modal está en `success`, ESC y click-outside lo cierran
  normalmente (no quedamos atrapados).

### `error`

- Form vuelve a `idle` editable.
- Banner de error visible con el message correspondiente.
- Botón submit habilitado.

### Estados de la pantalla (post-confirmación)

- **`searchParams.email_changed === '1'`**: render normal del perfil
  con `<EmailChangedFlash kind="success" />`.
- **`'pending'`**: idem con `kind="pending"`.
- **`'error'`**: idem con `kind="error"`.
- **null / cualquier otro valor**: `<EmailChangedFlash kind={null} />`
  (que devuelve `null` sin renderizar el toast).

---

## 9. Acceptance criteria (del `feature_list.json` + agregados de la designer)

Copiados literal del backlog:

- [ ] **AC1**: Botón 'Cambiar' en `/profile?tab=settings` deja de estar
      disabled (cuando `canChangeEmail === true`).
- [ ] **AC2**: Modal o panel con form: nuevo email + password actual
      para confirmar identidad.
- [ ] **AC3**: Server Action `changeEmail(formData)` en
      `src/lib/profile/actions.ts`: valida zod, re-autentica con
      password, llama `supabase.auth.updateUser({ email })`.
- [ ] **AC4**: Route handler `src/app/auth/email-change/route.ts` maneja
      el code exchange del email nuevo y redirige a
      `/profile?tab=settings&email_changed=1` con flash toast.
- [ ] **AC5**: Errores devueltos en español sin exponer detalles
      internos (`email_in_use`, `invalid_password`, etc.).
- [ ] **AC6**: Email viejo permanece activo hasta que el user clickea el
      link del email nuevo (comportamiento default de Supabase).
- [ ] **AC7**: Copy explícito en el modal indicando que ambos correos
      deben confirmarse.
- [ ] **AC8**: Tras submit exitoso: cerrar modal (con el bloque "Revisa
      tu correo") y NO tocar profile.email todavía.

Agregados por la designer:

- [ ] **AC9**: Si el user es OAuth-only (sin identity `email`), el
      botón "Cambiar" queda disabled con tooltip y helper text
      específico (§7). La action devuelve `oauth_only` si igualmente se
      POSTea el form.
- [ ] **AC10**: La acción **no** revalida `/profile` ni invoca
      `redirect()`. Solo el route handler dispara la revalidación
      implícita vía redirect.
- [ ] **AC11**: Si Supabase Cloud tiene "Secure email change" ON
      (default), el handler distingue caso `pending` (falta confirmar
      el otro link) vs caso `1` (cambio completado) y pasa el flag
      correspondiente al query param.
- [ ] **AC12**: `EmailChangedFlash` muestra el toast adecuado según
      flag, lo auto-dismissea a 6s y limpia el query param vía
      `router.replace`.
- [ ] **AC13**: Defense-in-depth: `same_email` validado en server
      (case-insensitive) además del lint client.
- [ ] **AC14**: No se loguean email ni password en `console.warn`. Solo
      `error.code` / `error.status` de Supabase.
- [ ] **AC15**: Si verificación previa muestra que **no existe** trigger
      `AFTER UPDATE OF email ON auth.users` que sincronice
      `profiles.email`, se agrega migración 0027 con dicho trigger.

---

## 10. Riesgos y mitigaciones

### R1 — "Secure email change" puede estar OFF en el proyecto Supabase

**Descripción**: si el dashboard de Supabase tiene
"Secure email change" en OFF, solo se manda **un** email (al nuevo).
El copy del modal y el de `EmailChangedFlash` quedan desactualizados
(mencionan "ambos correos").

**Mitigación**:

1. **Verificación previa** (responsabilidad del implementer, ANTES de
   codear el copy): abrir Supabase Dashboard → Auth → Email Templates
   → "Confirm Change of Email" → verificar setting "Secure email change".
2. Si está **ON** (esperado): copy actual aplica.
3. Si está **OFF**: cambiar el copy a singular ("Te enviamos un link de
   confirmación a tu correo nuevo. Hasta que lo confirmes, tu correo
   actual seguirá siendo válido.") y eliminar el flag `pending` (el
   handler siempre redirige a `email_changed=1`).
4. **Punto abierto para el humano**: confirmar antes de aprobar que el
   setting está en ON. Si no, decidir si lo cambiamos en el dashboard
   (recomendado) o si adaptamos el copy.

### R2 — Race "email nuevo tomado entre send y confirm"

**Descripción**: user A pide cambiar al email `x@y.com`. Supabase
envía links. Antes de A confirmar, user B se registra con `x@y.com`
(o lo cambia su email también a `x@y.com`).

**Mitigación**: Supabase rechaza el `exchangeCodeForSession` con error
en ese caso (el token se vincula al claim del email destino, que ya no
está libre). El handler captura el error y redirige a
`?email_changed=error` con copy "El link puede haber expirado o el
correo ya fue tomado".

### R3 — OAuth-only users no pueden cambiar email

**Descripción**: usuarios que se registraron con Google y nunca setearon
password no pueden re-autenticarse con `signInWithPassword`.

**Mitigación**:

1. Botón "Cambiar" disabled visualmente con tooltip claro.
2. Defense-in-depth server-side: action devuelve `oauth_only`.
3. **Deuda documentada**: solucionable en futuras iteraciones con:
   - Magic link de re-auth, o
   - Forzar al user a setear password antes (link a `/auth/reset/new`).
   - **No** se aborda en este PR.

### R4 — Link expirado / ya usado

**Descripción**: el user no clickea el link en X horas (Supabase
default 24h) o lo clickea dos veces.

**Mitigación**:

- Link expirado o consumido: Supabase responde con error en el fragment
  (URL hash), no en el query. El handler `/auth/email-change` no se
  ejecuta. El user aterriza en `/` con el toast que dispara
  `AuthErrorHashListener` (feature `invite_error_landing`). Copy de
  `otp_expired` ya cubre: "El link de invitación expiró...". El copy
  actual menciona "invitación" pero **el user entiende que es un link
  expirado**. **Punto abierto menor**: si querés que el copy
  diferencie email-change vs invite, el implementer puede extender el
  mapeo en `AuthErrorHashListener.tsx` agregando una nueva clave
  derivable (p. ej. detectar `referrer` o un query param que el handler
  setee). Recomendación designer: dejar el copy genérico actual; el
  user entiende y la heurística agrega complejidad.

### R5 — User cierra el modal antes de submit

**Descripción**: trivial. El form se descarta (estado local del
componente), no se envió nada al server.

**Mitigación**: ninguna especial. El user re-abre el modal y empieza
de nuevo.

### R6 — User cierra el modal **durante** el submit

**Descripción**: durante el `loading` (action corriendo), si el user
hace click en Cancel/Close/Escape, la action sigue ejecutando en el
server pero el componente se desmonta. Si la action tiene éxito, no hay
quién muestre el bloque "Revisa tu correo".

**Mitigación**: durante `loading`, los botones Cancel/Close y la tecla
Escape están deshabilitados (mismo patrón que `InviteUserDialog`).
Sí, esto bloquea el cierre por algunos segundos. Aceptable.

### R7 — Rate limit de Supabase para email-change

**Descripción**: Supabase Cloud Free permite ~3-4 emails/hora. Si el
user spammea "Cambiar email" varias veces, hit 429.

**Mitigación**:

- `mapSupabaseError` ya cubre `over_email_send_rate_limit` → `rate_limited`.
- Copy: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
- **No** se implementa cooldown local en el botón (a diferencia de
  `ResendButton` que tiene 60s). Razón: cambio de email es operación
  rara; un cooldown agregaría complejidad sin valor. Si emerge problema
  real, se agrega después.

### R8 — La sesión actual se rompe tras `signInWithPassword` durante la action

**Descripción**: hipotético. Llamar `signInWithPassword` dentro de una
action de un user que YA tiene sesión podría rotar el JWT y, en
casos borde de cookies, invalidar la sesión.

**Mitigación**: smoke test §11.5 verifica que tras submit (ok o error)
el user sigue viendo `/profile` sin bounce a `/login`.
**Plan B si emerge el problema**: usar `supabase.auth.verifyOtp` o
intentar `signInWithPassword` en un cliente Supabase **separado**
(instancia anónima) que no comparta cookies con la sesión actual.
Punto abierto si el smoke test falla.

### R9 — Trigger de sync `auth.users.email → profiles.email` puede no existir

**Descripción**: tras confirmar el cambio, `auth.users.email` cambia
pero si no hay trigger, `profiles.email` se queda con el viejo.
Resultado: `SettingsPanel` muestra el email viejo hasta que algún
otro flujo refresque `profiles.email`.

**Mitigación**: AC15. Verificación previa requerida + migración si
falta. Patrón ya usado: 0023 (`handle_new_user` sincroniza al insert),
0026 (`profiles_sync_on_invite_update` para `invited_at`). Esta sería
0027 análoga para email.

---

## 11. Criterios de aceptación verificables (para reviewer / humano)

- [ ] **CA1**: Modal abre al clickear "Cambiar" (cuando habilitado).
      Form muestra: correo actual (readonly), correo nuevo (editable),
      contraseña actual (editable), sub-título con copy de §7.
- [ ] **CA2**: Submit con email malformado → banner inline "Revisa los
      campos marcados."
- [ ] **CA3**: Submit con email igual al actual (mismo case) → banner
      inline "El correo nuevo debe ser distinto al actual."
- [ ] **CA4**: Submit con email igual al actual variando solo case
      (`Hola@x.com` vs `hola@x.com`) → mismo error que CA3.
- [ ] **CA5**: Submit con password incorrecto → banner "Contraseña
      incorrecta."
- [ ] **CA6**: Submit con email ya registrado en `auth.users` → banner
      "Ya existe una cuenta con ese correo. Elige otro."
- [ ] **CA7**: Submit OK → form se reemplaza por bloque "Revisa tu
      correo nuevo" con los dos emails mencionados en el copy.
- [ ] **CA8**: Mientras submit corre (`loading`), Cancel/Close/Escape
      están deshabilitados.
- [ ] **CA9**: User OAuth-only ve el botón "Cambiar" disabled con
      tooltip y helper text de §7.
- [ ] **CA10**: Tras submit OK, **no** se observa redirect en la action
      (la página `/profile` no se navega; el modal pasa al estado
      success in-place).
- [ ] **CA11**: Click en el link del email nuevo → aterriza en
      `/profile?tab=settings&email_changed=1` (o `pending` si secure
      email change ON) → toast del color y copy correctos (§7) →
      query param limpio tras el toast.
- [ ] **CA12**: Click en link expirado → aterriza en `/` con toast
      warning del listener (feature `invite_error_landing`).
- [ ] **CA13**: Tras confirmar **ambos** links (secure email change
      ON), `auth.users.email` actualizado a nuevo y `profiles.email`
      sincronizado (verificar via SQL MCP).
- [ ] **CA14**: Logs server NO contienen email ni password en claro.
- [ ] **CA15**: `init.sh full` OK (lint + type-check + build).

---

## 12. Smoke tests propuestos

Para agregar a `progress/smoke-tests.md` (sección
`change_email_flow`) cuando reviewer apruebe.

### A. Modal y validación cliente

- [ ] Login como `elena@luxe-estate.test` (user con identity email) →
      `/profile?tab=settings` → botón "Cambiar" visible y enabled.
- [ ] Click "Cambiar" → modal abre con correo actual prellenado en
      readonly, otros campos vacíos.
- [ ] Submit con email malformado (`foo`) → banner "Revisa los campos
      marcados.", el banner desaparece al editar el campo.
- [ ] Submit con email igual al actual → banner `same_email`.
- [ ] Submit con email mismo case-different (mayúsculas) → banner
      `same_email`.
- [ ] Submit con password vacío → banner "La contraseña es obligatoria."
      (de `loginPasswordSchema`).

### B. Server Action

- [ ] Submit con password incorrecto → banner "Contraseña incorrecta."
- [ ] Submit con email de otro user del seed (ej.
      `marcus@luxe-estate.test`) → banner "Ya existe una cuenta con
      ese correo. Elige otro."
- [ ] Submit OK con email nuevo (yopmail nuevo) → form se reemplaza por
      bloque "Revisa tu correo nuevo" con los dos emails listados.
- [ ] Tras OK, **la sesión sigue activa**: navegar a `/` y volver a
      `/profile` sin bounce a `/login`. (Cubre R8.)
- [ ] Tras OK, `auth.users.email` SIGUE siendo el viejo (verificar SQL
      vía MCP). `profiles.email` también.
- [ ] Spam: clickear submit 5+ veces seguidas (los reintentos solo
      ocurren si los anteriores fallaron) → eventual 429 → banner
      `rate_limited`.

### C. Race y cierre del modal

- [ ] Cancel/Close/Escape durante `loading` → no cierra el modal hasta
      que la action termine.
- [ ] Cancel/Escape en `success` → modal cierra normalmente.
- [ ] Auto-cierre del modal a los 8s en `success` (esperar sin
      interacción).

### D. Route handler y flash

- [ ] Clickear el link del email **nuevo** (yopmail) → aterriza en
      `/profile?tab=settings&email_changed=pending` (si secure email
      change ON) → toast warning "Confirmaste un link..." → tras 6s,
      query param limpio.
- [ ] Clickear el link del email **viejo** (cualquier alias del user
      original) → idem, otro toast `pending`.
- [ ] Tras AMBOS clicks: refresh `/profile` → ver email **nuevo** en
      el field readonly. `auth.users.email` y `profiles.email`
      coinciden con el nuevo (SQL).
- [ ] El segundo de los dos clicks aterriza en
      `?email_changed=1` → toast success "Correo actualizado
      correctamente."

### E. Error y casos negativos del handler

- [ ] Esperar 24h con un link sin clickear → click → aterriza en `/`
      con toast del listener (feature `invite_error_landing`), no en
      `/profile?tab=settings`.
- [ ] Clickear un link y luego clickearlo de nuevo (ya consumido) →
      handler captura el error → `/profile?tab=settings&email_changed=error`
      → toast warning "No pudimos confirmar el cambio..."

### F. OAuth-only

- [ ] Login con Google con una cuenta nueva que NUNCA tuvo password →
      `/profile?tab=settings` → botón "Cambiar" disabled con tooltip y
      helper text de §7.
- [ ] (Defense) Inspeccionar el botón en DevTools, removerle `disabled`
      manualmente y submit con cualquier email/password → action devuelve
      `oauth_only` → banner "Tu cuenta usa inicio de sesión con Google..."

### G. Login con email nuevo

- [ ] Tras confirmar ambos links, logout y login con el email nuevo +
      misma contraseña → entra al perfil con sesión válida.
- [ ] Logout y intentar login con el email viejo → error "Email o
      contraseña incorrectos."

---

## 13. Notas técnicas adicionales

- **`emailRedirectTo` en `updateUser`**: Supabase docs aclaran que
  `updateUser({ email }, { emailRedirectTo })` lo soporta desde
  `@supabase/supabase-js` v2.39+. Verificar versión en
  `pnpm-lock.yaml` antes de codear (debería ser v2.x reciente; el
  proyecto ya usa esa firma con `signUp` en `signUpWithPassword`).
- **`user.identities`** está disponible en `auth.getUser()` desde la
  versión `@supabase/supabase-js` v2.x. Tipos en `User` de
  `@supabase/supabase-js`. No requiere RPC custom.
- **`user.new_email`**: campo no documentado oficialmente. La verificación
  defensiva en el handler usa `(user as { new_email?: string }).new_email`
  con type-cast porque los tipos de `@supabase/supabase-js` no lo
  exponen aún. **Punto abierto**: si el campo no está presente en runtime
  (porque Supabase Cloud cambió el contrato), el handler asume
  `stillPending = false` y siempre redirige a `=1`. El user verá un
  toast success aunque falte el otro lado — UX subóptima pero no
  destructiva. Smoke test §12 D detecta el problema.
- **`Inter` ya cargada globalmente**: no se carga ninguna fuente nueva.

---

## 14. Tokens a usar

Todos verificados en `src/app/globals.css`:

- Fondo modal: `bg-surface`, borde `border-divider-soft`,
  `rounded-lg` (mismo que `InviteUserDialog`).
- Overlay: `bg-on-surface/40 backdrop-blur-sm` (patrón de
  `FiltersModal`).
- Texto título: `text-on-surface font-semibold text-2xl tracking-tight`.
- Texto sub: `text-sm text-muted`.
- Labels: `text-sm font-medium text-on-surface` (consistente con `Input`).
- Inputs: usar primitivo `<Input>` con `leadingIcon="mail"` y
  `leadingIcon="lock"` respectivamente.
- Banner error: `bg-danger-soft text-danger rounded p-3 text-sm`.
- Bloque success: ícono `mark_email_unread` `text-primary`, fondo
  `bg-primary-soft` rounded-full chip; `text-on-surface font-bold` para
  título; `text-muted text-sm` para cuerpos.
- Botón primario: `<Button variant="primary" size="lg">`.
- Botón cancelar: `<Button variant="ghost">`.
- Botón close (X): `<IconButton icon="close" variant="ghost" size="sm">`.
- Toast: primitivo `<Toast>` ya existente, variants `success`/`warning`
  según flag.

**Cero hex literales.** Spec respeta el sistema de tokens.

---

## 15. Tipografía

Inter en todos los pesos cargados. Usos específicos:

- Título modal `<h2>`: `text-2xl font-semibold` → `headline-2` (24/600).
- Sub-título: `text-sm` → `body` (14/400).
- Labels: `text-sm font-medium` → `body` weight 500.
- Bloque success título: `text-xl font-bold` → `headline-3` (20/700).
- Banner error: `text-sm` → `body`.
- Botón close (X): icono Material; aria-label visible para AT.

---

## 16. Datos

### Tablas consumidas

| Tabla        | Operación                                                                | Notas                                                                                                       |
| ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `auth.users` | Lectura (`auth.getUser`) en action y handler; `updateUser` en action.    | RLS no aplica (es schema de Supabase Auth).                                                                 |
| `profiles`   | Lectura existente desde `page.tsx`; **escritura SOLO vía trigger** (R9). | Si AC15 obliga migración, el trigger usa `SECURITY DEFINER` + `SET search_path = public`. Patrón 0023/0026. |

### Server vs Client

- **Server Components** (sin `'use client'`): `page.tsx`, `SettingsPanel`.
- **Client Components** (`'use client'`): `ChangeEmailDialog`,
  `EmailChangedFlash`.
- **Server Action**: `changeEmail` (`'use server'`).
- **Route handler**: `/auth/email-change/route.ts` (server).

Justificación cliente:

- `ChangeEmailDialog`: focus-trap, scroll-lock, ESC listener, state
  local del form (`useState`), `useTransition` para loading.
- `EmailChangedFlash`: state local para `open`, `useEffect` para
  auto-dismiss + `router.replace` post-dismiss.

---

## 17. Interactividad

| Elemento                  | Tipo   | Detalle                                                                            |
| ------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Botón "Cambiar"           | client | `onClick={() => setDialogOpen(true)}` en `SettingsPanel`.                          |
| `ChangeEmailDialog`       | client | Form controlado; `useTransition` para `changeEmail` action.                        |
| Cancel / Close / Escape   | client | Cierran modal si no está `loading`; resetean state.                                |
| Submit                    | client | Llama `changeEmail(formData)`; muta state local según `result.ok`.                 |
| Auto-cierre `success` 8s  | client | `useEffect` con `setTimeout` + cleanup.                                            |
| `EmailChangedFlash` mount | client | Lee prop `kind`, abre `<Toast>` con `useState(true)`; al cerrar, `router.replace`. |
| Route handler GET         | server | Exchange code, redirect con query.                                                 |

---

## 18. Dependencias y deuda

### Dependencias inmediatas (esta feature las consume)

- `user_profile_screen` (done) — pantalla `/profile` y `SettingsPanel`.
- `auth_layer` (done) — patrón `AuthError`, helpers `getSiteUrl`,
  `createClient`, `mapSupabaseError`.
- `invite_error_landing` (done) — primitivo `<Toast>` reusable.

### Deuda nueva que esta feature deja abierta

1. **Modal primitivo**: el 4° call site de modal custom queda como
   señal para extraer un `<Modal>` primitivo (junto con `InviteUserDialog`,
   `ChangeRoleConfirmDialog`, `FiltersModal`). No se aborda en este PR.
2. **OAuth-only email change**: no implementado. Futura iteración con
   magic-link de re-auth o flujo "set password primero".
3. **Cooldown local del botón submit**: no implementado (rare op).
4. **i18n del toast del listener `AuthErrorHashListener`**: el copy
   genérico para link expirado dice "invitación", no "cambio de
   email". Aceptable; mejora futura opcional.
5. **`AuthErrorCode`** unión NO extendida con `same_email` /
   `oauth_only`. Si emerge un 2° call site, promover los códigos al
   catálogo global.

---

## 19. Alternativas consideradas

### Modal vs panel inline expandible

- **Opción A (elegida): Modal con focus-trap propio.**
  - Pros: coherente con el resto del repo, foco claro, no rompe el
    grid de Settings.
  - Contras: 100+ líneas de boilerplate de focus-trap (mitigado
    copiando de `InviteUserDialog`).
- **Opción B: Panel inline expandible debajo del field email.**
  - Pros: menos boilerplate, no requiere foco-trap.
  - Contras: rompe el layout del grid de 2 columnas en mobile (push
    del toggle de notificaciones para abajo es feo); falta enfocar
    atención del user que está cambiando algo sensible.
- **Recomendación**: A.

### Re-autenticación: signInWithPassword vs magic-link

- **Opción A (elegida): `signInWithPassword(emailViejo, password)`.**
  - Pros: 1 round-trip, sin email extra, validación inmediata.
  - Contras: no funciona para OAuth-only (R3).
- **Opción B: Magic link al email viejo + click → updateUser.**
  - Pros: funciona para OAuth-only.
  - Contras: dos pasos asincrónicos, copy más complejo, 2 emails
    automáticos (más rate-limit), UX más lenta.
- **Recomendación**: A para el MVP. B como deuda para OAuth-only.

### Action en `lib/profile/` vs `lib/auth/`

- **Opción A (elegida): `src/lib/profile/actions.ts`.**
  - Pros: call site es el panel de perfil, exige sesión.
  - Contras: el archivo `actions.ts` de profile crece a 3 actions.
- **Opción B: `src/lib/auth/actions.ts`.**
  - Pros: agrupa todo lo de "auth".
  - Contras: ese archivo se reserva para actions invocables sin sesión
    (login/signup/reset). Cambio de email exige sesión.
- **Recomendación**: A.

### Toast post-confirmación como `EmailChangedFlash` Client vs Server Component

- **Opción A (elegida): Client Component que abre `<Toast>` con state.**
  - Pros: usa el primitivo `Toast` existente sin tocar; auto-dismiss y
    `router.replace` post-cierre.
  - Contras: 1 archivo client extra.
- **Opción B: Server Component que renderiza el banner inline.**
  - Pros: 0 JS.
  - Contras: no es un toast; ocupa espacio en el layout; sin auto-dismiss;
    sin limpieza del query param.
- **Recomendación**: A.

---

## 20. Abierto para humano (decisiones pre-aprobación)

1. **Estado de "Secure email change" en Supabase Cloud (R1)**: por
   default está ON. Confirmar que en este proyecto sigue ON. Si está
   OFF, ajustar copy (§7) y eliminar flag `pending` (§6). Esta es la
   única decisión que afecta el contrato visible al user antes de
   codear.
2. **Migración 0027 (R9 / AC15)**: ¿existe trigger
   `AFTER UPDATE OF email ON auth.users` que sincronice
   `profiles.email`? El implementer debe verificar primero con MCP. Si
   no existe, agrega la migración. Si el humano prefiere diferir la
   sincronización a una feature aparte, queda explícito como deuda
   (con riesgo: el `SettingsPanel` mostraría el email viejo hasta otro
   refresh).
3. **Cooldown del botón submit**: no incluido. Si querés cooldown de
   60s tras OK (como `ResendButton`), avisame antes de aprobar.
4. **Copy del flash `pending`**: "Confirmaste un link. Revisa tu otro
   correo..." — si querés un copy diferente, especifícalo.
5. **`AuthErrorCode` global vs codes inline**: la designer recomienda
   inline (§4 último bullet). Si preferís type-strict global, avisame.

---

## 21. Notas finales / A11y

- **A11y**:
  - Modal: `role="dialog" aria-modal="true" aria-labelledby` con el
    `<h2>` título.
  - Focus inicial: en el input "Correo nuevo" (es el primer campo
    editable; el "Correo actual" es readonly).
  - Focus restaurado al botón "Cambiar" al cerrar.
  - Banner error: `role="alert" aria-live="assertive"`.
  - Botón close: `aria-label="Cerrar"`.
  - Inputs: labels asociados explícitamente con `htmlFor`/`id`.
  - Helper text bajo el field email asociado vía `aria-describedby`.
- **Contraste**: tokens del sistema garantizan AA en todos los pares
  bg/text usados.
- **Mobile-first**: el modal es bottom-sheet en `<md` y dialog
  centrado en `md+` (igual que `FiltersModal`). Ancho:
  `w-full md:max-w-md`.
- **Sin dependencias nuevas.** Solo React + Next + Supabase + zod
  (todas ya instaladas).
