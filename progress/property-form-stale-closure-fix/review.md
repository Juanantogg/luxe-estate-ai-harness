# Review — fix stale closure en PropertyForm.submit

**Veredicto:** APPROVED

## Contexto

Bugfix puntual (no feature): `submit` (useCallback) capturaba una `doSubmit`
no memoizada de un render viejo con `state.values` stale, y silenciaba la
advertencia con `eslint-disable react-hooks/exhaustive-deps`. En edición, al
cambiar solo `values` sin tocar imágenes, `updateProperty` recibía los valores
originales.

## Fix verificado

1. `doSubmit` → `useCallback` con deps `[state.values, state.images, mode, initial, router, startTransition]`. Movida antes de `submit`.
2. `submit` deps actualizadas a `[hasUploading, hasErrors, state.images, doSubmit]`.
3. Eliminados ambos `eslint-disable-next-line react-hooks/exhaustive-deps`.

## Checklist

- Tokens y colores: [x] No aplica (sin cambios de markup/clases); no se introdujo ningún hex.
- Componentes y framework: [x] Archivo ya era `'use client'` (form interactivo, correcto). Sin deps nuevas.
- Supabase: [x] No aplica (mutaciones siguen en server actions `createProperty`/`updateProperty`).
- Fidelidad visual: [x] No aplica (sin cambios visuales).
- Calidad: [x] `pnpm lint` limpio, `pnpm type-check` limpio.

## Verificaciones detalladas

- **`grep exhaustive-deps`**: sin coincidencias. ✓
- **Deps de `doSubmit` (L192-273)**: el cuerpo usa `state.values`, `state.images`,
  `mode`, `initial` (`initial!.id`), `router`, `startTransition`. `createProperty`/
  `updateProperty` son imports estables; `setPhase`/`dispatch` estables. Lista
  COMPLETA y correcta. ✓
- **Deps de `submit` (L275-291)**: usa `hasUploading`, `hasErrors`, `state.images`,
  `doSubmit`. `setShowPartialUploadDialog` estable. Lista COMPLETA. ✓
- **Handlers análogos**: `handleFieldChange`, `handleToggleAmenity`,
  `handleImagesChange` solo usan `dispatch` (estable de `useReducer`) → deps `[]`
  correctas, sin patrón de stale closure. ✓
- **Firma preservada**: `doSubmit(submitMode, dropErrors = false)` (L193) intacta;
  `PartialUploadDialog.onContinueWithout` (L396) la invoca como `doSubmit(m, true)`. ✓
- **Sin debug nuevo**: el único `console.warn` (L262) ya existía en el `doSubmit`
  original dentro del `catch`; es manejo de error legítimo, no debug suelto. Sin
  `console.log`/`console.debug`. ✓

## Cambios requeridos

Ninguno.
