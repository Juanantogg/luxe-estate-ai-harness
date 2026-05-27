'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markAllAsRead, markAsRead } from '@/lib/notifications/actions';
import {
  getNotificationBucket,
  getNotificationHref,
  getNotificationIcon,
} from '@/lib/notifications/derive';
import type {
  NotificationBucket,
  NotificationDisplay,
  NotificationRow,
} from '@/lib/notifications/types';
import { formatRelativeTime } from '@/lib/format/relative-time';
import { cn } from '@/lib/utils/cn';
import { EmptyNotifications } from './EmptyNotifications';
import { NotificationItem } from './NotificationItem';
import { NotificationsHeader } from './NotificationsHeader';

export interface NotificationsDropdownProps {
  /** ID del contenedor del panel (consumido por `aria-controls` del trigger). */
  id: string;
  /** Cierra el panel desde el padre (`NotifBell`). */
  onClose: () => void;
  /** Conteo inicial sin leer (snapshot SSR del `TopNav`). */
  initialUnreadCount: number;
  /** Callback al padre cuando el conteo local cambia (polling o actions). */
  onUnreadCountChange: (count: number) => void;
  /** Ref al botón trigger (NotifBell) para excluirlo del "click fuera cierra". */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

interface FetchResponse {
  items: NotificationRow[];
  unreadCount: number;
}

interface DropdownState {
  items: NotificationRow[];
  unreadCount: number;
  isLoading: boolean;
}

const BUCKET_LABEL: Record<NotificationBucket, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  older: 'Anteriores',
};

const BUCKET_ORDER: readonly NotificationBucket[] = ['today', 'week', 'older'];
const POLL_INTERVAL_MS = 30_000;

/**
 * Dropdown principal de notificaciones (spec §5.2 + §6).
 *
 * Responsabilidades:
 * 1. Fetch inicial al montar + polling cada 30s vía
 *    `GET /api/notifications/recent` (pausa cuando `document.hidden`).
 * 2. Agrupar items en buckets (`today` / `week` / `older`).
 * 3. Manejar click en item: optimistic UI → cerrar panel → navegar (si
 *    hay `href`) → fire-and-forget `markAsRead`.
 * 4. Manejar "Marcar todas como leídas": optimistic → await action → si
 *    falla, refetch silencioso. NO cierra el panel.
 * 5. Accesibilidad: `Escape` cierra, click fuera (desktop) cierra,
 *    overlay (mobile) cierra. Auto-focus al abrir, focus restore al
 *    cerrar lo orquesta el padre.
 *
 * Decisión de scope (spec §6.2): el componente se DESMONTA al cerrar el
 * panel — el polling no continúa en background. Cada apertura re-fetchea.
 */
export function NotificationsDropdown({
  id,
  onClose,
  initialUnreadCount,
  onUnreadCountChange,
  triggerRef,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const markAllRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const [state, setState] = useState<DropdownState>({
    items: [],
    unreadCount: initialUnreadCount,
    isLoading: true,
  });
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Sincroniza el conteo local hacia el padre (NotifBell pinta el dot rojo).
  useEffect(() => {
    onUnreadCountChange(state.unreadCount);
  }, [state.unreadCount, onUnreadCountChange]);

  // Fetch + polling con pausa en visibilitychange.
  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/recent', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as FetchResponse;
      setState({ items: data.items, unreadCount: data.unreadCount, isLoading: false });
    } catch {
      // Red caída u otro fallo silencioso: mantenemos el último estado.
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let initialTimeout: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const start = () => {
      stop();
      interval = setInterval(fetchOnce, POLL_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Re-fetch al volver visible vía setTimeout 0 para que el setState
        // ocurra fuera del callback síncrono del listener.
        setTimeout(fetchOnce, 0);
        start();
      }
    };

    // Si la pestaña ya está oculta al montar, no arrancamos polling ni
    // fetch — el listener de visibilitychange los disparará cuando vuelva
    // a estar visible.
    if (!document.hidden) {
      // Fetch inicial diferido a la siguiente tick — fuera del effect
      // síncrono para no violar `react-hooks/set-state-in-effect`. La
      // diferencia perceptible es nula (el componente ya pinta el skeleton).
      initialTimeout = setTimeout(fetchOnce, 0);
      start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchOnce]);

  // Escape global cierra el panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Click fuera (desktop): `mousedown` en document filtrado por ref del
  // dialog y del trigger. Si fue dentro de cualquiera, no cerramos —
  // el trigger ya hace toggle por su cuenta.
  // En mobile el overlay `<button>` hace su propio `onClick={onClose}`.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dialogRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose, triggerRef]);

  // Auto-focus al abrir: priorizar el botón "Marcar todas" si está habilitado,
  // si no, el primer item.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (markAllRef.current && !markAllRef.current.disabled) {
        markAllRef.current.focus();
        return;
      }
      firstItemRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [state.isLoading, state.items.length]);

  // Enriquece cada row con derivados puros (icono, href, tiempo relativo,
  // bucket). El bucket se recalcula client-side respecto a `Date.now()` —
  // la diferencia <1s con el server es irrelevante para los buckets.
  const displays = useMemo<NotificationDisplay[]>(() => {
    const now = new Date();
    return state.items.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
      href: getNotificationHref(row),
      iconName: getNotificationIcon(row.type),
      relativeTime: formatRelativeTime(row.created_at, now),
      bucket: getNotificationBucket(row.created_at, now),
    }));
  }, [state.items]);

  // Agrupa por bucket preservando el orden `today → week → older` y el
  // orden interno (ya viene `created_at desc` desde el server).
  const groupedDisplays = useMemo(() => {
    const groups: Record<NotificationBucket, NotificationDisplay[]> = {
      today: [],
      week: [],
      older: [],
    };
    for (const display of displays) {
      groups[display.bucket].push(display);
    }
    return BUCKET_ORDER.map((bucket) => [bucket, groups[bucket]] as const).filter(
      ([, items]) => items.length > 0,
    );
  }, [displays]);

  const handleItemClick = useCallback(
    (item: NotificationDisplay) => {
      const wasUnread = item.readAt === null;

      // Optimistic UI antes de cerrar para que la transición salga con el
      // estado correcto si el panel se reabre rápido.
      if (wasUnread) {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((it) =>
            it.id === item.id ? { ...it, read_at: new Date().toISOString() } : it,
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      }

      onClose();
      if (item.href) {
        router.push(item.href);
      }

      // Fire-and-forget consciente: la navegación no debe esperar la action.
      // Si falla, el próximo poll o re-apertura resincroniza.
      if (wasUnread) {
        void markAsRead(item.id);
      }
    },
    [onClose, router],
  );

  const handleMarkAll = useCallback(async () => {
    if (state.unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);

    // Optimistic: todos los items pasan a leídos.
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.read_at === null ? { ...it, read_at: nowIso } : it)),
      unreadCount: 0,
    }));

    try {
      const result = await markAllAsRead();
      if (!result.ok) {
        // Re-fetch silencioso para resincronizar el estado real desde DB.
        void fetchOnce();
      }
    } finally {
      setIsMarkingAll(false);
    }
  }, [state.unreadCount, isMarkingAll, fetchOnce]);

  const showEmpty = !state.isLoading && state.items.length === 0;
  const showLoading = state.isLoading && state.items.length === 0;

  return (
    <>
      {/* Overlay mobile — click cierra. Oculto en sm+. */}
      <button
        type="button"
        aria-label="Cerrar notificaciones"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-on-background/30 sm:hidden"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="notifications-title"
        aria-busy={state.isLoading || undefined}
        id={id}
        className={cn(
          // Mobile: bottom-sheet full width.
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-xl border-t border-divider bg-surface shadow-dropdown',
          'duration-200 animate-in slide-in-from-bottom',
          // sm+: popover anclado al NotifBell.
          'sm:absolute sm:inset-auto sm:top-12 sm:right-0 sm:bottom-auto sm:max-h-[28rem] sm:w-[22rem] sm:max-w-sm sm:rounded-lg sm:border sm:slide-in-from-top-2',
        )}
      >
        <NotificationsHeader
          unreadCount={state.unreadCount}
          onMarkAll={handleMarkAll}
          isMarkingAll={isMarkingAll}
          markAllRef={markAllRef}
        />

        <div className="flex-1 overflow-y-auto">
          {showLoading ? (
            <LoadingSkeleton />
          ) : showEmpty ? (
            <EmptyNotifications />
          ) : (
            <ul>
              {groupedDisplays.map(([bucket, items], bucketIdx) => (
                <li key={bucket}>
                  <h3 className="sticky top-0 z-[1] bg-background px-4 py-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
                    {BUCKET_LABEL[bucket]}
                  </h3>
                  <ul>
                    {items.map((item, itemIdx) => {
                      const isFirst = bucketIdx === 0 && itemIdx === 0;
                      return (
                        <NotificationItem
                          key={item.id}
                          item={item}
                          onClick={handleItemClick}
                          ref={isFirst ? firstItemRef : null}
                        />
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Skeleton de carga (spec §5.6). 4 filas que imitan el layout del item.
 * Usa `bg-neutral-200`/`bg-neutral-100` — neutrales auxiliares
 * autorizados por `docs/design-system.md` para skeleton.
 */
function LoadingSkeleton() {
  return (
    <ul className="divide-y divide-divider-soft" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-neutral-200" />
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-neutral-200" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <span className="block h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
