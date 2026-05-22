# Review — ui_primitives

**Decisión:** APROBADO

## Resumen

La implementación cubre los 8 componentes con las variantes, sizes y estados
definidos en el spec, respeta las 5 decisiones humanas del 2026-05-21
(deps clsx+tailwind-merge, 4 tokens soft, Avatar Client Component, sin
`asChild`, carga de iconos vía `<link>`) y pasa lint + type-check + build.
La página `/dev/ui` queda como Server Component con guard de `notFound()`
y se omite del build de producción correctamente. Cero hex literales en
JSX y cero `any` en TypeScript.

## Checklist

### Cumplimiento del spec

- [x] Los 8 componentes existen y exponen props del spec (Button, IconButton, Input, Chip, Avatar, Badge, Card, Icon).
- [x] `Button` y `Card` **no** exponen `asChild` (`grep asChild` vacío).
- [x] `Avatar.tsx:1` lleva `'use client'`.
- [x] Resto de componentes son Server-compatible (no `"use client"`).
- [x] `forwardRef` presente en Button, IconButton, Input, Chip, Card, Icon. Avatar y Badge no envuelven nodo nativo con ref expuesta (Avatar es `function` por requerir `useState`, Badge es `<span>` decorativo; ambos consistentes con el spec).
- [x] `Icon` selecciona `material-icons` vs `material-symbols-outlined` según `variant` (Icon.tsx:37).
- [x] `Input` con `error` pinta `border-danger` + `aria-invalid` + `<p>` con mensaje (Input.tsx:76-103).
- [x] `Avatar` implementa fallback cascada: img (onError → state) → iniciales → `<Icon name="person">` (Avatar.tsx:109-130).

### Convenciones duras

- [x] **Cero hex literales en JSX**: `grep -rEn "#[0-9a-fA-F]{3,8}" src/components/ui/ src/app/dev/` → vacío.
- [x] **Cero arbitrary values con hex** (`bg-[#...]`, etc.) en JSX.
- [x] `className` siempre combinada con `cn()` en todos los componentes.
- [x] Cero `any` en TypeScript; tipos union/const para variantes y sizes.
- [x] Cada componente exporta su interfaz `Props` y los union types (index.ts:1-32).
- [x] JSDoc con descripción + `@example` en cada componente.

### Tokens y diseño

- [x] Los 4 tokens soft en `globals.css:70-74` con los valores exactos del spec.
- [x] Variantes usan tokens semánticos correctos (e.g. Badge.warning → `bg-warning-soft text-warning border-warning/20`).
- [x] Focus-visible con `ring-primary` + `ring-offset` en Button, IconButton, Chip, Card.
- [x] Inter como fuente única (layout.tsx:5-9); no se introdujeron otras tipografías.

### Página /dev/ui

- [x] Server Component (no `"use client"` en page.tsx).
- [x] `if (process.env.NODE_ENV === 'production') notFound();` en page.tsx:90.
- [x] Import de `notFound` desde `next/navigation` (page.tsx:1).
- [x] Renderiza secciones para los 8 componentes con su matriz.
- [x] Layout `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16` (page.tsx:93).

### Carga de iconos

- [x] `<link>` a Material Icons en layout.tsx:26-29.
- [x] `<link>` a Material Symbols Outlined en layout.tsx:31-34.
- [x] `<link rel="preconnect">` a googleapis.com y gstatic.com en layout.tsx:24-25.

### Health checks

- [x] `pnpm lint` → OK.
- [x] `pnpm type-check` → OK.
- [x] `pnpm build` → OK (5 páginas generadas, sin warnings).
- [x] `./init.sh full` → "✓ Verificación completa pasó".

## Issues encontrados

Ninguno bloqueante. Anotaciones menores (no impiden merge):

- **NIT** — `Badge.tsx`: el componente acepta `leadingIcon` pero el spec menciona también `withDot` antes del texto. Ambos están implementados pero si el caller pasa los dos a la vez, el orden visual queda `dot → icon → texto`. Es coherente, solo lo dejo como nota de uso esperada.
- **NIT** — `Chip.tsx:73`: cuando `asStatic={true}` el `<span>` recibe `aria-disabled` pero no propaga `rest` props (no se hereda `className` extra fuera del compuesto). Consistente con el spec que dice "renderiza `<span>` no `<button>`"; no es un fallo.
- **MEJORA** — `Avatar.tsx:139`: el `aria-label="Estado: ${status}"` está en español pero los valores (`online`/`away`/`offline`) son los keys ingleses. Si se quiere full i18n del aria, podría mapearse a `en línea`/`ausente`/`desconectado`. No bloqueante.

## Desviaciones evaluadas

### 1. `eslint-disable-next-line @next/next/no-page-custom-font` en `layout.tsx:30`

**Justificación del implementer:** falso positivo de la regla porque está pensada para el Pages Router; en App Router cargar fuentes-icono (Material Icons) via `<link>` es legítimo, y `next/font/google` no soporta el CSS de glyphs/ligatures de Material.

**Veredicto:** ACEPTADO. La regla `@next/next/no-page-custom-font` apunta a `<head>` en `_document.tsx` (Pages Router); el spec del designer ya documentó que `next/font` no aplica para fuentes-icono. La alternativa (self-host) está fuera de scope MVP y ya está anotada como riesgo #9 en el design.md.

### 2. `eslint-disable-next-line @next/next/no-img-element` en `Avatar.tsx:110`

**Justificación del implementer:** `next/image` no expone un handler `onError` accesible para el fallback automático que el humano aprobó (decisión 3 del 2026-05-21).

**Veredicto:** ACEPTADO. La decisión 3 aprobó Avatar como Client Component con `useState + onError`; este patrón requiere `<img>` nativo porque `next/image` con `onError` perdería la optimización del componente y bloquearía el fallback síncrono. Es trade-off consciente, no atajo.

## Conclusión

Se puede mergear y marcar la feature como `done`. Cumple los criterios de
aceptación del `feature_list.json`, respeta las 5 decisiones humanas del
spec aprobado, pasa `./init.sh full`, y no introduce regresiones de
convenciones (cero hex, cero any, tokens semánticos, Inter única).

El leader puede:

1. Pedir commit + marcar `ui_primitives` como `done` en `feature_list.json`.
2. Desbloquear las features que dependen: `app_shell`, `login_screen`, `property_management_dashboard`, `admin_user_directory`.
