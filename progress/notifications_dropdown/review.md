# Review — notifications_dropdown

**Veredicto:** APPROVED WITH NITS

Implementación que cumple los 8 acceptance criteria + las 13 decisiones del spec. Cero hex literales en JSX, tokens válidos, RLS respetado, Server Actions con `ok/error` y zod, derive.ts módulo neutro. `pnpm lint` y `pnpm type-check` pasan. Hay 4 NITs no bloqueantes (ninguno funcional).

---

## Acceptance criteria — verificación ítem por ítem

| #   | Acceptance                                                                | Estado                            | Evidencia                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Client Component `src/components/notifications/NotificationsDropdown.tsx` | OK                                | `src/components/notifications/NotificationsDropdown.tsx:1` con `'use client'`.                                                                                                                                                                      |
| AC2 | Trigger: el botón de notif badge del TopNav                               | OK                                | `NotifBell.tsx:71-91` renderiza el botón actual + popover sin tocar `TopNav`.                                                                                                                                                                       |
| AC3 | Popover con max-h-96 scrollable, max-w-sm                                 | OK (interpretado)                 | `NotificationsDropdown.tsx:307` usa `sm:max-h-[28rem] sm:w-[22rem] sm:max-w-sm`. `max-h-[28rem]` = 448px (>96 default). Mobile = bottom-sheet (D8). Aceptable por D8 del spec.                                                                      |
| AC4 | Item por notification: ícono según type, title, body, time relativo       | OK                                | `NotificationItem.tsx:55-77`, derive `getNotificationIcon` (`derive.ts:20-22`), `formatRelativeTime` (`relative-time.ts:30-63`).                                                                                                                    |
| AC5 | Unread: bg-mosque/5 + dot a la izquierda                                  | OK (con desvío menor justificado) | `NotificationItem.tsx:43,52` usa `bg-primary-soft` (`mosque` con opacidad 10%, no 5%). El spec §5 dice `bg-primary-soft` (10%), no `mosque/5`. Es un desvío del feature_list AC original aceptado en el spec — `primary-soft` es el token canónico. |
| AC6 | Server Action `markAsRead(id)` / `markAllAsRead()`                        | OK                                | `actions.ts:35-63` y `actions.ts:71-93`. Devuelven `{ok}/{ok,error}` con zod.                                                                                                                                                                       |
| AC7 | Empty state: "No tienes notificaciones"                                   | OK                                | `EmptyNotifications.tsx:14`.                                                                                                                                                                                                                        |
| AC8 | Realtime opcional / polling 30s                                           | OK                                | `NotificationsDropdown.tsx:53,109-148` polling 30s + pausa `document.hidden`. No Realtime (D1).                                                                                                                                                     |

---

## Decisiones cerradas (D1–D13)

| #   | Decisión                                                                       | Estado | Evidencia                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Polling 30s, NO Realtime, pausa en `document.hidden`                           | OK     | `NotificationsDropdown.tsx:125-134` `onVisibilityChange`. `POLL_INTERVAL_MS = 30_000`.                                                                                   |
| D2  | Buckets Hoy / Esta semana / Anteriores                                         | OK     | `derive.ts:71-84` + `NotificationsDropdown.tsx:46-50` (`BUCKET_LABEL`) + 212-224 (agrupación).                                                                           |
| D3  | Tipos sin destino útil siguen visibles, click solo marca leído                 | OK     | `derive.ts:47-58` retorna `null` para `system`/`new_message`. `NotificationsDropdown.tsx:243-245` `if (item.href) router.push(...)`.                                     |
| D4  | Badge dot rojo del TopNav sin número                                           | OK     | `NotifBell.tsx:85-90` dot `bg-danger`, sin contador.                                                                                                                     |
| D5  | NotifBell se reemplaza por Client manteniendo firma `(unreadCount, className)` | OK     | `NotifBell.tsx:8-12` y 32. TopNav (`TopNav.tsx:228`) lo llama sin cambios.                                                                                               |
| D6  | Origen lista: route handler GET; mutaciones Server Actions                     | OK     | `src/app/api/notifications/recent/route.ts:23-48` y `actions.ts`.                                                                                                        |
| D7  | `formatRelativeTime` propio, sin `date-fns`                                    | OK     | `src/lib/format/relative-time.ts`. Cubre los 6 casos.                                                                                                                    |
| D8  | Bottom-sheet mobile / popover sm+                                              | OK     | `NotificationsDropdown.tsx:295-308` clases responsive con `animate-in slide-in-from-bottom` y `sm:slide-in-from-top-2`.                                                  |
| D9  | Optimistic UI en `markAsRead` sin revert ante error                            | OK     | `NotificationsDropdown.tsx:226-254`. Sin try/catch porque es fire-and-forget; `void markAsRead(item.id)` línea 250.                                                      |
| D10 | Self-protection vía RLS + zod uuid                                             | OK     | `actions.ts:27` zod uuid. Update sin `recipient_id` en `markAsRead` confía en RLS (correcto). `markAllAsRead` adiciona `eq('recipient_id', user.id)` (defense-in-depth). |
| D11 | Polling pausa en `document.hidden`                                             | OK     | `NotificationsDropdown.tsx:125-134`.                                                                                                                                     |
| D12 | RLS ya OK, no migración nueva                                                  | OK     | No hay migración nueva en `git status`.                                                                                                                                  |
| D13 | `/messages/[id]` no existe — `new_message` solo marca leído                    | OK     | `derive.ts:47-51` con TODO inline.                                                                                                                                       |

---

## Reglas duras (AGENTS.md)

- [x] **Cero hex literales en JSX.** `rg "#[0-9a-fA-F]{3,8}"` en archivos creados/modificados devolvió cero matches.
- [x] **Server Components por defecto.** `'use client'` solo en `NotifBell.tsx`, `NotificationsDropdown.tsx`, `NotificationItem.tsx`, `NotificationsHeader.tsx`. `EmptyNotifications.tsx` y `derive.ts` / `queries.ts` / `types.ts` / `index.ts` / `relative-time.ts` son **neutrales** (correcto: `derive` es consumido tanto por el route handler como por el dropdown client).
- [x] **`'use server'`** solo en `actions.ts:1`.
- [x] **`params` / `searchParams` / `cookies()` / `headers()`** N/A (route handler `GET` sin params; `createClient()` server ya maneja cookies async).
- [x] **Mobile-first.** Base = bottom-sheet (`fixed inset-x-0 bottom-0 z-50`), `sm:` cambia a popover. Las clases sm+ agregan complejidad, no la base.
- [x] **Textos en español directamente en JSX.** "Notificaciones", "Marcar todas como leídas", "No tienes notificaciones", "Cerrar notificaciones", "Inicia sesión.", "Identificador inválido.", "ahora", "hace N min", "ayer", "Hoy", "Esta semana", "Anteriores".
- [x] **Server Actions devuelven `{ok}/{ok,error}` con zod.** `actions.ts:27,35-63,71-93`. `markAsRead` valida zod; `markAllAsRead` no necesita validación (no recibe input).
- [x] **No dependencias nuevas.** Helper propio (`relative-time.ts`), `cn` ya existente, `zod` ya existente.
- [x] **RLS.** `queries.ts:27` (`eq('recipient_id', userId)` defense-in-depth) + RLS de mig 0009. `markAsRead` confía solo en RLS (correcto por D10). `markAllAsRead` adiciona `eq('recipient_id', user.id)` (defense-in-depth).
- [x] **Sin `service_role`** en código del cliente — todas las acciones server usan `createClient()` con cookies.

---

## Decisiones del implementer (6 items)

### 1. Sync prop→local en `NotifBell` con `setState` durante render

`NotifBell.tsx:46-51`. Patrón "derived state from props" con guard `if (initialUnreadCount !== lastSeenInitial)`. Comentario inline justifica el patrón y explica por qué evita el bucle (React deduplica setState con mismo valor; la condición evita re-disparos cuando la prop no cambia). El lint pasa (`react-hooks/set-state-in-effect` no se viola porque no hay `useEffect`).

**Verificación de bucle infinito**: la condición `initialUnreadCount !== lastSeenInitial` evita re-render porque tras `setLastSeenInitial(initialUnreadCount)`, en el próximo render `lastSeenInitial === initialUnreadCount`. **OK**.

**NIT 1**: el patrón es válido, pero un `useEffect` con dep `[initialUnreadCount]` sería más legible y la regla `react-hooks/set-state-in-effect` (que es lo que el implementer cita) en realidad permite `setState` dentro de `useEffect` cuando es respuesta a un cambio externo. La razón real de no usar effect es evitar el flash de un render con el valor viejo. Aceptable; no bloqueante.

### 2. `setTimeout(fetchOnce, 0)` para el fetch inicial

`NotificationsDropdown.tsx:139`. Justificado en comentario inline: "fuera del effect síncrono para no violar `react-hooks/set-state-in-effect`". `fetchOnce` setea estado, y la regla penaliza llamar setState síncronamente en la primera ejecución del effect.

**NIT 2 (no bloqueante)**: `useTransition` o un patrón con flag (`if (!hasFetched.current)`) sería más idiomático. Pero el código actual es funcionalmente correcto y el cleanup en línea 144 (`if (initialTimeout) clearTimeout(initialTimeout)`) previene leaks si el panel se cierra antes del tick 0. Aceptable; quizá refactorizar en el futuro.

### 3. `triggerRef` pasado al dropdown, click-fuera excluye el trigger

`NotificationsDropdown.tsx:166-176`. El handler `onPointerDown` chequea `dialogRef.current?.contains(target)` y `triggerRef.current?.contains(target)` antes de cerrar. **OK**. Cuando el user hace click en el bell estando abierto, el listener de `mousedown` se ejecuta pero retorna porque el target está dentro del trigger; luego el `onClick` del botón hace `setIsOpen(v => !v)` que cierra. Correcto.

### 4. `forwardRef<HTMLButtonElement>` en NotificationItem

`NotificationItem.tsx:30-82`. Forward correcto. El primer item recibe `ref={firstItemRef}` (`NotificationsDropdown.tsx:337`); los demás reciben `ref={null}` que React acepta sin warning. **OK**.

### 5. Bucket headers `sticky top-0 z-[1]`

`NotificationsDropdown.tsx:326`. El `sticky` del bucket vive **dentro** del scrollable (`<div className="flex-1 overflow-y-auto">`). El `NotificationsHeader` sticky (z-10) vive **fuera** del scrollable, en el `<div ref={dialogRef}>` que es `flex flex-col`. Son dos contextos sticky independientes. No hay conflicto de z con el header global del TopNav porque ambos sticky están confinados al panel/scrollable.

**Nota**: el bucket header con `bg-background` cubre items unread (`bg-primary-soft`) al scrollear. Funciona correctamente.

### 6. `NotificationsHeader sticky top-0`

`NotificationsHeader.tsx:30`. Sticky con `z-10` dentro del `flex flex-col` del dialog root. Como el flex hace que `<NotificationsHeader>` siempre esté visible (no es parte del scrollable), el sticky es prácticamente redundante pero inofensivo. **OK**.

---

## Edge cases

- [x] `unreadCount === 0` → botón "Marcar todas" disabled. `NotificationsHeader.tsx:27` + `NotificationsDropdown.tsx:257` retorna temprano.
- [x] Lista vacía → muestra `EmptyNotifications`, NO el header de bucket. `NotificationsDropdown.tsx:281,320-321` (`showEmpty` evalúa antes que el render de buckets).
- [x] Error 401 / 500 del route handler → `fetchOnce` cliente: `if (!res.ok) return;` mantiene estado actual (`NotificationsDropdown.tsx:101`). Sin throw, sin UI rota.
- [x] `document.hidden = true` al montar → el effect inicial sí llama `setTimeout(fetchOnce, 0)` y `start()` **siempre**, sin chequear `document.hidden`. **NIT 3**: idealmente se chequearía `document.hidden` al montar para no arrancar el polling si la pestaña está oculta. Mitigación: el primer fetch ocurre igual (es solo uno), y al cambiar a visible el `visibilitychange` hace nuevo fetch. Práctica menos prolija pero sin impacto funcional.
- [x] Click rápido en multiple items → optimistic decrementa con `Math.max(0, prev.unreadCount - 1)` (línea 238). Sin negativos posibles.
- [x] `markAsRead` de notif ya leída → idempotente: el optimistic solo aplica si `wasUnread` (línea 232), y la query usa `.is('read_at', null)` (`actions.ts:55`).
- [x] Click en `system` / `new_message` → `derive.ts:47-58` retorna `href === null`; el handler chequea `if (item.href)` (`NotificationsDropdown.tsx:243`).
- [x] Cleanup del `setInterval` + `visibilitychange` → `NotificationsDropdown.tsx:143-147`. Doble cleanup: stop interval + removeEventListener + clear initial timeout. **OK**.

---

## Validaciones operacionales

- `pnpm lint` → pasa (sin warnings).
- `pnpm type-check` → pasa (sin errores).
- `pnpm build` → no ejecutado por instrucción (lo dispara el `Stop` hook).
- `TopNav.tsx` NO modificado (verificado con `git log` y `git diff`).
- `feature_list.json` modificado: solo cambio semántico es `status: pending → in_progress`. El resto del diff es reformat JSON multi-línea (probablemente formatter automático). El status sigue `in_progress` (el leader lo cerrará).

---

## NITs no bloqueantes

1. **`NotifBell.tsx:46-51` — setState durante render para sync prop→local**: el patrón es válido pero la justificación cita `react-hooks/set-state-in-effect` cuando esa regla permite setState dentro de effect si responde a cambio de dep. Sería igualmente válido (y más convencional) con `useEffect(() => setLocalUnreadCount(initialUnreadCount), [initialUnreadCount])`. La motivación real (evitar flash de render) no está explicada. Refactor opcional.

2. **`NotificationsDropdown.tsx:139` — `setTimeout(fetchOnce, 0)` para fetch inicial**: workaround válido, lint pasa, cleanup correcto. Más idiomático con `useTransition` o flag `hasFetched.current`. Refactor opcional, no urgente.

3. **`NotificationsDropdown.tsx:109-148` — no chequea `document.hidden` al montar**: arranca el polling y hace fetch inicial aunque la pestaña esté oculta al abrir el panel. Probabilidad baja (el user abre el panel con la pestaña visible normalmente). Mitigable con `if (document.hidden) stop()` al final del effect inicial.

4. **`feature_list.json` reformateado**: 81 líneas modificadas para reformat JSON multi-línea, solo 1 cambio semántico (`status`). El implementer debería evitar reformatear el archivo. Probablemente un formatter automático (Prettier on save). No bloqueante; el leader puede deshacer el reformat con `git checkout --patch` antes del commit, o aceptar el reformat como cosmético.

---

## NITs / bugs bloqueantes

Cero.

---

## Notas

- El spec mencionaba "Marcar todas como leídas" no cerrar el panel — la implementación cumple (`handleMarkAll` no llama `onClose`).
- El comentario en `NotificationsHeader.tsx:1` dice `'use client'` aunque el componente no llama hooks. **Justificable**: recibe `markAllRef` como prop (que es un `RefObject`), y aunque podría ser server, mantenerlo client es consistente con su uso dentro del Client `NotificationsDropdown`. No es un bug.
- El `Icon` component (`src/components/ui/Icon.tsx`) es neutral; `EmptyNotifications` lo importa sin `'use client'`, lo cual es correcto y consistente.
- El revalidatePath('/') en ambas actions es correcto para invalidar el render del layout `(app)/` donde vive el `TopNav`.
