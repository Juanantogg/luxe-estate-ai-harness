# Design spec — fix_auth_error_listener_and_toast_polish

> Feature `requires_approval: false`. Bundle de 3 fixes sobre código
> ya entregado por `invite_error_landing`. Sin cambios de API, sin
> migraciones, sin nuevos componentes. Solo 2 archivos tocados.

## Contexto

Tres issues detectados en smoke test 2026-05-26 sobre el primitivo
`Toast` y su único listener:

- **(A) Bug funcional**: `AuthErrorHashListener` limpia la URL pero NO
  muestra el toast en `pnpm dev`. Causa: React 19 + StrictMode monta
  el efecto 2 veces; el primer mount limpia el hash y programa el
  `setError` con `setTimeout(_, 0)`; el cleanup lo cancela; el segundo
  mount ya no encuentra hash y sale temprano.
- **(B) Visual**: el ícono y el texto del Toast lucen desalineados
  verticalmente con `items-start + mt-0.5`.
- **(C) UX**: el botón X del Toast no muestra `cursor-pointer` en hover
  — incoherente con la convención del repo.

## Archivos a modificar

- `src/components/auth/AuthErrorHashListener.tsx` — cambio A.
- `src/components/ui/Toast.tsx` — cambios B y C.

NO crear archivos. NO tocar call sites (`VisitScheduler`,
`ResendInvitationButton`, `ChangeEmailDialog`). NO tocar la página
`/dev/ui`. NO migración SQL. NO regenerar types.

---

## Cambio A — `AuthErrorHashListener.tsx`

### Approach: `useRef` como side-channel entre mounts de StrictMode

Reemplazar el `setTimeout(setError, 0)` por un `useRef<ParsedError |
null>(null)` que captura el resultado del parse en el primer mount.
En cada corrida del efecto: si el ref tiene valor → llamar `setError`
con él (síncrono, sin setTimeout). Si no: parsear hash, limpiar URL,
guardar en ref, llamar `setError`. Como el efecto vuelve a correr en
el segundo mount de StrictMode, encuentra el ref poblado y dispara
`setError` aunque la URL ya esté limpia.

### Diff conceptual

Estado actual (líneas 53-87) — flujo `useEffect`:

1. `parsed = parseHash(window.location.hash)`
2. Si null → return
3. `replaceState` para limpiar URL
4. `setTimeout(() => setError(parsed), 0)` + cleanup `clearTimeout`

Estado nuevo:

1. **Fuera del effect, en el cuerpo del componente**: declarar
   `const parsedRef = useRef<ParsedError | null>(null);`
2. **Dentro del effect**:
   - Si `parsedRef.current !== null` → `setError(parsedRef.current)`;
     return (NO leer hash, NO replaceState — ya se hicieron en mount 1).
   - Si no:
     - `const parsed = parseHash(window.location.hash);`
     - Si null → return (caso real: hash vacío o sin `error=`).
     - `parsedRef.current = parsed;` (guardar antes de cualquier
       side-effect para que el segundo mount lo vea).
     - `window.history.replaceState(...)` para limpiar URL (mantener
       la garantía actual: limpia ANTES del primer paint del toast,
       sin pushState → back-button no vuelve al hash).
     - `setError(parsed);` (síncrono, sin setTimeout).
   - **Sin cleanup que cancele nada**: el ref persiste entre mounts
     por diseño; no hay timer que limpiar.
3. **Dependencias**: `[]` (igual que hoy).

### Sobre el lint `react-hooks/set-state-in-effect`

El `setError(parsed)` síncrono dentro del effect es exactamente lo
que la regla reporta. La regla **es justificable de desactivar acá**
porque el state SOLO se setea cuando `parseHash` retorna no-null
(condicional → no es un setState incondicional que genere un render
extra para cada paint). El comentario inline justifica.

**Implementer**: agregar comentario `// eslint-disable-next-line
react-hooks/set-state-in-effect` justo encima de cada llamada a
`setError` dentro del efecto (son 2: una en cada rama). Cada una con
una línea de contexto en el bloque comentado arriba del effect (ver
abajo).

### Comentario inline requerido (encima del `useEffect`)

```
// React 19 + StrictMode monta este efecto dos veces en dev. El primer
// mount lee `window.location.hash`, lo parsea, limpia la URL con
// `replaceState` y guarda el resultado en `parsedRef`. El segundo
// mount encuentra el hash YA limpio — sin el ref, `parseHash` retorna
// null y el toast nunca aparece. El ref sobrevive entre mounts
// (useRef preserva su valor) y dispara `setError` en cualquier
// corrida posterior. `setError` se llama síncrono (sin setTimeout)
// porque la condición previa garantiza que solo corre cuando hay
// algo que mostrar — el warn de `react-hooks/set-state-in-effect`
// queda silenciado inline.
```

### Lo que NO cambia

- Firma del componente, props, exports, JSX devuelto.
- Mapa `COPY`, `parseHash`, `ParsedError`, `AUTO_DISMISS_MS`.
- El `console.warn` de debug en non-production.
- El componente sigue siendo Client primitivo con `useState` local
  (sin provider, sin context).

### Verificación local del fix (manda al implementer)

- `pnpm dev` y abrir
  `http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=test`
  → debe aparecer toast warning + URL queda en `http://localhost:3000/`.
- `pnpm build && pnpm start` y repetir lo mismo. **El implementer debe
  verificar también prod**: el bug puede o no reproducirse en prod
  (StrictMode no aplica), pero la solución con `useRef` es inocua en
  prod (un único mount → ref se llena y se usa una sola vez). Reportar
  el resultado de prod en el commit/PR.

---

## Cambio D — `Toast.tsx` contraste (hot-fix smoke browser 2026-05-27)

### Contexto

Tras la primera implementación, el smoke en browser detectó que el toast
warning luce muy transparente sobre la home (`AuthErrorHashListener` se
monta en `/` y se superpone al hero con foto de propiedad). Causa: los
tokens `bg-*-soft` son rgba con alpha 0.12 — al pintar sobre una imagen
clara se diluyen casi a invisible, y el `text-*` saturado tampoco
contrasta lo suficiente.

### Diff exacto

En `VARIANT_STYLES` (líneas 44-69), cambiar las 3 variants:

- `bg: 'bg-success-soft'` → `bg: 'bg-success'`
- `bg: 'bg-warning-soft'` → `bg: 'bg-warning'`
- `bg: 'bg-danger-soft'` → `bg: 'bg-danger'`
- `text: 'text-success'` → `text: 'text-on-primary'`
- `text: 'text-warning'` → `text: 'text-on-primary'`
- `text: 'text-danger'` → `text: 'text-on-primary'`

`ring` (focus visible) se mantiene saturado para que el outline sea
detectable contra el fondo del propio toast.

### Por qué `text-on-primary` y no `text-white` directo

`--color-on-primary: #ffffff` es el token canónico del sistema para
"texto sobre fondo saturado". El nombre liga el contraste al sistema
(si en el futuro el fondo se oscurece o se invierte el modo, el token
se actualiza en un solo lugar). Cero hex en JSX, regla AGENTS.md.

### Lo que sigue intacto

API del primitivo, defaults, posición, `ring`, alineación (cambio B
queda firme), cursor (cambio C queda firme), call sites.

---

## Cambio B — `Toast.tsx` alineación vertical

### Diff exacto

**Línea 126** (className del contenedor `<div>` del toast): cambiar
`items-start` → `items-center`.

Antes:

```
'fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-start gap-2',
```

Después:

```
'fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2',
```

**Línea 133** (className del `<Icon>` del mensaje): quitar `mt-0.5`.

Antes:

```tsx
<Icon name={iconName} size="sm" className="mt-0.5 shrink-0" />
```

Después:

```tsx
<Icon name={iconName} size="sm" className="shrink-0" />
```

### Resultado esperado

En mensajes de 1 línea (caso típico de los 4 call sites actuales:
`AuthErrorHashListener`, `VisitScheduler`, `ResendInvitationButton`,
`ChangeEmailDialog`/`EmailChangedFlash`), el ícono del variant, el
texto del mensaje y el botón close quedan centrados verticalmente
respecto al eje horizontal del toast.

### Riesgo aceptado (R6 §8 del spec original)

Mensajes de 2+ líneas: con `items-center` el ícono queda visualmente
en el medio del bloque de texto. Aceptable porque:

- Los 4 call sites actuales pasan mensajes de 1 línea. El más largo
  es `'El link de invitación expiró. Pídele al admin que te envíe
uno nuevo.'` — verificado en `/dev/ui` envuelve a 2 líneas solo
  en viewports < 400px, donde `items-center` sigue siendo aceptable
  (queda mejor que `items-start + mt-0.5`, que se ve flotando).
- Si en el futuro emerge un call site con mensajes consistentemente
  de 2+ líneas, se discute una variante (p. ej. prop `align="start"`)
  en esa feature, no en este fix.

### Lo que NO cambia

- API del primitivo (`ToastProps`), defaults, variantes, posición.
- `VARIANT_STYLES`, `role`/`aria-live`, auto-dismiss, Escape handler.
- Tipografía del mensaje (`text-sm leading-snug font-medium`).
- Tokens, hex, colores.

---

## Cambio C — `Toast.tsx` cursor del botón X

### Diff exacto

**Líneas 140-144** (className del `<button>` close): agregar
`cursor-pointer` al primer string del `cn(...)`.

Antes:

```tsx
className={cn(
  'ml-1 shrink-0 rounded p-0.5 transition-opacity hover:opacity-70',
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
  styles.ring,
)}
```

Después:

```tsx
className={cn(
  'ml-1 shrink-0 cursor-pointer rounded p-0.5 transition-opacity hover:opacity-70',
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
  styles.ring,
)}
```

### Justificación de la convención

Verificado en repo: `cursor-pointer` está en uso explícito en
`Card.tsx`, `PropertyGallery.tsx`, `GallerySection.tsx`,
`AmenityChipGroup.tsx`, `DashboardFilters.tsx`, `ArchivedToggle.tsx`,
`NotificationsToggle.tsx`, `ProfileAvatarEditor.tsx`, entre otros.
El estándar del repo es: botones no-form / elementos interactivos
sin role="button" implícito usan la utility para hacer evidente la
interacción al hover (Tailwind 4 NO lo agrega por default en
`<button>`).

---

## Decisiones

### Opción 1 (useRef) vs Opción 2 (setState síncrono sin ref)

**Elegida: Opción 1 (useRef).** Razones:

1. **Resuelve la causa raíz, no el síntoma**: el bug es que el
   segundo mount de StrictMode pierde el `ParsedError` parseado (la
   URL ya se limpió). Cualquier solución que solo cambie el timing
   del `setError` (Opción 2) sigue dependiendo de que el hash esté
   presente cuando el effect corre. Si en el futuro algo más altera
   `window.location.hash` entre los dos mounts (no es escenario hoy,
   pero es plausible con un middleware client-side futuro), Opción 2
   se rompe; Opción 1 no.

2. **Idempotente y barato**: `useRef` es una asignación O(1) y el
   `setError(parsedRef.current)` del segundo mount es no-op si el
   state ya tenía ese valor (React deduplica). No hay re-render
   extra ni timer huérfano.

3. **El precedente del repo (`NotificationsDropdown`/`NotifBell`/
   `EmailChangedFlash`) usa `setTimeout(_, 0)` para evitar el lint
   warn**, no para resolver un bug de StrictMode. Esos componentes
   no tienen el problema porque sus efectos no dependen de leer
   `window.location` (leen state derivado de props/cookies que NO
   se mutan entre mounts). Aplicar ese patrón acá no resuelve nada;
   el setTimeout es exactamente lo que el cleanup cancela.

4. **Opción 2 todavía requiere el comentario de disable-lint** porque
   `setError(parsed)` directo en el effect viola la regla igual.
   Opción 1 también lo requiere — empate en este criterio.

5. **Legibilidad**: el comentario inline de 8 líneas hace la subtleza
   explícita. Un reviewer que lea el archivo entiende por qué el
   ref está ahí. Es mejor escribir 8 líneas de prosa que confiar en
   que el próximo dev recuerde el contrato de StrictMode.

**Riesgo de Opción 1**: si alguien refactoriza el componente y olvida
el ref, vuelve el bug en dev. Mitigación: el comentario inline lo
documenta + el smoke test del listener queda en `progress/smoke-tests.md`
como guard manual.

### Por qué NO `flushSync` ni `startTransition`

Opciones consideradas y descartadas. `flushSync` fuerza render
síncrono pero NO ayuda con el problema (el primer mount ya hace
flushSync efectivamente con `setError`, lo que se cancela es el
timer, no el state). `startTransition` hace lo opuesto (diferir),
empeora. Ambas se descartan sin más análisis: no atacan la causa.

---

## Verificación

### Automatizada (implementer + reviewer)

- [ ] `pnpm lint` pasa (incluye el eventual disable-line de
      `react-hooks/set-state-in-effect`).
- [ ] `pnpm type-check` pasa.
- [ ] `pnpm build` pasa (incluyendo la pre-render de la home).

### Smoke manual del listener (implementer corre antes del commit)

1. `pnpm dev` arriba.
2. Pestaña limpia (sin caché, sin hash previo): abrir
   `http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=test`.
3. Verificar:
   - Aparece toast warning con texto "El link de invitación expiró.
     Pídele al admin que te envíe uno nuevo.".
   - URL queda en `http://localhost:3000/` (sin hash).
   - Tras ~6s el toast se cierra solo.
4. Repetir con
   `http://localhost:3000/#error=access_denied&error_code=access_denied&error_description=Unauthorized`
   → toast con copy `access_denied`.
5. Repetir con
   `http://localhost:3000/#error=server_error&error_code=potato&error_description=test`
   → toast con copy fallback.
6. Negativos (no debe haber toast):
   - `http://localhost:3000/` (sin hash).
   - `http://localhost:3000/#new-in-market` (hash de nav interna).
   - `http://localhost:3000/#access_token=foo&type=signup` (hash de
     auth ok).
7. Interacción sobre el caso 2:
   - Presionar Escape antes de 6s → cierra inmediato.
   - Click X → cierra inmediato.
   - Back del browser → navega a la página previa (NO al hash).
8. **Repetir paso 2 en `pnpm build && pnpm start`** y reportar
   resultado en el commit/PR: si el bug ya no existía en prod, el
   fix con useRef sigue siendo inocuo; si existía, el fix lo cubre.

### Smoke manual del primitivo Toast (implementer corre antes del commit)

9. `pnpm dev` arriba (o re-usar la sesión del paso 1).
10. Abrir `http://localhost:3000/dev/ui`.
11. Localizar la sección "Toast" con las 3 variants (success / warning
    / danger).
12. Verificar visualmente:
    - Ícono + texto + botón X alineados centrados verticalmente
      (eje horizontal del toast pasa por el medio del ícono y el
      medio del texto).
    - Hover sobre cualquier botón X → el cursor cambia a `pointer`
      (no `default`).
13. Tab al botón X de cada variant → ring focus visible con el color
    del variant (regresión: este test ya pasaba en el smoke 2026-05-26;
    re-validar que no se rompió con el cambio de alineación).

---

## Fuera de scope

- **`AuthErrorHashListener` fuera de `/`**: no se monta en otras
  rutas. Solo en `src/app/(app)/page.tsx`. No tocar.
- **API/props del primitivo `Toast`**: sin cambios en `ToastProps`,
  variants, defaults (`autoDismissMs=4000`, `dismissible=true`),
  position (`fixed bottom-20 left-1/2 -translate-x-1/2`).
- **Call sites del primitivo**: `VisitScheduler.tsx`,
  `ResendInvitationButton.tsx`, `ChangeEmailDialog.tsx`,
  `EmailChangedFlash.tsx`. Ninguno se toca; los 3 cambios son
  transparentes para los consumidores (alineación visual + cursor
  del X aplican parejo a todos).
- **Stack/animación de toasts**: las future works documentadas en
  §A.10 del spec original (`invite_error_landing`) siguen siendo
  future work. No se aborda acá.
- **Suspense en el page que monta el listener**: D2 cerrada en el
  spec original; no se reabre.
- **Migraciones SQL, types, queries, Server Actions**: ninguna se
  toca.

---

## Smoke tests post-implementación

Una vez mergeado, el leader debe actualizar `progress/smoke-tests.md`
sección `invite_error_landing`:

### A desmarcar (pasar de "FALLA en dev 2026-05-26" a checkable)

- "Navegar a `http://localhost:3000/#error=access_denied&error_code=otp_expired...`
  → aparece toast warning ... → URL queda limpia → toast desaparece
  a los ~6s." (línea ~194 del archivo)
- "Navegar a `...&error_code=access_denied...` → toast 'El link ya
  fue usado o no es válido...'." (línea ~199)
- "Navegar a `...&error_code=potato...` → toast con copy fallback."
  (línea ~202)

### A desbloquear (sección "Listener — interacción", líneas ~217-224)

Hoy con header `> BLOQUEADOS por bug de StrictMode (ver feature
fix_auth_error_listener_and_toast_polish). Re-ejecutar tras el fix.`

- "Test 1 + pulsar Escape antes de 6s → toast cierra inmediatamente."
- "Test 1 + clickear botón X → toast cierra inmediatamente."
- "Test 1 + Back del browser después del toast → navega a la página
  previa..."

El leader debe **eliminar el header de BLOQUEADOS** y dejar los 3
items destildados para que el humano los marque al ejecutar.

### A agregar (nuevos por los cambios B y C)

- "`/dev/ui` sección Toast: las 3 variants tienen ícono + texto +
  botón X centrados verticalmente (eje horizontal pasa por el medio
  del ícono)." → corresponde al cambio B.
- "`/dev/ui` sección Toast: hover sobre el botón X muestra cursor
  pointer en las 3 variants." → corresponde al cambio C.

### Sobre los issues visuales del smoke 2026-05-26

El bloque `> Issues visuales detectados en este smoke (2026-05-26):`
en `smoke-tests.md` líneas 246-253 enumera los issues (2) y (3) que
este fix resuelve. El leader puede tacharlos con `~~strikethrough~~`
preservando la nota de origen, o agregar una línea
`> RESUELTOS por fix_auth_error_listener_and_toast_polish (cerrada YYYY-MM-DD).`
debajo del bloque.
