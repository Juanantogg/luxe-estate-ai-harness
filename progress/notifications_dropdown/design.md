# Design spec — notifications_dropdown

## Referencia visual

No hay mockup en `docs/designs/` para este panel. Designer libre dentro del
sistema (`docs/design-system.md` + tokens en `src/app/globals.css`). El
patrón visual debe alinearse con `AvatarDropdown` y los popovers ya
materializados (`shadow-dropdown`, `bg-surface`, `rounded-lg`, `border
border-divider`).

---

## 1. Resumen

`NotificationsDropdown` es un popover Client Component anclado al
`NotifBell` del `TopNav`. Lista las últimas 10 notificaciones del user
autenticado, ordenadas por `created_at desc`, agrupadas en buckets **Hoy
/ Esta semana / Anteriores** con encabezados de sección. Cada item muestra
icono por tipo, título, body opcional, tiempo relativo y un dot a la
izquierda si está sin leer. Click en una notificación dispara
`markAsRead(id)` (optimistic UI) y navega al destino derivado del tipo —
si el tipo no tiene destino útil (`new_message` mientras `/messages/[id]`
no existe, `system` sin FK), solo marca como leída sin navegar. Header del
panel con título "Notificaciones" + botón ghost "Marcar todas como
leídas". El badge rojo del `NotifBell` se mantiene sin cambios (sigue
pre-calculado server-side por el `TopNav`); el dropdown lo refresca por
revalidación server tras cada acción y por **polling cada 30s** desde el
cliente para mantener la lista al día. NO se introduce Supabase Realtime.

---

## 2. Acceptance criteria de `feature_list.json`

| #   | Acceptance original                                                                                                      | Cobertura en este spec                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `Client Component src/components/notifications/NotificationsDropdown.tsx`                                                | Se crea ese componente. Ver §4 y §5.                                                                                                                                                                                           |
| 2   | `Trigger: el botón de notif badge del TopNav`                                                                            | Estrategia A elegida en §4: `NotifBell` se transforma en un Client Component que ahora también renderiza el popover. Mantiene su firma actual (`unreadCount: number`) intacta, así que el `TopNav` Server Component no cambia. |
| 3   | `Popover con max-h-96 scrollable, max-w-sm`                                                                              | Ver §5.2 y §8: desktop `w-[22rem] max-w-sm max-h-[28rem]` con `overflow-y-auto` en el cuerpo. Mobile usa bottom-sheet, no popover (decisión §9).                                                                               |
| 4   | `Item por notification: ícono según type, title, body, time relativo (hace 5 min, ayer)`                                 | Ver §5.4 (item) + §6.5 (mapeo tipo→icono) + §4 archivo `src/lib/format/relative-time.ts`.                                                                                                                                      |
| 5   | `Unread: bg-mosque/5 + dot a la izquierda`                                                                               | Item con `read_at IS NULL` lleva `bg-primary-soft` y un dot `bg-primary` 8px a la izquierda. Ver §5.4 + §8.                                                                                                                    |
| 6   | `Server Action markAsRead(id) / markAllAsRead()`                                                                         | Ver §7.                                                                                                                                                                                                                        |
| 7   | `Empty state: 'No tienes notificaciones'`                                                                                | Ver §5.5.                                                                                                                                                                                                                      |
| 8   | `Realtime opcional: suscripción a INSERT en notifications via Supabase Realtime (si no se implementa, polling cada 30s)` | Decisión cerrada con el humano (D1 §3): **polling cada 30s**. NO Realtime. Pause cuando `document.hidden` para no consumir batería. Ver §6.3.                                                                                  |

---

## 3. Decisiones cerradas

### Decididas con el humano antes del spec

- **D1. Refresco**: polling cada 30s. NO Realtime (suma dependencia y
  canal abierto que no compensa para el volumen esperado del MVP).
- **D2. Agrupación**: buckets visuales **Hoy / Esta semana / Anteriores**
  con headers de sección dentro del scroll. NO lista plana.
- **D3. Tipos sin destino útil**: si la notificación no tiene `href`
  válido (`system`, `new_message`), el click ejecuta `markAsRead` sin
  navegar. NO se ocultan en la query — siguen apareciendo en el panel
  porque tienen valor informativo.
- **D4. Badge en `TopNav`**: se mantiene como hoy — un dot rojo sin
  número, calculado server-side por el `TopNav`. NO se muestra count
  numérico (implicaría tocar el `TopNav`, que es Server Component, y queda
  fuera de scope).

### Decididas por el designer en este spec

- **D5. Cómo se convierte el `NotifBell` en trigger del dropdown — opción
  A**: se **reemplaza** el contenido actual de `NotifBell.tsx` por un
  Client Component que mantiene la firma pública `(props: { unreadCount:
number })`. El `TopNav` (Server Component) lo monta exactamente igual
  que hoy y le pasa el `unreadCount` server-side como `initialUnreadCount`.
  El popover y toda la interactividad viven dentro del propio `NotifBell`.
  Razones:
  1. **Cero cambios en el `TopNav`** — su contrato de paso de props no se
     altera, y por tanto no hay riesgo de regresión en las 3 variants
     (`app` / `dashboard` / `admin`).
  2. Evita el doble componente Wrapper-Client + Bell-presentacional que
     pediría la opción B y que en la práctica fragmenta la lógica.
  3. El dot rojo que hoy renderiza `NotifBell` se conserva: ahora lo
     pintamos a partir de `unreadCount` del estado local (sincronizado con
     el polling + las acciones), pero el render inicial usa la prop
     server-side y queda idéntico al HTML actual.

  Rechazada **opción B** (wrapper Client envolviendo `NotifBell`) porque
  agrega un componente intermedio sin ganancia: igual hay que hacer el
  `NotifBell` Client (lleva `onClick`, focus, aria-expanded del botón).

- **D6. Origen de la lista del dropdown — Route handler GET**: el panel
  fetchea las notificaciones via `GET /api/notifications/recent` (route
  handler). Razones:
  1. Idiomático en Next 16 para fetcheo dinámico repetido desde Client
     (polling). Permite respuestas streamables y caching `no-store`
     explícito.
  2. El proyecto ya tiene precedente de route handlers para
     `/auth/callback` y `/auth/reset` — no introducimos un patrón nuevo.
  3. Una Server Action invocada desde `useEffect` también funciona, pero
     el contrato HTTP del route handler es más simple de testear con
     curl/devtools y deja `revalidatePath` libre de dudas (no hay
     revalidaciones implícitas en cada poll).

  Las **mutaciones** (`markAsRead` / `markAllAsRead`) sí son Server
  Actions — son el patrón canónico del proyecto y necesitan
  `revalidatePath` para refrescar el `unreadCount` server-side del
  `TopNav` en el próximo render.

- **D7. Tiempo relativo — helper propio**: nuevo módulo
  `src/lib/format/relative-time.ts`. NO se introduce `date-fns` (sería
  dep nueva, requiere aprobación del humano según `AGENTS.md`, y los 5
  casos del MVP no la justifican). Casos cubiertos: <1 min ("ahora"),
  <60 min ("hace N min"), <24h ("hace N h"), <48h ("ayer"), <7d ("hace
  N días"), resto (fecha corta `dd MMM` en es-MX, p. ej. "12 oct").

- **D8. Bottom-sheet en mobile**: el popover anclado al `NotifBell`
  funciona bien en desktop, pero en mobile (≤640px) el ancho disponible
  no alcanza para que el popover quepa "anclado" sin desbordar el viewport
  o quedar pegado al borde. Solución: en mobile el panel se renderiza
  como **bottom-sheet** (full width, `bottom-0`, `max-h-[80vh]`, slide-up
  con `tailwindcss-animate`). En `sm:+` revierte a popover anclado.
  Mismo patrón que `FiltersModal` usa ya en el proyecto.

- **D9. Optimistic UI en `markAsRead`**: el click marca el item como
  leído **instantáneamente** en el estado local (quita el dot, quita
  `bg-primary-soft`, decrementa el `unreadCount` local). En paralelo,
  navega al destino (si lo hay) y dispara la Server Action en segundo
  plano. Si la action falla, NO revertimos visualmente (el panel ya está
  cerrado por la navegación y la lista se re-fetchea en el próximo poll
  o re-apertura). El `revalidatePath('/')` server-side refresca el
  badge del `TopNav` para el próximo render — entre tanto el badge local
  refleja el optimistic.

- **D10. Self-protection**: `markAsRead` valida zod (id uuid) y RLS hace
  el resto (`recipient_id = auth.uid()`). No hay self-check explícito —
  RLS ya impide tocar notifs ajenas. `markAllAsRead` solo afecta filas
  con `recipient_id = auth.uid()` AND `read_at IS NULL`.

- **D11. Polling pausa en `document.hidden`**: cuando la pestaña está
  inactiva, el `setInterval` no se ejecuta. Al volver visible, se hace un
  fetch inmediato + reanuda el interval. Reduce queries innecesarias y
  consume menos batería.

- **D12. RLS ya está OK**: revisado migración `0009_notifications.sql`.
  La policy `notifications_select_own_or_admin` (SELECT) y
  `notifications_update_own` (UPDATE, con `with check recipient_id =
auth.uid()`) cubren exactamente lo que necesita este feature.
  **No se requiere migración nueva.**

- **D13. Scope estricto sin route `/messages/[id]`**: la deuda de
  mensajería (`/messages/[id]` no existe) se documenta en §10 y se
  manifiesta como item clickeable que marca como leído sin navegar. El
  copy del título/body de la notif se respeta tal cual lo genera el
  productor — esta feature no edita títulos.

---

## 4. Archivos a crear / modificar

### A crear

| Path                                                     | Propósito                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/notifications/queries.ts`                       | `getRecentNotifications(supabaseClient, userId, limit=10)` — query server-side para el route handler. Devuelve filas tipadas `NotificationRow[]`.                                                                                                          |
| `src/lib/notifications/actions.ts`                       | Server Actions `markAsRead(id)` y `markAllAsRead()`. Ambas con validación zod y devolución `{ ok: true } \| { ok: false, error: { code, message } }`. Reusa el patrón de `src/lib/admin/actions.ts`.                                                       |
| `src/lib/notifications/types.ts`                         | Tipo `NotificationRow` (proyección de columnas usadas), `NotificationBucket` ('today' \| 'week' \| 'older'), `NotificationDisplay` (la fila enriquecida con `href` derivado, `icon` y `relativeTime`).                                                     |
| `src/lib/notifications/derive.ts`                        | Helpers puros: `getNotificationHref(row)` (mapeo §6.6), `getNotificationIcon(type)` (§6.5), `getNotificationBucket(createdAt, now)` (§6.4). 100% testeables, sin Supabase.                                                                                 |
| `src/lib/notifications/index.ts`                         | Re-exports limpios.                                                                                                                                                                                                                                        |
| `src/lib/format/relative-time.ts`                        | Helper puro `formatRelativeTime(date, now)`. Devuelve string en es-MX. Sin deps externas. Usa `Intl.DateTimeFormat` para el fallback de fecha absoluta.                                                                                                    |
| `src/app/api/notifications/recent/route.ts`              | Route handler `GET` que lee user desde `createClient()`, llama `getRecentNotifications`, devuelve `{ items: NotificationRow[], unreadCount: number }`. Responde 401 si no hay sesión, 500 si falla. `cache: 'no-store'`, `Content-Type: application/json`. |
| `src/components/notifications/NotificationsDropdown.tsx` | Client Component principal. Maneja open/close, fetch+polling, buckets, items. Renderizado **dentro** del nuevo `NotifBell`. NO se monta directo desde el `TopNav`.                                                                                         |
| `src/components/notifications/NotificationItem.tsx`      | Item individual. Optimistic UI on click. Recibe `display: NotificationDisplay` + callbacks.                                                                                                                                                                |
| `src/components/notifications/NotificationsHeader.tsx`   | Header del panel con título "Notificaciones" + botón "Marcar todas como leídas" (disabled si `unreadCount === 0`).                                                                                                                                         |
| `src/components/notifications/EmptyNotifications.tsx`    | Empty state estático con icono `notifications_off` y copy en es-MX.                                                                                                                                                                                        |
| `src/components/notifications/index.ts`                  | Re-exports.                                                                                                                                                                                                                                                |

### A modificar

| Path                               | Cambio                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/nav/NotifBell.tsx` | Se transforma en **Client Component**. Mantiene exactamente la firma actual (`unreadCount: number, className?: string`). Internamente: state local `unreadCount`, `isOpen`, `items`, `isLoading`. Render = botón actual (igual visual: campana + dot rojo) + popover/sheet con `<NotificationsDropdown />`. El `TopNav` (Server Component) no se toca. |
| `src/components/nav/index.ts`      | Sin cambio si ya exporta `NotifBell` (verificar).                                                                                                                                                                                                                                                                                                      |

### NO se modifica

- `src/components/nav/TopNav.tsx`. La firma de `NotifBell` no cambia.
- `feature_list.json`. Lo administra el leader.
- Migraciones de Supabase. RLS ya cubre los casos.

---

## 5. Componentes (estructura del DOM por bloque)

### 5.1 `NotifBell` (post-refactor)

```tsx
'use client';

// Props idénticas a hoy:
interface NotifBellProps {
  unreadCount: number; // valor server-side inicial
  className?: string;
}
```

DOM:

```
<div className="relative">
  <button
    type="button"
    aria-label={...}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-controls="notifications-panel"
    onClick={() => setIsOpen(v => !v)}
    className="...mismas clases que hoy..."
  >
    <Icon name={hasUnread ? 'notifications' : 'notifications_none'} size="md" />
    {hasUnread && <span aria-hidden className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />}
  </button>

  {isOpen && (
    <NotificationsDropdown
      id="notifications-panel"
      onClose={() => setIsOpen(false)}
      initialUnreadCount={unreadCount}
      onUnreadCountChange={setLocalUnreadCount}
    />
  )}
</div>
```

`unreadCount` local se inicializa con la prop y se actualiza por callback
del `NotificationsDropdown` cuando el polling trae datos nuevos o se
ejecuta `markAsRead`/`markAllAsRead`. El dot rojo se calcula con el
`unreadCount` local, NO con la prop (la prop solo es el snapshot inicial
del SSR).

### 5.2 `NotificationsDropdown` — popover (sm+) y bottom-sheet (mobile)

DOM raíz:

```
<>
  {/* Overlay mobile — clic afuera cierra */}
  <button aria-label="Cerrar" onClick={onClose}
          className="fixed inset-0 z-40 bg-on-background/30 sm:hidden" />

  <div
    role="dialog"
    aria-modal="false"
    aria-labelledby="notifications-title"
    id={id}
    className={cn(
      // Mobile: bottom-sheet full width
      'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-surface shadow-dropdown',
      'animate-in slide-in-from-bottom duration-200',
      // sm+: popover anclado al botón
      'sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:bottom-auto sm:w-[22rem] sm:max-w-sm sm:max-h-[28rem] sm:rounded-lg sm:slide-in-from-top-2'
    )}
  >
    <NotificationsHeader unreadCount={localUnreadCount} onMarkAll={handleMarkAll} isMarkingAll={isMarkingAll} />

    <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 56px)' }}>
      {/* Loading inicial */}
      {isLoading && items.length === 0 ? <LoadingSkeleton /> :
        items.length === 0 ? <EmptyNotifications /> :
        <BucketedList items={items} onItemClick={handleItemClick} />
      }
    </div>
  </div>
</>
```

Atajos teclado:

- `Escape` cierra (event listener global mientras `isOpen`).
- Click fuera (en el overlay mobile o en `document` desktop) cierra. En
  desktop se hace con un `useEffect` que escucha `mousedown` en
  `document` y compara `event.target` contra el `ref` del dialog y el
  ref del botón. Pattern ya usado en `AvatarDropdown` (verificar archivo
  en la implementación; si no, replicarlo).
- Focus: al abrir, `requestAnimationFrame(() => firstFocusable?.focus())`
  enfoca el botón "Marcar todas como leídas" si está habilitado, si no
  el primer item. Al cerrar, el foco vuelve al `NotifBell` botón.

### 5.3 `NotificationsHeader`

```
<header className="flex items-center justify-between border-b border-divider px-4 py-3">
  <h2 id="notifications-title" className="text-base font-semibold text-on-surface">
    Notificaciones
  </h2>
  <button
    type="button"
    onClick={onMarkAll}
    disabled={unreadCount === 0 || isMarkingAll}
    className="text-sm font-medium text-primary hover:text-primary-hover disabled:text-muted disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none rounded px-1"
  >
    Marcar todas como leídas
  </button>
</header>
```

### 5.4 `NotificationItem`

DOM por item:

```
<li className="border-b border-divider-soft last:border-b-0">
  <button
    type="button"
    onClick={() => onClick(item)}
    className={cn(
      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
      'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
      isUnread && 'bg-primary-soft'
    )}
  >
    {/* Dot izquierda */}
    <span
      aria-hidden="true"
      className={cn(
        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
        isUnread ? 'bg-primary' : 'bg-transparent'
      )}
    />

    {/* Icono por tipo */}
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
      <Icon name={iconName} size="sm" />
    </span>

    {/* Texto */}
    <div className="min-w-0 flex-1">
      <p className={cn('truncate text-sm', isUnread ? 'font-semibold text-on-surface' : 'font-medium text-on-surface')}>
        {item.title}
      </p>
      {item.body && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>
      )}
      <p className="mt-1 text-xs text-muted">
        <time dateTime={item.createdAt}>{relativeTime}</time>
      </p>
    </div>
  </button>
</li>
```

Buckets se renderizan así:

```
<ul className="divide-y divide-divider-soft">
  {bucketEntries.map(([bucketKey, bucketItems]) => (
    <li key={bucketKey}>
      <h3 className="bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {BUCKET_LABEL[bucketKey]}
      </h3>
      <ul>
        {bucketItems.map((item) => <NotificationItem key={item.id} item={item} ... />)}
      </ul>
    </li>
  ))}
</ul>
```

`BUCKET_LABEL = { today: 'Hoy', week: 'Esta semana', older: 'Anteriores' }`.

### 5.5 `EmptyNotifications`

```
<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
    <Icon name="notifications_off" size="lg" />
  </span>
  <p className="text-sm font-medium text-on-surface">No tienes notificaciones</p>
  <p className="text-xs text-muted">Cuando recibas avisos sobre tus propiedades favoritas o visitas, aparecerán aquí.</p>
</div>
```

### 5.6 Loading skeleton

3-4 filas de skeleton (clases `animate-pulse`) que imitan el layout del
item:

```
<ul className="divide-y divide-divider-soft">
  {Array.from({ length: 4 }).map((_, i) => (
    <li key={i} className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1.5 h-2 w-2 rounded-full bg-neutral-200" />
      <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <span className="block h-3 w-3/4 rounded bg-neutral-200" />
        <span className="block h-3 w-1/2 rounded bg-neutral-100" />
      </div>
    </li>
  ))}
</ul>
```

---

## 6. Comportamiento

### 6.1 Apertura / cierre

- Click en `NotifBell` toggle `isOpen`.
- `Escape` cierra (focus vuelve al bell).
- Click fuera del dialog (en mobile: overlay; en desktop: `mousedown` en
  `document` filtrado por ref) cierra.
- Mobile: posible cierre por swipe-down — **no se implementa** en MVP
  (igual que `FiltersModal`, ver review NIT diferido). Cierre por overlay
  o `Escape` es suficiente.

### 6.2 Carga de datos

- Al **montar** el `NotificationsDropdown` (es decir, la primera vez que
  el user abre el panel en la sesión de página), si `items.length === 0`,
  ejecutar fetch inmediato a `GET /api/notifications/recent`.
- Mientras está abierto, el polling de 30s sigue ejecutándose.
- El componente se desmonta al cerrar el panel para no mantener
  `setInterval` corriendo en segundo plano (alternativa: mantenerlo
  montado pero pausar el interval — decisión: **desmontar**, más simple
  y la primera apertura cachea el resultado en `useState` que se pierde,
  pero el segundo fetch es barato). Si esto resulta notorio en QA,
  promovemos el state a `NotifBell` o a un contexto.

### 6.3 Polling

Pseudo-código del hook:

```ts
function useNotificationsPolling(enabled: boolean) {
  const [state, setState] = useState({ items: [], unreadCount: 0, isLoading: true });

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/recent', { cache: 'no-store' });
      if (!res.ok) return; // mantenemos lista actual
      const data = await res.json();
      setState({ items: data.items, unreadCount: data.unreadCount, isLoading: false });
    } catch {
      // Network: silencioso. Próximo tick reintenta.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchOnce();

    let interval: ReturnType<typeof setInterval> | null = null;
    function startInterval() {
      stopInterval();
      interval = setInterval(fetchOnce, 30_000);
    }
    function stopInterval() {
      if (interval) clearInterval(interval);
      interval = null;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopInterval();
      } else {
        fetchOnce(); // refresh inmediato al volver
        startInterval();
      }
    }

    startInterval();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, fetchOnce]);

  return { ...state, refetch: fetchOnce, setState };
}
```

### 6.4 Buckets (cálculo)

Cliente y server pueden discrepar en `now`, pero la diferencia (<1s) es
irrelevante para los buckets. Se calcula client-side a partir del
`created_at` de cada row, comparado con `Date.now()` en el momento del
render. Reglas:

- **Hoy**: `created_at` en el mismo día calendario que `now` (zona local
  del browser).
- **Esta semana**: `created_at` en los últimos 7 días pero no hoy.
- **Anteriores**: el resto.

Función pura `getNotificationBucket(createdAt: string, now: Date):
NotificationBucket` testeable en `src/lib/notifications/derive.ts`.

### 6.5 Mapeo tipo → icono

| `notification_type` | Icono Material         |
| ------------------- | ---------------------- |
| `new_property`      | `home`                 |
| `visit_confirmed`   | `event_available`      |
| `visit_reminder`    | `notifications_active` |
| `new_message`       | `chat_bubble`          |
| `price_drop`        | `trending_down`        |
| `favorite_update`   | `favorite`             |
| `system`            | `info`                 |

Implementado como mapa estático en `getNotificationIcon(type)`.

### 6.6 Mapeo tipo → destino (href)

`getNotificationHref(row: NotificationRow): string | null`:

```
new_property | price_drop | favorite_update
  → row.property_id ? `/property/${row.property_id}` : null

visit_confirmed | visit_reminder
  → row.visit_id ? '/profile?tab=visits' : null

new_message
  → null  // deuda: /messages/[id] no existe todavía

system
  → null  // sin destino canónico
```

Cuando `href === null`, el click solo dispara `markAsRead` y NO navega.
El item sigue siendo clickeable y se ve igual (no se renderiza como
"disabled"); el affordance es el mismo y la única diferencia es la
ausencia de navegación.

### 6.7 Click en item — flujo

```ts
async function handleItemClick(item: NotificationDisplay) {
  const href = item.href;
  const wasUnread = item.readAt === null;

  // Optimistic UI: actualizar estado local inmediato
  if (wasUnread) {
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.id === item.id ? { ...it, readAt: new Date().toISOString() } : it,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  }

  // Cerrar panel + navegar (si aplica)
  onClose();
  if (href) {
    router.push(href);
  }

  // Server Action en background — fire-and-forget consciente
  if (wasUnread) {
    void markAsRead(item.id); // no await: la navegación no debe esperar
  }
}
```

`router` = `useRouter()` de `next/navigation`. Si la action falla en
background, no revertimos UI — el siguiente poll o re-apertura traerá el
estado real desde DB.

### 6.8 Click en "Marcar todas como leídas"

```ts
async function handleMarkAll() {
  setIsMarkingAll(true);
  // Optimistic
  setState((s) => ({
    ...s,
    items: s.items.map((it) =>
      it.readAt === null ? { ...it, readAt: new Date().toISOString() } : it,
    ),
    unreadCount: 0,
  }));
  try {
    const result = await markAllAsRead();
    if (!result.ok) {
      // En error: re-fetch para resincronizar
      void refetch();
    }
  } finally {
    setIsMarkingAll(false);
  }
}
```

No cierra el panel — el user puede querer ver la lista ahora "ya leída".

### 6.9 Accesibilidad

- `role="dialog"` + `aria-modal="false"` en el panel. `aria-modal="false"`
  porque NO es modal estricto (no bloquea contenido detrás, es un
  popover/sheet ligero). Si en QA el screen reader no respeta el cierre
  con Escape, evaluar `aria-modal="true"` + focus trap completo. Para MVP
  vamos sin trap completo, solo con auto-focus al abrir y restore al
  cerrar.
- `aria-labelledby="notifications-title"` apunta al h2 del header.
- `aria-live="polite"` en el contenedor de items NO se aplica — el panel
  está cerrado cuando llegan notifs nuevas vía polling, así que no
  añadiría valor y podría leer toda la lista al abrir. Si en el futuro
  se quiere announce de notif entrante mientras el panel está abierto,
  se agrega entonces.
- `aria-busy={isLoading}` en el contenedor mientras se hace el primer
  fetch.
- Cada item es un `<button>` (no `<a>`), porque el click hace primero
  `markAsRead` + navegación condicional. La navegación se hace con
  `router.push`. Si en QA falla la navegación con `Cmd+Click` (abrir en
  nueva pestaña), pasamos a `<a href>` envolviendo y manejamos
  `markAsRead` en `onClick`. **Decisión MVP**: `<button>`.
- Contraste verificado: `bg-primary-soft` (mosque 10%) sobre `bg-surface`
  cumple WCAG AA con texto `text-on-surface` (nordic).

---

## 7. Server Actions y query

### 7.1 `markAsRead(id: string)` — `src/lib/notifications/actions.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const markAsReadSchema = z.object({ id: z.string().uuid() });

export type MarkAsReadErrorCode = 'unauthenticated' | 'invalid' | 'not_found' | 'server';
export type MarkAsReadResult =
  | { ok: true }
  | { ok: false; error: { code: MarkAsReadErrorCode; message: string } };

export async function markAsRead(id: string): Promise<MarkAsReadResult> {
  const parsed = markAsReadSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid', message: 'Identificador inválido.' } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'Inicia sesión.' } };
  }

  // RLS hace que esto solo afecte filas con recipient_id = user.id
  const { error, count } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .is('read_at', null) // idempotente: si ya estaba leída, no la toca
    .select('id', { count: 'exact', head: true });

  if (error) {
    return { ok: false, error: { code: 'server', message: 'No se pudo marcar la notificación.' } };
  }
  // count === 0 puede significar: ya estaba leída, o id no existe, o RLS la oculta.
  // Para el caller es lo mismo: success silencioso.
  revalidatePath('/');
  return { ok: true };
}
```

Notas:

- `revalidatePath('/')` invalida el render del `TopNav` que vive en
  `(app)/layout.tsx`. Esto refresca el `unreadCount` server-side para la
  próxima navegación.
- No se usa `revalidatePath('/', 'layout')` (forma agresiva) — el path
  simple alcanza para invalidar el layout del `(app)/`.

### 7.2 `markAllAsRead()` — `src/lib/notifications/actions.ts`

```ts
export type MarkAllAsReadErrorCode = 'unauthenticated' | 'server';
export type MarkAllAsReadResult =
  | { ok: true; count: number }
  | { ok: false; error: { code: MarkAllAsReadErrorCode; message: string } };

export async function markAllAsRead(): Promise<MarkAllAsReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'Inicia sesión.' } };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('recipient_id', user.id) // defense-in-depth — RLS ya filtra
    .is('read_at', null)
    .select('id');

  if (error) {
    return { ok: false, error: { code: 'server', message: 'No se pudo actualizar.' } };
  }
  revalidatePath('/');
  return { ok: true, count: data?.length ?? 0 };
}
```

### 7.3 Query — `src/lib/notifications/queries.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface NotificationRow {
  id: string;
  type: Database['public']['Enums']['notification_type'];
  title: string;
  body: string | null;
  property_id: string | null;
  visit_id: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function getRecentNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 10,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  // 1) Últimas N (RLS ya filtra a las del user; el eq() es defense-in-depth)
  const itemsRes = await supabase
    .from('notifications')
    .select('id, type, title, body, property_id, visit_id, conversation_id, read_at, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // 2) Conteo total sin leer (no truncado por limit)
  const countRes = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  return {
    items: (itemsRes.data ?? []) as NotificationRow[],
    unreadCount: countRes.count ?? 0,
  };
}
```

### 7.4 Route handler — `src/app/api/notifications/recent/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentNotifications } from '@/lib/notifications/queries';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Inicia sesión.' } },
      { status: 401 },
    );
  }

  try {
    const result = await getRecentNotifications(supabase, user.id, 10);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'server', message: 'No se pudieron obtener las notificaciones.' } },
      { status: 500 },
    );
  }
}
```

Nota: el polling siempre llama `/api/notifications/recent` aunque no haya
sesión (el `NotifBell` solo se monta cuando hay user, así que en la
práctica no pasa). Si por edge case se llama anónimo, el route handler
responde 401 y el cliente simplemente no actualiza state.

---

## 8. Tokens y clases por bloque

| Bloque                                  | Tokens / clases Tailwind                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel raíz desktop                      | `absolute right-0 top-12 w-[22rem] max-w-sm max-h-[28rem] rounded-lg bg-surface shadow-dropdown border border-divider z-50 overflow-hidden`   |
| Panel raíz mobile (bottom-sheet)        | `fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-surface shadow-dropdown border-t border-divider`                                  |
| Overlay mobile                          | `fixed inset-0 z-40 bg-on-background/30 sm:hidden` (opacidad sobre nordic 30%)                                                                |
| Header del panel                        | `border-b border-divider px-4 py-3 flex items-center justify-between`                                                                         |
| Título "Notificaciones"                 | `text-base font-semibold text-on-surface`                                                                                                     |
| Botón "Marcar todas..." (habilitado)    | `text-sm font-medium text-primary hover:text-primary-hover`                                                                                   |
| Botón "Marcar todas..." (deshabilitado) | `text-muted cursor-not-allowed`                                                                                                               |
| Header de bucket                        | `bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted`                                                         |
| Item base                               | `flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover`                                                  |
| Item unread                             | + `bg-primary-soft`                                                                                                                           |
| Dot unread                              | `mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary`                                                                                             |
| Avatar de icono por item                | `flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary`                                                 |
| Title del item (unread)                 | `text-sm font-semibold text-on-surface truncate`                                                                                              |
| Title del item (read)                   | `text-sm font-medium text-on-surface truncate`                                                                                                |
| Body del item                           | `mt-0.5 line-clamp-2 text-xs text-muted`                                                                                                      |
| Time relativo                           | `mt-1 text-xs text-muted`                                                                                                                     |
| Divider entre items                     | `divide-y divide-divider-soft`                                                                                                                |
| Empty state icono                       | `flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary`                                                        |
| Empty state título                      | `text-sm font-medium text-on-surface`                                                                                                         |
| Empty state body                        | `text-xs text-muted`                                                                                                                          |
| Skeleton fill                           | `bg-neutral-200` (light) / `bg-neutral-100` (lighter) — neutrales auxiliares OK aquí (`docs/design-system.md` los autoriza para skeleton)     |
| Focus ring (todos los buttons)          | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background` |

**Cero hex literales.** Todos los colores citados son tokens. Las
opacidades (`bg-on-background/30`) son sintaxis Tailwind sobre el token,
no hex.

---

## 9. Responsive

| Breakpoint        | Comportamiento                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile** (≤639) | Bottom-sheet anclado a `bottom-0`, full width, max-h-80vh. Overlay semitransparente cubre el resto. Slide-in desde abajo (`animate-in slide-in-from-bottom`). El header del panel y la lista comparten el ancho completo del viewport con `px-4` interno. |
| **sm+** (≥640)    | Popover absolute anclado al `NotifBell`: `right-0 top-12 w-[22rem] max-w-sm max-h-[28rem]`. Sin overlay. Click fuera cierra. Slide-in desde arriba (`animate-in slide-in-from-top-2`).                                                                    |
| **md+** y **lg+** | Sin cambios estructurales. El `NotifBell` siempre está visible en md+ (en mobile también está visible — está en el cluster derecho del TopNav, no en el drawer).                                                                                          |

El `NotifBell` está visible en **todos** los breakpoints (igual que hoy),
así que el dropdown necesita soportar mobile como bottom-sheet. Esto es
una decisión propia (D8) y no contradice ningún mockup porque no existe.

---

## 10. Riesgos y deuda

| Riesgo                                                                          | Severidad | Mitigación / decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1. Ruta `/messages/[id]` no existe**                                         | Funcional | Deuda documentada. `getNotificationHref` devuelve `null` para `new_message`. El item se marca como leído al click pero no navega. Cuando se materialice la feature de mensajería, se actualiza `getNotificationHref` y listo. Comentario `// TODO(messages_screen): cuando exista /messages/[id], devolver row.conversation_id ? ...` en el helper.                                                                                                                                                                   |
| **R2. Polling vs Realtime**                                                     | Trade-off | Polling 30s: ~120 req/h/user activo. Para MVP es despreciable. Si crece el churn, migrar a Supabase Realtime es local a este feature (cambiar el hook `useNotificationsPolling` por `useNotificationsRealtime`).                                                                                                                                                                                                                                                                                                      |
| **R3. RLS de `notifications`**                                                  | Mitigado  | Verificado en migración 0009. SELECT y UPDATE ya están cubiertos por `notifications_select_own_or_admin` y `notifications_update_own` (con `with check recipient_id = auth.uid()`). **NO se requiere migración nueva.**                                                                                                                                                                                                                                                                                               |
| **R4. Pestaña inactiva**                                                        | Mitigado  | `document.hidden` pausa el polling. Al volver visible: fetch inmediato + reanuda.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **R5. `revalidatePath` no refresca el `unreadCount` del TopNav inmediatamente** | UX        | El `unreadCount` del `TopNav` se calcula en el render del layout; tras `revalidatePath('/')` Next invalida la cache del layout, pero el badge en pantalla solo se actualiza cuando el user navega. **Workaround**: el badge local del `NotifBell` ya se actualiza en optimistic, así que la UX es correcta. El re-render server se da en la próxima navegación natural.                                                                                                                                               |
| **R6. Race condition entre poll y action**                                      | Bajo      | El polling cada 30s puede llegar justo después de un `markAsRead` y devolver un snapshot momentáneamente desfasado (la action ya commit pero la query reusa una conexión cacheada). Supabase es read-after-write consistente para la misma sesión, así que en la práctica no pasa. Si llega a manifestarse, el poll siguiente lo corrige.                                                                                                                                                                             |
| **R7. Polling sin sesión**                                                      | Bajo      | El `NotifBell` solo se renderiza cuando `user !== null` (verificado en `TopNav.tsx`). El route handler además devuelve 401. Doble guardia.                                                                                                                                                                                                                                                                                                                                                                            |
| **R8. `useRouter().push` durante el render**                                    | Mitigado  | El `router.push` se llama dentro de `handleItemClick` (event handler), no en render. Patrón estándar Next 16.                                                                                                                                                                                                                                                                                                                                                                                                         |
| **R9. Body de notif con HTML**                                                  | N/A       | El productor (triggers DB) escribe `body` como texto plano. JSX lo renderiza como texto. NO se hace `dangerouslySetInnerHTML`.                                                                                                                                                                                                                                                                                                                                                                                        |
| **R10. Smoke test pendiente**                                                   | Operativo | El leader debe agregar al `progress/smoke-tests.md`: (1) abrir panel con notifs sin leer → ver bucket "Hoy" + dot azul + item resaltado; (2) click en notif con property → navega a `/property/[id]` y marca leída; (3) click en notif `system` → solo marca leída, no navega; (4) "Marcar todas como leídas" → todos los items pierden dot; (5) en otra pestaña, insertar notif vía SQL → esperar 30s con foco en la pestaña → ver que aparece; (6) cambiar a otra pestaña 1 min, volver → fetch inmediato refresca. |

---

## 11. Notas adicionales

- **Sin dependencias nuevas.** `date-fns` rechazado por el designer
  (helper propio en su lugar). `react-aria` / `@radix-ui/react-popover`
  rechazados también — el patrón de popover ya existe en `AvatarDropdown`
  y se puede replicar.
- **`NotifBell` ahora es Client.** El bundle del `TopNav` crece
  marginalmente. Ya hay otros componentes Client en el cluster derecho
  (`AvatarDropdown`, `MobileNavDrawer`), así que el costo es menor.
- **Path del archivo de Server Action**: vive en
  `src/lib/notifications/actions.ts` (no en `src/app/api/...`) porque es
  Server Action, no route handler. La convención del proyecto es
  `src/lib/<domain>/actions.ts` (cf. `src/lib/admin/actions.ts`,
  `src/lib/visits/actions.ts`, `src/lib/profile/actions.ts`).
- **Tipos**: el implementer debe verificar que `src/types/database.ts`
  ya contenga el enum `notification_type` y la tabla `notifications`
  (verificado en este spec, migración 0009 ya aplicada).
- **No se introduce un sistema global de toast.** El patrón existente
  (feedback inline) ya cubre los casos. Para este panel los errores de
  `markAsRead` son silenciosos (next poll resincroniza), y
  `markAllAsRead` con error dispara un re-fetch transparente.
