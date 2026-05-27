# Review — feature fix_auth_error_listener_and_toast_polish

**Veredicto:** APPROVED WITH NITS

El bundle de 3 fixes está implementado conforme al spec. Una desviación
menor (eliminación de `eslint-disable-next-line`) es defendible y aceptada
como NIT no bloqueante. `./init.sh full` verde.

---

## Acceptance del backlog (feature_list.json §acceptance)

1. **"AuthErrorHashListener.tsx muestra el toast warning en `pnpm dev`…"**
   — Cubierto por el patrón `useRef` side-channel en
   `src/components/auth/AuthErrorHashListener.tsx:55,70-72,78`. La
   verificación browser-based queda como pendiente humano (ver §8).
2. **"URL se limpia con replaceState ANTES del primer paint del toast"** —
   `AuthErrorHashListener.tsx:78,84,86`: el orden es `parsedRef.current = parsed`
   (línea 78) → `replaceState` (línea 84) → `setError(parsed)` (línea 86).
   Garantía preservada.
3. **"El back-button del navegador no vuelve a la URL con hash"** —
   `AuthErrorHashListener.tsx:84` sigue siendo `replaceState`, no
   `pushState`. Sin cambios respecto al original.
4. **"Smoke test del listener pasa los 3 codes + Escape/X/Back"** —
   Pendiente humano (ver §8). `parseHash` y `COPY` no cambiaron
   (`AuthErrorHashListener.tsx:16-21,23-40`).
5. **"No introducir provider/context — mantener Client primitivo con
   useState local"** — `AuthErrorHashListener.tsx:54` mantiene
   `useState`, solo se agrega `useRef` adyacente (línea 55). Sin
   provider/context.
6. **"Documentar en comentario inline por qué sobrevive a StrictMode"**
   — `AuthErrorHashListener.tsx:57-66`: 10 líneas de comentario
   explican el patrón (spec pedía ~8, el implementer agrega 2 más
   para cubrir StrictMode + justificación del lint silenciado).
7. **"Toast.tsx: ícono y texto centrados verticalmente"** —
   `Toast.tsx:126` (`items-center`) + `Toast.tsx:133` (sin `mt-0.5`).
8. **"Toast.tsx: el botón X muestra `cursor-pointer` en hover"** —
   `Toast.tsx:141` (`cursor-pointer` agregado al primer string del `cn`).
9. **"Re-correr showcase de /dev/ui tras el fix"** — Pendiente humano (§8).

---

## Spec ítem por ítem

### §Cambio A — useRef side-channel

- `useRef<ParsedError | null>(null)` declarado en cuerpo del componente:
  `AuthErrorHashListener.tsx:55`. ✅
- Effect rama "ref poblado": `if (parsedRef.current !== null) { setError(...); return; }`
  en `AuthErrorHashListener.tsx:70-73`. ✅
- Effect rama "primer mount": parseHash → guard null → `parsedRef.current = parsed`
  → `replaceState` → `setError` síncrono en
  `AuthErrorHashListener.tsx:75-86`. Orden de side-effects respetado
  (ref antes de replaceState, replaceState antes de setError). ✅
- Sin `setTimeout` / `clearTimeout`: `grep` confirma ausencia en el
  archivo. ✅
- Comentario inline de ~8 líneas encima del effect:
  `AuthErrorHashListener.tsx:57-66`. ✅
- Dependencias del effect siguen `[]`: `AuthErrorHashListener.tsx:87`. ✅
- Import `useRef` agregado: `AuthErrorHashListener.tsx:3`. ✅

### §Cambio B — alineación Toast

- `items-start` → `items-center` en `Toast.tsx:126`. ✅
- `mt-0.5` removido del Icon en `Toast.tsx:133`. ✅

### §Cambio C — cursor del X

- `cursor-pointer` agregado al className del botón close en
  `Toast.tsx:141`. ✅ (Inserción entre `shrink-0` y `rounded` —
  posición coincide con el diff conceptual del spec).

### §Lo que NO debe cambiar

- Firma, props, exports, JSX, `COPY`, `parseHash`, `ParsedError`,
  `AUTO_DISMISS_MS`, console.warn de debug: todos intactos
  (`AuthErrorHashListener.tsx:14,16-21,23-40,53,92-100`). ✅
- API del primitivo Toast (`ToastProps`, defaults, variants, posición,
  `VARIANT_STYLES`, role/aria-live, auto-dismiss, Escape handler):
  intactos (`Toast.tsx:9-33,44-69,99-114`). ✅
- Tipografía del mensaje (`text-sm leading-snug font-medium`):
  `Toast.tsx:134` sin cambios. ✅
- `git diff --stat`: solo 2 archivos de `src/` modificados + 1
  cambio de status en `feature_list.json` (válido para implementer).

---

## Desviación del implementer

**Removió los comentarios `// eslint-disable-next-line
react-hooks/set-state-in-effect`** que el spec sugería agregar en
§Cambio A. Justificación reportada: ESLint no se queja porque la regla
no se dispara cuando hay early-returns que hacen condicional al
`setState`.

**Validación del reviewer:**

- `./init.sh full` corrió `eslint --max-warnings=0` → OK. Sin warnings
  pendientes.
- `grep eslint-disable` en ambos archivos → cero coincidencias. Sin
  vestigios.
- La decisión es defendible: el spec mismo dice que la justificación
  para silenciar el lint era "el state SOLO se setea cuando parseHash
  retorna no-null (condicional → no es un setState incondicional)". Si
  el linter ya hace ese análisis y no flagea, el disable es ruido.

**Veredicto sobre la desviación:** aceptada. Cosmética, no afecta
comportamiento ni el approach del spec. Documentada acá como NIT (§6).

---

## Builds

- `pnpm lint --max-warnings=0` → OK.
- `pnpm type-check` (`tsc --noEmit`) → OK.
- `pnpm build` (Next 16.2.6 Turbopack) → ✓ Compiled successfully, 15
  páginas generadas, sin errores.
- `./init.sh full` → ✓ Verificación completa pasó.

---

## Reglas duras (AGENTS.md)

- Cero hex literales en JSX: `grep -E "#[0-9a-fA-F]{3,6}"` en ambos
  archivos → 0 matches. ✅
- Server Components default: ambos archivos ya eran `'use client'`
  antes del cambio y siguen siéndolo (justificado: el listener lee
  `window.location.hash` y `Toast` tiene `useEffect`). ✅
- Sin nuevas dependencias: `git diff` no toca `package.json` /
  `pnpm-lock.yaml`. ✅
- Textos en español sin cambios: `COPY` (`AuthErrorHashListener.tsx:16-21`)
  - `aria-label="Cerrar aviso"` (`Toast.tsx:139`) intactos. ✅
- Mobile-first: clases `fixed bottom-20 left-1/2 ... max-w-[calc(100%-2rem)] sm:max-w-md`
  intactas en `Toast.tsx:126,128`. ✅
- Sin `console.log` de debug suelto: solo el `console.warn` legítimo y
  guarded (`AuthErrorHashListener.tsx:31-37`). ✅

---

## NITs no bloqueantes

1. **Disable-line removidos en lugar de agregados**: el spec §A pedía
   agregar los `// eslint-disable-next-line react-hooks/set-state-in-effect`
   encima de los 2 `setError` del efecto. El implementer los omitió
   porque ESLint no flagea (verificado con `init.sh full`). Aceptable;
   si la regla se vuelve más estricta en el futuro, el smoke + el
   comentario inline de 10 líneas dan suficiente contexto para
   re-agregarlos.

---

## Riesgos remanentes

- **Si en el futuro algo entre los dos mounts de StrictMode mutase
  `window.location.hash` ANTES de `replaceState`**, el patrón seguiría
  funcionando porque el ref captura el parse ANTES de cualquier
  side-effect (línea 78 antes que 84). Cubierto por diseño.
- **Si alguien refactoriza y elimina el `parsedRef` o cambia el orden
  de ramas en el effect**, vuelve el bug en dev. Mitigación: el
  comentario inline de 10 líneas + el smoke en `progress/smoke-tests.md`
  cuando el leader lo actualice tras el merge.
- **Mensajes de 2+ líneas con `items-center`**: ya documentado en spec
  §Cambio B como riesgo aceptado. Si emerge un call site así, se
  discute una variante en otra feature.

---

## Pendiente humano (smoke browser-based)

El implementer no pudo ejecutar el smoke manual (no tiene browser).
El humano debe correr los siguientes en el siguiente turno, tal cual
los describe el spec §Verificación → "Smoke manual del listener" y
"Smoke manual del primitivo Toast":

1. **Listener en `pnpm dev`**: 3 hashes positivos
   (`otp_expired`, `access_denied`, `potato` fallback) + 3 negativos
   (sin hash, `#new-in-market`, `#access_token=foo&type=signup`) +
   interacción (Escape, X, Back).
2. **Listener en `pnpm build && pnpm start`**: repetir el caso 1 para
   confirmar que el fix es inocuo en prod.
3. **`/dev/ui` sección Toast** (las 3 variants): verificar centrado
   vertical y `cursor: pointer` en hover del X.

Cuando estos smokes pasen verde, el leader debe actualizar
`progress/smoke-tests.md` sección `invite_error_landing`:

- Desmarcar los items que estaban como "FALLA en dev 2026-05-26".
- Quitar el header `> BLOQUEADOS por bug de StrictMode (ver feature
fix_auth_error_listener_and_toast_polish)` y dejar los 3 items
  destildados para que el humano los marque al ejecutar.
- Agregar los 2 nuevos items de los cambios B y C.
- Tachar o anotar como RESUELTOS los issues visuales (2) y (3) del
  bloque `> Issues visuales detectados en este smoke (2026-05-26)`.

(Detalle exhaustivo de qué tildar/destildar/agregar en el spec
§"Smoke tests post-implementación".)
