# Review — invite_error_landing

**Veredicto**: APPROVED
**Fecha**: 2026-05-27

## Acceptance criteria (spec §2, líneas 36-66)

- ✅ AC1 — Existe `src/components/ui/Toast.tsx` Client Component primitivo
  con variants `success | warning | danger`, API controlada por props,
  sin provider. Exportado en `src/components/ui/index.ts:28-29`.
  Verificado: `src/components/ui/Toast.tsx:1` (`'use client'`),
  `:7` (`ToastVariant`), `:9-33` (`ToastProps`), `:90` (función `Toast`).

- ✅ AC2 — Existe `src/components/auth/AuthErrorHashListener.tsx` Client
  Component que se monta solo en `/` (montado en
  `src/app/(app)/page.tsx:192`) y lee `window.location.hash` desde
  `useEffect` (`src/components/auth/AuthErrorHashListener.tsx:57-74`),
  con guard SSR en `:58` (`typeof window === 'undefined'`).

- ✅ AC3 — Mapea `otp_expired`, `access_denied` y fallback `unknown` en
  `src/components/auth/AuthErrorHashListener.tsx:16-21` con copy exacto
  al de la tabla §4 del spec (verificado palabra a palabra).

- ✅ AC4 — Muestra el toast con `variant="warning"` y `autoDismissMs=6000`
  (`AUTO_DISMISS_MS = 6000` en `:14`, pasado en `:85`).

- ✅ AC5 — Tras detectar error, ejecuta
  `window.history.replaceState(null, '', cleanUrl)` en
  `AuthErrorHashListener.tsx:65-66`. **Importante**: el `replaceState` corre
  ANTES del `setTimeout(setError, 0)` en `:72`, por lo que la URL ya está
  limpia cuando React reacciona — el back-button (smoke test 9) sigue
  funcionando como se esperaba.

- ✅ AC6 — Componente no afecta la home cuando no hay hash de error: el
  guard en `parseHash` retorna `null` para hash vacío (`:24`), hash sin
  `error=` (`:26`), y deja el componente con `error === null`, lo que
  pasa `open={false}` al `Toast`, que devuelve `null` (`Toast.tsx:116`).

- ✅ AC7 — Montado sin Suspense al final del JSX:
  `src/app/(app)/page.tsx:192` (`<AuthErrorHashListener />` justo antes
  del cierre del root `<div>`).

- ✅ AC8 — `VisitScheduler` migrado con `variant="success"`,
  `autoDismissMs={0}`, `dismissible={false}`, message `"Visita confirmada."`
  (`src/components/visits/VisitScheduler.tsx:216-223`). El redirect a
  `/profile?tab=visits` a 600ms se conserva intacto (`:149-152`). Import
  de `Icon` removido (línea 6: solo `Button, Toast`).

- ✅ AC9 — `ResendInvitationButton` migrado con variant condicional
  (`feedback.kind === 'error' ? 'danger' : 'success'`),
  `autoDismissMs={feedback.kind === 'error' ? 0 : 4000}`
  (`src/components/admin/ResendInvitationButton.tsx:76-82`). El
  `setTimeout(4000)` interno **fue eliminado** (no aparece en el archivo;
  el handler `handleClick` `:39-49` no programa cierres). El JSDoc
  obsoleto "no hay sistema global de toast" **fue eliminado** (`:18-30`
  documenta el nuevo flujo). Botón sigue `disabled={isPending ||
feedback.kind === 'success'}` (`:66`).

- ✅ AC10 — Smoke tests §7 ejecutables: las 3 variants del primitivo
  están renderizadas en `/dev/ui` vía `ToastShowcase.tsx`, ambos call
  sites migrados verificados, copy exacto.

## Reglas duras del repo

- ✅ **Cero hex literales en JSX**: `grep -nE '#[0-9a-fA-F]{3,8}'` sobre
  los 9 archivos tocados devuelve 0 matches.
- ✅ **`'use client'` solo donde corresponde**:
  - `Toast.tsx:1` SÍ (usa `useEffect`).
  - `AuthErrorHashListener.tsx:1` SÍ (usa `useEffect` + `useState` + `window`).
  - `ToastShowcase.tsx:1` SÍ (usa `useState`).
  - `src/components/auth/index.ts` NO (barrel puro, exports re-export
    Client Component sin estado propio — patrón seguro).
  - `src/components/ui/index.ts` NO (barrel).
  - `src/app/(app)/page.tsx` NO (Server Component que importa el listener
    Client — patrón válido en Next 16).
  - `src/app/dev/ui/page.tsx` NO (Server; delega a `ToastShowcase` Client).
  - El bug "use client exports" (documentado en memoria) NO se repite:
    los barrels no tienen `'use client'` y no exportan hooks/helpers que
    forzarían serialización.
- ✅ **Mobile-first**: `Toast.tsx:128` usa
  `max-w-[calc(100%-2rem)] sm:max-w-md` — móvil con 16px de margen, luego
  cap a `md` en `sm+`.
- ✅ **Textos en español**: todos los strings de UI están en español
  (verificado en mapa COPY del listener, mensaje del VisitScheduler,
  copy del ResendInvitationButton, label "Cerrar aviso" del primitivo).
- ✅ **Sin dependencias nuevas**: `git diff package.json` está vacío.
- ✅ **Server Action / Supabase**: la feature no toca tablas ni acciones.
  Las migraciones de call sites no cambian las acciones existentes.

## Primitivo Toast — checks §A del spec

- ✅ **API exacta** (§A.1): `open`, `onClose`, `variant`, `message`,
  `autoDismissMs?`, `dismissible?`, `icon?` — todos presentes con los
  mismos tipos y orden (`Toast.tsx:9-33`).
- ✅ **Defaults** (§A.4): `autoDismissMs = 4000` (`:95`),
  `dismissible = true` (`:96`).
- ✅ **Tokens por variant** (§A.2): mapa `VARIANT_STYLES` en `:44-69`
  coincide línea por línea con la tabla del spec (success →
  `bg-success-soft`, `text-success`, `focus-visible:ring-success`,
  `check_circle`; warning → `bg-warning-soft`/`text-warning`/`warning`;
  danger → `bg-danger-soft`/`text-danger`/`error`).
- ✅ **A11y por variant** (§A.5): success/warning con `role="status" +
aria-live="polite"`; danger con `role="alert" + aria-live="assertive"`
  (`Toast.tsx:50-51, 58-59, 66-67`). Botón close con
  `aria-label="Cerrar aviso"` (`:139`).
- ✅ **Escape handling** (§A.6): registrado solo si `open && dismissible`
  (`Toast.tsx:107-114`); cleanup en return (`:113`).
- ✅ **Dimensiones / posición hardcoded** (§A.7): `fixed bottom-20 left-1/2
z-50 -translate-x-1/2` + `max-w-[calc(100%-2rem)] sm:max-w-md`
  (`Toast.tsx:126-128`).
- ✅ **Auto-dismiss con cleanup** (§A.8): `setTimeout` retornado con
  `clearTimeout` en cleanup (`Toast.tsx:102-103`). Cuando cambia `open`
  o `autoDismissMs`, el effect se re-corre y el timeout anterior se limpia.

## Migraciones

### VisitScheduler (`src/components/visits/VisitScheduler.tsx`)

- ✅ Toast props correctos (variant `success`, message `"Visita confirmada."`,
  `autoDismissMs={0}`, `dismissible={false}`) en `:216-223`.
- ✅ Redirect a `/profile?tab=visits` a 600ms intacto (`:149-152`).
- ✅ Import de `Icon` eliminado (`:6` solo `Button, Toast`).
- ✅ Estado `toastVisible` bool conservado; `setToastVisible(false)` en
  `onClose` defensivo conforme al spec §B.1.
- ✅ Patrón del error message inline (`:186-190`) se conserva — el spec
  solo migra el toast de éxito.

### ResendInvitationButton (`src/components/admin/ResendInvitationButton.tsx`)

- ✅ Toast con variant/message/autoDismissMs condicionales según `feedback.kind`
  (`:76-82`).
- ✅ `setTimeout(4000)` interno previo **eliminado** — el handler
  `handleClick` solo hace setFeedback (`:39-49`), sin timers internos.
- ✅ JSDoc obsoleto eliminado y reescrito (`:18-30`) — ya no menciona "no
  hay sistema global".
- ✅ Wrapper `<div>` perdió `gap-1.5` (`:60` es solo `flex flex-col
items-stretch md:items-end`) conforme spec §B.2.
- ✅ Botón sigue `disabled={isPending || feedback.kind === 'success'}`
  (`:66`).
- ✅ `<>` fragment envuelve `<div>` (botón) + `<Toast>` (flotante), no
  rompe el layout de la fila.

### ToastShowcase (`src/app/dev/ui/ToastShowcase.tsx`)

- ✅ Las 3 variants se renderizan vía `VARIANTS.map` (`:45, 59-61`).
- ✅ Botón Reset funcional (`:27-29`) — `disabled` mientras `open`, abre
  el toast al click.
- ✅ Decisión justificada: `page.tsx` es Server Component (sin `'use
client'`), no puede tener `useState`. Extraer un wrapper Client local
  (`ToastShowcase.tsx`) es la opción canónica y respeta el patrón.

## Edge cases verificados (leyendo código)

- ✅ **R3 §8 (Strict Mode doble montaje)**: el segundo mount del effect
  encuentra `window.location.hash === ''` (porque el primer mount ya hizo
  `replaceState`), `parseHash` devuelve `null` (`:24`), `useEffect` retorna
  sin tocar estado. Idempotente.
- ✅ **R5 §5 (mensaje vacío cuando error===null)**: el listener pasa
  `message={error?.message ?? ''}` (`:84`). El primitivo recibe
  `open={false}` y devuelve `null` ANTES de leer el `message`
  (`Toast.tsx:116`). El string vacío nunca se renderiza.
- ✅ **Cleanup del setTimeout del listener**: `:73` retorna
  `() => clearTimeout(t)`, así que un desmontaje entre `replaceState` y
  el tick limpia el timeout. No hay setState en componente desmontado.
- ✅ **Cleanup del Escape listener**: `Toast.tsx:113` retorna
  `() => window.removeEventListener('keydown', onKey)`. El effect depende
  de `[open, dismissible, onClose]` (`:114`), por lo que al cambiar
  `open` a `false` el listener se remueve. Idem al unmount.
- ✅ **Patrón `setTimeout(setError, 0)` (desviación intencional)**:
  comparado contra `NotificationsDropdown.tsx:131, 143` — es exactamente
  el mismo patrón ("setState diferido para no violar
  `react-hooks/set-state-in-effect`"). El comentario en el listener
  (`:68-71`) referencia la decisión explícitamente. **El smoke test 9
  (back-button) no se rompe**: `replaceState` ya corrió síncrono en `:66`
  antes del `setTimeout`, así que el history stack ya tiene la URL limpia
  cuando el user pulsa Back.

## Verificación final

- pnpm lint: **OK** (`./init.sh` → "Lint → OK").
- pnpm type-check: **OK** (`./init.sh` → "Type-check → OK").
- pnpm build: **OK** (build completo terminó sin errores; ruta `/dev/ui`
  marcada como `○` static, `/` como `ƒ` dynamic — coherente con el cambio).

## NITs no bloqueantes

1. **`src/components/admin/ResendInvitationButton.tsx:69-71`**: el prop
   `fullWidth` quedó después de `className="md:w-auto"`. Funcionalmente
   correcto, pero la combinación `fullWidth` + `md:w-auto` es un poco
   sutil — un comentario aclarando "full-width móvil, auto-width desktop"
   ayudaría a futuros lectores. No bloquea.
2. **`src/app/dev/ui/ToastShowcase.tsx:25, 30`**: dos usos seguidos de
   `text-muted` con tamaños/casing distintos (`text-xs ... uppercase` y
   `text-xs`). Coherente con `MatrixRow` del page.tsx, pero podría
   factorizarse si se sigue creciendo el archivo. No bloquea.
3. **`src/components/auth/AuthErrorHashListener.tsx:32-38`**: el
   `console.warn` en dev queda en bundle final por usar
   `process.env.NODE_ENV` — Next lo dead-code-elimina en prod. Verificado
   OK; no bloquea, pero conviene confirmar en próximo `next build` si
   alguna vez se ve en la consola de producción.

## Riesgos

Ninguno bloqueante. La desviación intencional (`setTimeout(setError, 0)`)
está documentada en el código, sigue un patrón ya validado en el repo,
y un análisis del orden de ejecución confirma que `replaceState` corre
síncrono antes del tick — por lo que el smoke test 9 (back-button) no
se rompe.

## Notas para el leader

- Pendiente agregar checklist de smoke tests §7 A1, A4, A10-A13, E14,
  F16, G19, G21 (más A1-A9 del listener) a `progress/smoke-tests.md`
  según indica §7.H y §B.3 del spec. Esto es trabajo del leader al
  cerrar la feature, no del implementer ni del reviewer.
