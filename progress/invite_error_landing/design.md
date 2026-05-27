# Design spec — invite_error_landing

> Feature `requires_approval: false`. **Decisiones cerradas con el humano
> 2026-05-27**: D1 = **EXTRACT** primitivo `Toast` + migrar 2 call sites,
> D2 = **SIN SUSPENSE**, D3 = **WARNING**. El scope creció: ahora la feature
> entrega el listener del hash + el primitivo reusable + la migración de
> `VisitScheduler` y `ResendInvitationButton`.

## 1. Resumen y motivación

Supabase Auth, cuando rechaza un link (invite expirado, magic link ya
usado, OAuth fallido), redirige a `SITE_URL` raíz con los detalles del
error en el **URL fragment**:

```
http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
```

El fragment (`#...`) es client-side: NO viaja al server, así que ni el
middleware, ni `/auth/callback`, ni la home Server Component pueden
verlo. Resultado actual: el invitado ve la home normal con un hash feo
en la URL y sin idea de qué pasó (caso real observado en smoke test
2026-05-26 con `broujeteixeiru-5511@yopmail.com`).

Esta feature monta un Client Component en la home que lee
`window.location.hash`, muestra un toast en español con copy específico
por `error_code`, limpia el hash via `history.replaceState`, y se
desmonta tras el auto-dismiss. **Para evitar duplicar el patrón un
tercer call site**, esta feature también extrae el primitivo `<Toast>`
reusable a `src/components/ui/` y migra los 2 toasts inline existentes.

Depende de `resend_invitation_button` porque el copy del toast referencia
"pídele al admin que te envíe uno nuevo" — flujo que ahora existe del
otro lado del directorio admin.

## 2. Acceptance criteria (copiados del backlog + expandidos)

- [ ] Existe `src/components/ui/Toast.tsx` (Client Component) — primitivo
      reutilizable con variants `success | warning | danger`, API
      controlada por props (sin provider/context). Exportado desde
      `src/components/ui/index.ts`.
- [ ] Existe `src/components/auth/AuthErrorHashListener.tsx` (Client
      Component) que se monta SOLO en la home (`/`) y lee
      `window.location.hash` desde `useEffect` (jamás durante render
      server-side).
- [ ] El listener mapea `error_code` a copy en español según §4: al
      menos `otp_expired`, `access_denied` y un fallback genérico.
- [ ] El listener muestra el mensaje usando el primitivo `<Toast>`
      con `variant="warning"` y `autoDismissMs={6000}`.
- [ ] Tras mostrar el toast, ejecuta `history.replaceState(null, '',
    window.location.pathname + window.location.search)` para limpiar
      el hash de la barra de direcciones.
- [ ] El componente NO altera el render del resto de la home cuando
      no hay hash de error (`#access_token=...`, hash vacío, hash de
      navegación interna `#new-in-market`).
- [ ] `src/app/(app)/page.tsx` lo monta sin Suspense (D2 cerrada) al
      final del JSX.
- [ ] `VisitScheduler.tsx` migrado al primitivo (variant `success`,
      sin dismiss button, sin auto-dismiss — el call site sigue
      controlando el redirect a 600ms).
- [ ] `ResendInvitationButton.tsx` migrado al primitivo (variant
      `success` cuando ok, `danger` cuando error; auto-dismiss 4s en
      success; el comentario "no hay sistema global de toast en el
      repo" se elimina).
- [ ] Smoke tests §7 pasan: listener, primitivo en `/dev/ui`, ambos
      call sites migrados.

## 3. Estructura de archivos

### Crear

- `src/components/ui/Toast.tsx` — primitivo reutilizable. Client
  Component (necesita `useEffect` para auto-dismiss y Escape listener).
- `src/components/auth/AuthErrorHashListener.tsx` — Client Component
  específico de la feature (consume el primitivo).
- `src/components/auth/index.ts` — barrel nuevo. La carpeta
  `src/components/auth/` no existe todavía; la creamos para esta feature
  y dejamos lugar a futuros componentes de auth.

### Modificar

- `src/app/(app)/page.tsx` — agregar `<AuthErrorHashListener />` al
  final del root `<div>` (después de los `<section>`). Una sola línea
  de import, una sola línea de JSX. NO requiere `'use client'` en
  el page; el componente importado ya lo declara.
- `src/components/ui/index.ts` — agregar `export { Toast } from './Toast'`
  y `export type { ToastProps, ToastVariant } from './Toast'`.
- `src/components/visits/VisitScheduler.tsx` — reemplazar el `<div
role="status" ...>` inline (líneas 216-225) por `<Toast ... />`.
  Quitar el import de `Icon` si queda sin usos directos (sigue usándose:
  no se quita).
- `src/components/admin/ResendInvitationButton.tsx` — reemplazar los
  dos `<p role="status|alert">` inline (líneas 71-80) por un único
  `<Toast variant={feedback.kind === 'success' ? 'success' : 'danger'} ...>`.
  Eliminar del JSDoc el fragmento "no hay sistema global de toast en
  el repo todavía". El layout `flex flex-col items-stretch gap-1.5` deja
  de necesitar wrapper para el feedback — pasa a ser solo el `<Button>`.

### NO modificar

- `src/app/(app)/layout.tsx` — montar SOLO en la home; el layout no se
  toca.
- `src/lib/auth/errors.ts` — los códigos del fragment vienen del lado
  de Supabase Auth `/verify` y son distintos al catálogo interno.
  Mapeamos inline en el listener.
- `src/app/auth/callback/route.ts` — ya maneja errores SERVER-side.
- `feature_list.json`, `CLAUDE.md`, `AGENTS.md`, `.claude/`.

## 4. Mapeo `error_code` → copy en español (listener)

El parser lee `hash.replace(/^#/, '')` como `URLSearchParams` y extrae
`error`, `error_code`, `error_description`. La clave de decisión es
`error_code`; `error` se usa solo como fallback para distinguir
"hash con error" vs "hash sin error".

| `error_code`          | Variant toast | Copy mostrado                                                                                      |
| --------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `otp_expired`         | `warning`     | "El link de invitación expiró. Pídele al admin que te envíe uno nuevo."                            |
| `access_denied`       | `warning`     | "El link ya fue usado o no es válido. Si necesitas otro, pídeselo al admin."                       |
| cualquier otro / nulo | `warning`     | "Hubo un problema con tu link de autenticación. Intenta de nuevo o pídele al admin un link nuevo." |

**Decisión sobre color** (D3 cerrada): `warning` (#D97706) y no `danger`.

- Estos errores **no son destructivos**: son situaciones esperables
  (link viejo, link ya consumido). El rojo `danger` está reservado para
  errores de mutación (validación fallida, no se pudo guardar, etc.).
- Patrón ya validado por `VisitScheduler` (success-soft + success para
  confirmaciones); el paralelo natural es warning-soft + warning para
  advertencias informativas.
- Tokens existentes en `globals.css` (verificado, líneas 71-75):
  `--color-warning: #d97706` y `--color-warning-soft: rgba(217, 119, 6,
0.12)`. Se usan vía utilities `bg-warning-soft` y `text-warning`.

**Sobre `error_description`**: NO se usa para mostrar al user. Viene
de Supabase con texto en inglés crudo — usarlo violaría el contrato
i18n. Solo se loguea via `console.warn` para debug.

## 5. Anatomía del Client Component (listener)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Toast } from '@/components/ui';

type AuthErrorKind = 'otp_expired' | 'access_denied' | 'unknown';

interface ParsedError {
  kind: AuthErrorKind;
  /** Mensaje en español ya resuelto desde el mapa. */
  message: string;
}

const AUTO_DISMISS_MS = 6000;

const COPY: Record<AuthErrorKind, string> = {
  otp_expired: 'El link de invitación expiró. Pídele al admin que te envíe uno nuevo.',
  access_denied: 'El link ya fue usado o no es válido. Si necesitas otro, pídeselo al admin.',
  unknown:
    'Hubo un problema con tu link de autenticación. Intenta de nuevo o pídele al admin un link nuevo.',
};

function parseHash(rawHash: string): ParsedError | null {
  if (!rawHash || rawHash === '#') return null;
  const params = new URLSearchParams(rawHash.replace(/^#/, ''));
  if (!params.has('error')) return null;

  const code = params.get('error_code');
  const kind: AuthErrorKind = code === 'otp_expired' || code === 'access_denied' ? code : 'unknown';

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[AuthErrorHashListener]', {
      error: params.get('error'),
      error_code: code,
      error_description: params.get('error_description'),
    });
  }

  return { kind, message: COPY[kind] };
}

export function AuthErrorHashListener() {
  const [error, setError] = useState<ParsedError | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseHash(window.location.hash);
    if (!parsed) return;

    setError(parsed);

    // Limpia el hash sin agregar entry al history stack.
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
  }, []);

  // NOTA: auto-dismiss y Escape los maneja el primitivo `Toast`. El
  // listener solo decide CUÁNDO abrir y le pasa `onClose` para que el
  // primitivo pueda cerrar.
  return (
    <Toast
      open={error !== null}
      onClose={() => setError(null)}
      variant="warning"
      message={error?.message ?? ''}
      autoDismissMs={AUTO_DISMISS_MS}
    />
  );
}
```

### Notas de la anatomía

1. **`'use client'` obligatorio**: usa `useEffect`, `useState`, `window`.
2. **Guard SSR**: `useState(null)` no toca `window`. La lectura solo
   ocurre en `useEffect`, que no corre en SSR. Sin riesgo de `ReferenceError`.
3. **Un único `useEffect`**: lee el hash y limpia. Auto-dismiss y Escape
   ya no viven acá — el primitivo `Toast` los encapsula.
4. **`message=""` cuando `error === null`**: el primitivo recibe `open={false}`
   y NO renderiza nada (devuelve `null`), así que el `message` vacío es
   inocuo. El operador `??` evita pasar `undefined`, que sería válido por
   TypeScript pero feo.
5. **Sin `useRef` ni `useRouter`**: no se necesita navegar; `replaceState`
   es más limpio y NO dispara re-render del page.

## 6. A11y (listener)

- **Live region**: el primitivo `Toast` aplica `role="status" +
aria-live="polite"` para variants `success` y `warning`, y
  `role="alert" + aria-live="assertive"` para variant `danger`. El
  listener usa `warning` → polite. Justificación: el error de link
  expirado es informativo, no destructivo.
- **Foco**: el toast no captura foco (lo aplica el primitivo). Justificación:
  es efímero y el user puede estar haciendo scroll en la home.
- **Dismiss por teclado**: tecla Escape cierra el toast (lo maneja el
  primitivo). El listener no agrega listener propio.
- **Botón close**: el primitivo lo renderiza por default
  (`dismissible: true`) con `aria-label="Cerrar aviso"`.
- **Contraste**: `text-warning` (#D97706) sobre `bg-warning-soft` (alpha
  0.12 sobre el fondo `bg-background` #EEF6F6) cumple AA.

## 7. Tests / smoke tests manuales

Pre-requisitos: `pnpm dev` corriendo en `localhost:3000`. No requiere
login (la home es pública).

### A. Listener — los 3 codes

1. **otp_expired**: navegar a
   `http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`.
   - Aparece toast warning con texto "El link de invitación expiró…".
   - URL queda como `http://localhost:3000/` (sin hash).
   - Pasados ~6s el toast desaparece solo.
2. **access_denied**: navegar a
   `http://localhost:3000/#error=access_denied&error_code=access_denied&error_description=Unauthorized`.
   - Toast con "El link ya fue usado o no es válido…".
3. **Code desconocido**: navegar a
   `http://localhost:3000/#error=server_error&error_code=potato&error_description=test`.
   - Toast con copy fallback "Hubo un problema con tu link…".

### B. Listener — casos negativos

4. `http://localhost:3000/` (sin hash) → no aparece toast.
5. `http://localhost:3000/#new-in-market` → no aparece toast; el hash se
   conserva.
6. `http://localhost:3000/#access_token=foo&type=signup` → no aparece
   toast.

### C. Listener — interacción

7. Test 1 + Escape antes de 6s → toast cierra inmediatamente.
8. Test 1 + clickear botón X → toast cierra inmediatamente.
9. Test 1 + Back del browser tras el toast → navega a la página previa
   (no a la URL con hash).

### D. Flujo E2E real

10. Como admin: invitar a un nuevo user yopmail.
11. Esperar ≥1h sin clickear el link.
12. Clickear el link expirado desde el email.
13. El invitado aterriza en `localhost:3000/` con toast warning del
    copy `otp_expired`. URL limpia tras el primer render.

### E. Primitivo `Toast` aislado (`/dev/ui`)

Ya existe la página `src/app/dev/ui/page.tsx` como catálogo visual
interno (verificado). La feature debe agregar una sección "Toast" con:

14. Render de las 3 variants (`success`, `warning`, `danger`) con `open=true`,
    `autoDismissMs={0}` (sin auto-dismiss para inspección visual estática)
    y un botón "Reset" que reabra el toast cerrado.
15. Verificación visual: cada variant usa el ícono default correcto,
    el color de fondo soft, el texto saturado y el ring focus correcto al
    Tab-near el botón close.

### F. VisitScheduler post-migración

16. Login como user → ir a `/property/<id>/schedule-visit` → seleccionar
    slot libre → "Confirmar visita".
17. Aparece toast **success** con texto "Visita confirmada." y luego de
    ~600ms redirige a `/profile?tab=visits`.
18. Comparar con el comportamiento previo (capturas anteriores si las hay).
    Sin botón close visible (el toast no es dismissible en este call site
    porque el redirect lo descarta de todos modos).

### G. ResendInvitationButton post-migración

19. Login como admin → `/admin/users` → fila pending con link expirado →
    clickear "Reenviar invitación".
20. Aparece toast **success** flotante (NO inline) con texto "Invitación
    reenviada a {displayName}.". Auto-dismiss tras 4s.
21. Forzar 429 (clickear muchas veces seguidas hasta hit del rate-limit
    del Server Action) → aparece toast **danger** con el mensaje del
    error ("Demasiadas invitaciones recientes." u otro según
    `result.error.message`). Persiste hasta que el user cierre con X
    o Escape (no auto-dismiss en error — ver §A primitivo).
22. Validar que el layout de la fila admin NO se rompa: la fila ya no
    tiene el `<p>` debajo del botón ocupando espacio vertical.

### H. Smoke tests pendientes (`progress/smoke-tests.md`)

El leader debe agregar los pasos A1, A4, A10-A13, E14, F16, G19, G21
al archivo central de smoke tests para que el humano los marque.

## 8. Riesgos / edge cases

### Del listener

- **R1 — `error=` malformado sin `error_code`**: cae en `unknown` con
  copy fallback. Aceptable.
- **R2 — Hash sin `error=`**: el guard `if (!params.has('error'))
return null` descarta. Aceptable.
- **R3 — Doble montaje en React Strict Mode (dev)**: segunda
  invocación encuentra hash vacío. Idempotente.
- **R4 — Back button tras `replaceState`**: navega a la página previa.
  Esperado.
- **R5 — Conflicto con otro listener Escape**: la home no tiene modales
  hoy. Re-evaluar si surge conflicto real.

### De la migración

- **R6 — Regresión visual en `VisitScheduler`**: el toast actual usa
  `rounded-full px-6 py-3` (pill); el primitivo va a usar
  `rounded-lg px-4 py-3` (recuadro suave). **Cambio aceptable y
  deseado** — unifica el look across call sites. Verificar en smoke
  test F que el toast verde sigue siendo legible y centrado.
- **R7 — Regresión UX en `ResendInvitationButton`**: pasa de feedback
  inline (debajo del botón) a toast flotante (fixed bottom-20). El
  admin pierde la asociación visual directa "botón ↔ feedback". **Aceptable**:
  el toast nombra explícitamente al destinatario ("Invitación reenviada
  a Juan Pérez."), lo que mantiene el contexto. Mitigación adicional:
  el `Button` queda en estado `disabled` mientras `feedback.kind ===
'success'`, así el admin no clickea dos veces.
- **R8 — Stack de toasts simultáneos**: si el admin clickea "Reenviar"
  en una fila y mientras corre clickea otra (poco probable porque el
  botón se deshabilita), ambos toasts ocuparían `fixed bottom-20`
  exactamente. **Aceptable como limitación conocida**: el primitivo
  NO implementa stacking en esta versión. Documentado en §A primitivo
  como future work.

## 9. Decisiones cerradas con el humano (2026-05-27)

### D1 — Extraer primitivo `Toast` reutilizable: **EXTRACT**

Resolución: crear `src/components/ui/Toast.tsx` como primitivo
reutilizable (variants `success | warning | danger`, API controlada
por props, sin provider/hook). Migrar **ambos** call sites existentes
(`VisitScheduler` y `ResendInvitationButton`). Detalle del primitivo
en §A y migración en §B.

Razones para hacerlo ahora y no esperar:

- Esta feature suma el 3er call site del patrón; sin extraer, dejamos
  3 toasts inline con código casi idéntico.
- Los 2 call sites existentes ya divergieron en estilo (uno pill, otro
  inline `<p>`); congelar los 3 ahora evita que diverjan más.

### D2 — Wrap en `<Suspense>` en `page.tsx`: **SIN SUSPENSE**

Resolución: montar `<AuthErrorHashListener />` directo en
`src/app/(app)/page.tsx`. `<Suspense>` se usa cuando un componente
puede suspenderse por data fetching; este componente no hace fetch,
solo lee `window.location.hash`. Wrap en Suspense no aporta nada.

### D3 — Color del toast del listener: **WARNING**

Resolución: variant `warning` (#D97706 + soft 0.12 alpha). Razones
en §4. Tokens ya existen, no requiere agregar nada a `globals.css`.

## 10. Tokens a usar (cero hex, cero invenciones)

Verificados en `src/app/globals.css`:

- `bg-warning-soft` (línea 72), `text-warning` (línea 44) — listener
  - primitivo variant warning.
- `bg-success-soft` (línea 74), `text-success` (línea 43) — primitivo
  variant success + migración de `VisitScheduler`.
- `bg-danger-soft` (línea 73), `text-danger` (línea 45) — primitivo
  variant danger + migración de `ResendInvitationButton` (caso error).
- `shadow-soft` (línea 60) — sombra del toast.
- `rounded-lg` (línea 67) — radius del toast (unifica el look).
- `focus-visible:ring-warning|success|danger` — ring del botón close
  según variant.
- `text-sm font-medium leading-snug` — tipografía del mensaje.

**Nada de hex literales** en JSX. Spec entera sin `#`-colors.

## 11. Tipografía

- Mensaje del toast: `text-sm font-medium` (body 14px / 500). Inter
  heredada del `body` global.

## 12. Datos

- **Tablas consumidas**: ninguna.
- **Server vs Client**: ambos componentes son Client. Razón: `useEffect`
  - `window` + listeners de teclado.
- **Server Actions**: ninguna directa en la feature; las migraciones
  no cambian las acciones existentes (`scheduleVisit`, `resendInvitation`).

## 13. Interactividad

| Elemento           | Tipo   | Detalle                                            |
| ------------------ | ------ | -------------------------------------------------- |
| Toast primitivo    | client | `open` controlado por prop, auto-dismiss interno.  |
| Listener hash      | client | `useState` + un `useEffect` para leer/limpiar.     |
| Auto-dismiss timer | client | Dentro del primitivo; `useEffect` con cleanup.     |
| Escape key dismiss | client | Dentro del primitivo; listener global con cleanup. |
| Botón X close      | client | `onClick={onClose}` dentro del primitivo.          |

## 14. Estados

- **`open={false}`**: el primitivo devuelve `null`. No ocupa DOM.
- **`open={true}`**: renderiza el toast. Si `autoDismissMs > 0`, el
  primitivo programa el cierre y llama a `onClose` cuando expira.
- **Dismiss por X o Escape**: el primitivo llama `onClose` y el call
  site decide cómo reflejar el cierre (típicamente `setOpen(false)`).

## 15. Notas

- **Por qué 6s para el listener y 4s para `ResendInvitationButton`**:
  el copy de auth-error es más largo y el user llega desorientado;
  6s alinea con Material guidelines (4-10s). El de resend es corto
  y conocido por el admin; 4s mantiene el patrón actual.
- **Por qué NO se persiste el dismiss del listener**: tras F5 el hash
  ya está limpio (lo limpiamos al primer render). Nunca vuelve a salir.
- **i18n**: textos en español directamente en JSX.
- **Compatibilidad con `TopNav`**: el toast vive en `position: fixed
bottom-20`, fuera del flujo del TopNav. Sin interferencia.

---

## §A. Primitivo `Toast` (src/components/ui/Toast.tsx)

### A.1. API exacta

```ts
export type ToastVariant = 'success' | 'warning' | 'danger';

export interface ToastProps {
  /** Si false, no renderiza nada. Controlado por el call site. */
  open: boolean;
  /**
   * Llamado cuando el toast pide cerrarse (auto-dismiss, Escape, o
   * botón X). El call site decide si bajar `open` a false.
   */
  onClose: () => void;
  variant: ToastVariant;
  /** Texto en español, una sola línea conceptual. Envuelve si es largo. */
  message: string;
  /**
   * Milisegundos antes del auto-dismiss. `0` = no auto-dismiss (el call
   * site cierra cuando quiera). Default 4000ms.
   */
  autoDismissMs?: number;
  /**
   * Si true (default), muestra botón X y permite Escape para cerrar.
   * Si false, solo cierra por auto-dismiss o por el call site bajando
   * `open` a false externamente (caso `VisitScheduler` que redirige).
   */
  dismissible?: boolean;
  /**
   * Override del ícono. Si se omite, se usa el default por variant
   * (ver A.3).
   */
  icon?: string;
}
```

#### Decisión sobre `position`: **NO incluir en la API.**

Los 3 call sites del repo (incluyendo el nuevo listener) necesitan
exactamente la misma posición: `fixed bottom-20 left-1/2 -translate-x-1/2`
(verificado: `VisitScheduler.tsx:220` usa exactamente ese patrón). No
hay caso de uso real para `bottom-right` u otras posiciones hoy.
Hardcodear la posición:

- Reduce la API a lo esencial.
- Evita un prop con default que nadie usa.
- Si en el futuro emerge la necesidad (p. ej. desktop con toast
  esquinero), se agrega como prop con default `'bottom-center'` sin
  romper consumers existentes.

### A.2. Tokens por variant (verificados en `globals.css`)

| variant | bg                | text           | ring focus           | ícono default  |
| ------- | ----------------- | -------------- | -------------------- | -------------- |
| success | `bg-success-soft` | `text-success` | `focus:ring-success` | `check_circle` |
| warning | `bg-warning-soft` | `text-warning` | `focus:ring-warning` | `warning`      |
| danger  | `bg-danger-soft`  | `text-danger`  | `focus:ring-danger`  | `error`        |

**Verificación**: los 6 tokens (`bg-success-soft`, `bg-warning-soft`,
`bg-danger-soft`, `text-success`, `text-warning`, `text-danger`)
existen en `src/app/globals.css` líneas 43-45 (text) y 72-74 (soft bgs).
No hay BLOCKERs por tokens faltantes. Las clases `focus:ring-<token>`
funcionan automáticamente porque Tailwind 4 genera utilities de ring
desde cualquier `--color-*` declarado en `@theme`.

### A.3. Íconos default

Verificación de disponibilidad: el wrapper `Icon` (`src/components/ui/Icon.tsx`)
acepta **cualquier string** como `name` y lo renderiza con la fuente
`material-icons` (default) o `material-symbols-outlined` (variant
`outlined`). No hay un catálogo cerrado. Por lo tanto cualquier nombre
válido de Material Icons funciona.

- `check_circle` — verificado en uso real: `VisitScheduler.tsx:222`,
  `PropertyAmenitiesList.tsx:25`, `UserStatusIndicator.tsx:33`.
- `warning` — nombre estándar de Material Icons. Sin uso previo en el
  repo pero la fuente lo incluye (es de los más comunes).
- `error` — nombre estándar (círculo rojo con `!`). Sin uso previo pero
  estándar.
- `close` — verificado: `MobileNavDrawer.tsx:171`, `ProfileAvatarEditor.tsx:231`.

No hay BLOCKER. Si en QA visual el glifo `warning` o `error` no
renderiza correctamente (improbable), el fallback es usar
`report_problem` / `cancel` respectivamente, también del set Material
Icons. **No agregar a Riesgos como BLOCKER** — es una contingencia
remota; se valida en smoke test E14.

### A.4. Default de `autoDismissMs`

**Default = 4000ms.** Razón: es el valor que usa hoy
`ResendInvitationButton` (4s) y es el más común en sistemas Material
(snackbar default 4s). El listener pasa explícitamente `6000` porque
el copy es más largo.

**`autoDismissMs={0}` = no auto-dismiss.** El call site controla el
cierre (caso `VisitScheduler` que cierra implícitamente al hacer
`router.push`, descartando el componente). Documentar este contrato
en JSDoc del prop.

### A.5. A11y

**Default**:

- variants `success` y `warning`: `role="status"` + `aria-live="polite"`.
- variant `danger`: `role="alert"` + `aria-live="assertive"`.

Justificación. Un error (variant `danger`) suele ser bloqueante y
amerita interrumpir al screen reader. Un éxito o advertencia
informativa puede esperar al próximo silencio. Esto sigue las pautas
WAI-ARIA para live regions. NO se permite override (mantener API
chica; si emerge un caso, se agrega prop entonces).

### A.6. Escape key handling

**El primitivo lo maneja**, no el call site. Razón:

- Los 3 call sites se benefician.
- DRY: implementarlo en cada call site duplica el `useEffect` +
  cleanup.
- Si `dismissible={false}`, el primitivo NO registra el listener
  (el comportamiento esperado del call site no-dismissible es que el
  toast permanece hasta que externalmente baje `open`).

### A.7. Dimensiones / posición

Hardcoded en el primitivo:

```
fixed bottom-20 left-1/2 -translate-x-1/2 z-50
max-w-[calc(100%-2rem)] sm:max-w-md
```

Verificación. `VisitScheduler.tsx:220` usa:
`fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-success-soft px-6 py-3 text-success shadow-soft`.
La posición coincide. Las diferencias (rounded-full vs rounded-lg,
px-6 vs px-4, items-center vs items-start) son intencionales para
unificar la apariencia (ver R6 en §8).

### A.8. JSX completo (referencia, no es código de producción)

```tsx
'use client';

import { useEffect } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/utils/cn';

export type ToastVariant = 'success' | 'warning' | 'danger';

export interface ToastProps {
  open: boolean;
  onClose: () => void;
  variant: ToastVariant;
  message: string;
  autoDismissMs?: number;
  dismissible?: boolean;
  icon?: string;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    bg: string;
    text: string;
    ring: string;
    icon: string;
    role: 'status' | 'alert';
    live: 'polite' | 'assertive';
  }
> = {
  success: {
    bg: 'bg-success-soft',
    text: 'text-success',
    ring: 'focus-visible:ring-success',
    icon: 'check_circle',
    role: 'status',
    live: 'polite',
  },
  warning: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    ring: 'focus-visible:ring-warning',
    icon: 'warning',
    role: 'status',
    live: 'polite',
  },
  danger: {
    bg: 'bg-danger-soft',
    text: 'text-danger',
    ring: 'focus-visible:ring-danger',
    icon: 'error',
    role: 'alert',
    live: 'assertive',
  },
};

export function Toast({
  open,
  onClose,
  variant,
  message,
  autoDismissMs = 4000,
  dismissible = true,
  icon,
}: ToastProps) {
  // Auto-dismiss
  useEffect(() => {
    if (!open || autoDismissMs <= 0) return;
    const t = setTimeout(() => onClose(), autoDismissMs);
    return () => clearTimeout(t);
  }, [open, autoDismissMs, onClose]);

  // Escape key (solo si dismissible)
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const styles = VARIANT_STYLES[variant];
  const iconName = icon ?? styles.icon;

  return (
    <div
      role={styles.role}
      aria-live={styles.live}
      className={cn(
        'fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-start gap-2',
        'rounded-lg px-4 py-3 shadow-soft',
        'max-w-[calc(100%-2rem)] sm:max-w-md',
        styles.bg,
        styles.text,
      )}
    >
      <Icon name={iconName} size="sm" className="mt-0.5 shrink-0" />
      <p className="text-sm leading-snug font-medium">{message}</p>
      {dismissible && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className={cn(
            'ml-1 shrink-0 rounded p-0.5 transition-opacity hover:opacity-70',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            styles.ring,
          )}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
```

### A.9. Index export

`src/components/ui/index.ts` agrega al final:

```ts
export { Toast } from './Toast';
export type { ToastProps, ToastVariant } from './Toast';
```

### A.10. Limitaciones conocidas (future work)

- **Sin stacking**: solo un toast a la vez (R8 en §8). Si se necesita
  cola, se agrega un `<ToastViewport>` en futura iteración.
- **Sin animación de entrada/salida**: el componente aparece/desaparece
  instantáneamente. `tailwindcss-animate` está disponible en
  `globals.css:2`; se puede agregar fade-in en futura iteración sin
  romper la API.
- **`position` hardcoded**: si emerge caso de uso, agregar prop opcional
  con default.

---

## §B. Migración de call sites existentes

### B.1. `src/components/visits/VisitScheduler.tsx`

**Antes** (líneas 216-225):

```tsx
{
  toastVisible && (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-success-soft px-6 py-3 text-success shadow-soft"
    >
      <Icon name="check_circle" size="sm" />
      <span className="text-sm font-medium">Visita confirmada.</span>
    </div>
  );
}
```

**Después**:

```tsx
<Toast
  open={toastVisible}
  onClose={() => setToastVisible(false)}
  variant="success"
  message="Visita confirmada."
  autoDismissMs={0}
  dismissible={false}
/>
```

Notas de migración:

- `autoDismissMs={0}`: el call site NO usa auto-dismiss; el redirect a
  `/profile?tab=visits` a 600ms desmonta el componente, descartando el
  toast.
- `dismissible={false}`: no muestra X. El user no debe poder cerrar
  manualmente porque el redirect está en camino — confuso UX si cierra
  el toast y luego ve la redirección.
- `setToastVisible(false)` en `onClose` es defensivo: el primitivo no
  va a invocarlo (porque `autoDismissMs=0` y no hay X/Escape), pero
  TypeScript exige la prop.
- **Cambio visual aceptable**: `rounded-full px-6` → `rounded-lg px-4`.
  Toast pasa de pill a recuadro suave. Documentado en R6 §8.
- Quitar el import de `Icon` si queda sin usar (verificar: hay otros
  Icons en el archivo, p. ej. nada — sí queda sin uso directo si solo
  se usaba para el toast). Reviewer valida.

Riesgos:

- Regresión visual del shape (pill → recuadro). Smoke F16.
- El estado `toastVisible` se mantiene como bool (no se convierte a
  enum) — diff mínimo en el resto del archivo.

### B.2. `src/components/admin/ResendInvitationButton.tsx`

**Antes** (líneas 55-82):

```tsx
return (
  <div className="flex flex-col items-stretch gap-1.5 md:items-end">
    <Button ... />
    {feedback.kind === 'success' && (
      <p className="text-xs text-primary md:text-right" role="status">
        Invitación reenviada a <span className="font-medium">{userDisplayName}</span>.
      </p>
    )}
    {feedback.kind === 'error' && (
      <p className="text-xs text-danger md:text-right" role="alert">
        {feedback.message}
      </p>
    )}
  </div>
);
```

**Después**:

```tsx
return (
  <>
    <div className="flex flex-col items-stretch md:items-end">
      <Button ... />
    </div>
    <Toast
      open={feedback.kind !== 'idle'}
      onClose={() => setFeedback({ kind: 'idle' })}
      variant={feedback.kind === 'error' ? 'danger' : 'success'}
      message={
        feedback.kind === 'success'
          ? `Invitación reenviada a ${userDisplayName}.`
          : feedback.kind === 'error'
            ? feedback.message
            : ''
      }
      autoDismissMs={feedback.kind === 'error' ? 0 : 4000}
    />
  </>
);
```

Notas de migración:

- `autoDismissMs` condicional: success 4s (mantiene comportamiento
  actual), error 0 (no auto-dismiss; el admin debe poder leer el error
  y cerrarlo manualmente). El `setTimeout(... 4000)` interno actual
  (línea 51) se **elimina** — lo maneja el primitivo.
- El `message` cuando `kind === 'idle'` es `''` pero es inocuo porque
  `open === false`.
- Se borra del JSDoc del archivo el comentario "no hay sistema global
  de toast en el repo todavía" (líneas 22-23 del archivo actual). El
  comentario completo queda actualizado: explicar el flujo
  feedback.idle/success/error sin mencionar la limitación obsoleta.
- El wrapper `<div className="flex flex-col items-stretch gap-1.5
md:items-end">` pierde sentido sin el `<p>` debajo. Se mantiene como
  `<div className="flex flex-col items-stretch md:items-end">` solo
  para conservar el alineamiento del Button (full-width móvil, auto-
  width desktop). El `gap-1.5` se elimina (ya no hay segundo hijo).
- El estado `feedback` se mantiene como discriminated union — diff
  mínimo. La lógica de `disabled={isPending || feedback.kind ===
'success'}` se conserva (sigue siendo correcta).

Riesgos:

- **R7 (§8)**: pérdida de proximidad visual botón ↔ feedback. Mitigado
  porque el toast nombra al destinatario (`{userDisplayName}`).
- **Botón disabled tras éxito**: hoy queda disabled mientras
  `feedback.kind === 'success'` (4s). Con la migración, el primitivo
  llama `onClose` a los 4s, que vuelve a `feedback.kind === 'idle'`
  y el botón se re-habilita. **Comportamiento equivalente al actual**.
- **Layout shift**: hoy aparece un `<p>` debajo del Button que sumaba
  ~20px de alto. Con la migración, ese espacio desaparece (toast es
  flotante). La fila admin se ve un poco más compacta. **Aceptable**
  — la fila ya tiene padding consistente y no se descuadra.

Verificación en smoke G19-G22.

### B.3. Update a `progress/smoke-tests.md`

El leader debe agregar al archivo central los pasos F16-F18, G19-G22
y E14-E15 (sección "ui_primitives_toast / invite_error_landing") para
que el humano los marque cuando ejecute el smoke test.

---

## §C. BLOCKERs encontrados

**Ninguno.** Verificaciones:

- Tokens necesarios (`bg-success-soft`, `bg-warning-soft`,
  `bg-danger-soft`, `text-success`, `text-warning`, `text-danger`):
  todos existentes en `src/app/globals.css` líneas 43-45 y 72-74.
- Íconos necesarios (`check_circle`, `warning`, `error`, `close`):
  el wrapper `Icon` acepta cualquier nombre Material Icons. `check_circle`
  y `close` ya en uso; `warning` y `error` son nombres estándar de la
  fuente. Riesgo remoto de glifo no presente se valida en smoke E14;
  fallback: `report_problem` / `cancel`.
- Página `/dev/ui`: existe en `src/app/dev/ui/page.tsx`. La feature
  puede agregar una sección "Toast" siguiendo el patrón de las demás
  primitivas del archivo.
