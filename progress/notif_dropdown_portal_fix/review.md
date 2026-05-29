# Review — fix portal NotificationsDropdown (containing-block backdrop-filter)

**Veredicto:** APPROVED

Fix de un solo archivo de producción: `src/components/notifications/NotificationsDropdown.tsx`.
Portaliza overlay+dialog a `document.body` y ancla el popover desktop por
`getBoundingClientRect` del trigger. Diff acotado, sin tocar lo que no debía.

## Checklist

- Tokens y colores: [x] — `border-divider`, `bg-surface`, `shadow-dropdown`,
  `bg-on-background/30`, `bg-background`, `bg-neutral-200/100` todos en
  `globals.css`. Cero hex, cero arbitrary colors nuevos. Los `[...]` que quedan
  son sizing/z-index preexistentes (`max-h-[80vh]`, `w-[22rem]`, `z-[1]`).
- Componentes y framework: [x] — ya era `'use client'`. `useLayoutEffect`,
  `matchMedia`, listeners de window y `createPortal` son legítimos en client
  component. Hooks declarados ANTES del early return → Rules of Hooks OK.
- Supabase: [x] — N/A, no toca data layer.
- Fidelidad visual: [x] — leader verificó en browser (375/900/1280px): anclaje
  correcto, overlay full-screen, popover coincide con el bell.
- Calidad: [x] — `pnpm lint` limpio (0 warnings). Sin `eslint-disable` ni
  `@ts-` escondidos (grep). Sin `console.log`. Comentarios en español, densidad
  coherente con el resto del archivo.

## Verificación punto por punto

1. Tokens: OK, ver arriba.
2. Client component / portal: OK.
3. `react-hooks/set-state-in-effect`: el `setDesktopPos` vive en `update()` y el
   `setIsDesktop` en `onChange()`; ambos invocados síncronamente en el effect.
   Lint pasa con el patrón "set vía callback nombrado" (mismo que el
   `setTimeout(fetchOnce, 0)` ya presente). Sin disable. No es deuda nueva.
4. SSR-safe: `if (typeof document === 'undefined') return null` tras TODOS los
   hooks. Sin riesgo de hydration mismatch: NotifBell monta el panel solo con
   `{isOpen && <NotificationsDropdown/>}` (post-click, post-hidratación).
   Confirmado en `src/components/nav/NotifBell.tsx:91`.
5. Cleanup: resize (L126), scroll (L127), matchMedia change (L139) removidos en
   los return de sus effects. OK.
6. No tocado: outside-click (L221-231), Escape (L206-215), polling (L159-203),
   overlay móvil (L371-377), firma de props (L30-41) intactos.
7. Comentarios en español, coherentes. OK.

## Nits (no bloqueantes)

- `isDesktop` arranca en `false`; en viewport ancho el dialog podría pintar un
  frame como bottom-sheet antes de que el effect de `matchMedia` lo voltee. El
  `useLayoutEffect` de posición + el `onChange()` síncrono lo minimizan y el
  leader no observó flash. Si en el futuro molesta, inicializar `isDesktop` con
  un lazy initializer (`useState(() => window.matchMedia(...).matches)`) lo
  elimina — opcional.
