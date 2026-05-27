# Review — feature change_email_flow

**Veredicto:** APPROVED

## Resumen

Implementación fiel al spec aprobado de 1146 líneas. Las 4 desviaciones
documentadas en `progress/current.md` son razonadas, mínimas y no rompen
ningún acceptance criteria. Cero hex en JSX, RLS y seguridad correctas,
patrón de focus-trap consistente con `InviteUserDialog`, migración con el
mismo molde de 0023/0024/0026.

## Checklist

- Tokens y colores: [x] — cero hex literales en los 7 archivos modificados/creados. Todos los colores via tokens (`bg-primary-soft`, `text-danger`, `bg-danger-soft`, `border-divider-soft`, `bg-on-surface/40`, `text-muted`, `bg-surface`, etc.).
- Componentes y framework: [x] — Server Components por defecto (`page.tsx`, `SettingsPanel`, `route.ts`). `"use client"` justificado en los 3 client comps (`ChangeEmailDialog`: focus-trap + state + useTransition; `EmailFieldWithChangeButton`: state local del open; `EmailChangedFlash`: state + router.replace + useEffect). `await searchParams` correcto en `page.tsx:50`. Sin deps nuevas.
- Supabase: [x] — helpers `createClient` de `@/lib/supabase/server` en action y route handler. `service_role` no aparece en código. Mutación `auth.updateUser` y `signInWithPassword` dentro de Server Action (`'use server'`). Trigger 0027 con `SECURITY DEFINER` + `set search_path = public` + REVOKE EXECUTE a `public`/`anon`/`authenticated` (patrón 0024/0026). Backfill incluido al final. Idempotencia con `where email is distinct from new.email`.
- Fidelidad visual: [x] — feature sin mockup propio (declarado en spec §2). Modal sigue el patrón de `InviteUserDialog`/`FiltersModal` ya en el repo (bottom-sheet en `<md`, centrado en `md+`, overlay `bg-on-surface/40 backdrop-blur-sm`). Bloque success usa `mark_email_unread` en chip `bg-primary-soft` rounded-full según §14. Botón "Cambiar" en `EmailFieldWithChangeButton` con copy y disabled-state según §7.
- Calidad: [x] — sin `console.log` debug; los `console.warn` de la action y del route handler loguean solo `error.code` y `error.status` (cumple AC14: nunca email/password en logs). Textos en español en todos los strings de UI. Schemas zod en `src/lib/profile/schemas.ts` reutilizando `emailSchema` + `loginPasswordSchema`. (Lint/type-check/build confirmados por implementer; no se re-ejecutaron en review por instrucción.)

## Desviaciones del spec — evaluadas

1. **Codes `invalid_password` / `email_in_use` / `rate_limit`** (en vez de `invalid_credentials` / `email_taken` / `rate_limited` del spec §3 D4): **aprobada**. El `acceptance` del `feature_list.json` literal menciona `email_in_use, invalid_password`, así que el implementer eligió alinearse con el contrato del backlog en lugar del catálogo del spec. La función `mapSupabaseError` sigue devolviendo los códigos canónicos del catálogo `AuthErrorCode`; el remapeo a `ChangeEmailErrorCode` ocurre inline tras el `mapped.code`, sin tocar `lib/auth/errors.ts`. Coherente con la decisión §4 (inline, no promover al catálogo global).
2. **Componente extra `EmailFieldWithChangeButton`**: **aprobada**. Aísla la frontera `"use client"` y deja `SettingsPanel` como Server Component puro. Reduce JS bundle. No fue listado en spec §4 pero es la implementación más correcta.
3. **Input "Correo actual" `readOnly` + `tabIndex={-1}`**: **aprobada**. Cumple AC de A11y del spec §21 (focus inicial en "Correo nuevo", que es el primer editable). El `tabIndex={-1}` es defensivo para que el focus-trap no lo incluya en la rotación.
4. **`setTimeout(fn, 0)` en `EmailChangedFlash:69-72`**: **aprobada**. Mismo patrón documentado en `AuthErrorHashListener.tsx:67-72` para evitar `react-hooks/set-state-in-effect`. Citado correctamente en el comentario.

## Validaciones puntuales

- **AC1-AC2**: botón "Cambiar" en `SettingsPanel` ya no está disabled cuando `canChangeEmail`. Modal abre con form (`ChangeEmailDialog`). ✓
- **AC3**: `changeEmail(formData)` en `src/lib/profile/actions.ts:247` valida zod, re-autentica con `signInWithPassword`, llama `updateUser({ email })`. ✓
- **AC4**: route handler `/auth/email-change/route.ts` hace `exchangeCodeForSession` y redirige a `/profile?tab=settings&email_changed=<flag>`. ✓
- **AC5**: errores en español; nunca se devuelve `err.message` crudo (siempre del catálogo). ✓
- **AC6**: action no toca `profiles.email` ni `revalidatePath`. Email viejo sigue activo hasta confirmar. ✓
- **AC7**: copy explícito "Recibirás un link de confirmación en tu correo nuevo y otro en tu correo actual..." (`ChangeEmailDialog.tsx:204-205`). ✓
- **AC8**: tras `ok: true`, el form se reemplaza por `<SuccessBlock>` con ambos emails mencionados. ✓
- **AC9 (oauth-only)**: `canChangeEmail` calculado en `page.tsx:65` desde `user.identities`. Botón disabled con tooltip + helper text en `EmailFieldWithChangeButton:67-78`. Action devuelve `oauth_only` defense-in-depth (`actions.ts:275-285`). ✓
- **AC10**: action no invoca `revalidatePath` ni `redirect`. ✓
- **AC11**: handler distingue `pending` (cuando `user.new_email` aún presente) vs `1` (completado) via cast defensivo. ✓
- **AC12**: `EmailChangedFlash` muestra toast 6s y limpia query param via `router.replace('/profile?tab=settings')`. ✓
- **AC13 (same_email case-insensitive)**: `actions.ts:288-298` baja a `toLowerCase` ambos. ✓
- **AC14 (no PII en logs)**: solo `error.code` y `error.status` en los 2 `console.warn`. ✓
- **AC15 (migración 0027)**: presente, aplicada, backfill, idempotente. ✓

## Notas no-bloqueantes para futuras iteraciones

- El cast defensivo `(user as { new_email?: string | null } | null)?.new_email` en `route.ts:61` queda como deuda menor: cuando `@supabase/supabase-js` exponga el campo en tipos, conviene removerlo.
- El comentario de `EmailChangedFlash:68` cita `AuthErrorHashListener` como "mismo patrón usado en NotificationsDropdown/NotifBell"; la referencia es correcta indirectamente (AuthErrorHashListener ya cita esa cadena). OK.
- El spec §10 deuda 1 (extraer primitivo `<Modal>`) sigue abierta; este PR no la cierra (acordado).
- El handler `/auth/email-change` no es ruta privada (vive bajo `/auth/`), así que no requiere agregar a `protectedPaths`. Correcto.

## Cambios requeridos

Ninguno. Se aprueba el merge.
