'use client';

import { forwardRef } from 'react';
import { Icon } from '@/components/ui';
import type { NotificationDisplay } from '@/lib/notifications/types';
import { cn } from '@/lib/utils/cn';

export interface NotificationItemProps {
  item: NotificationDisplay;
  onClick: (item: NotificationDisplay) => void;
}

/**
 * Item individual del dropdown (spec §5.4).
 *
 * Comportamiento: el componente es presentacional puro; el flujo de click
 * (optimistic UI + navegación + markAsRead) lo orquesta el
 * `NotificationsDropdown` vía la prop `onClick`.
 *
 * Detalle visual:
 * - Si `readAt === null`: fondo `bg-primary-soft` + dot `bg-primary` a la
 *   izquierda + título `font-semibold`.
 * - Si leída: fondo transparente, dot invisible, título `font-medium`.
 *
 * Cada item es un `<button>` (no `<a>`) porque el click ejecuta primero
 * `markAsRead` y luego navega condicionalmente con `router.push`. La
 * decisión MVP (spec §6.9) acepta que `Cmd+Click` no abra en pestaña
 * nueva — patrón aceptado para popovers de notificaciones.
 */
export const NotificationItem = forwardRef<HTMLButtonElement, NotificationItemProps>(
  function NotificationItem({ item, onClick }, ref) {
    const isUnread = item.readAt === null;

    return (
      <li className="border-b border-divider-soft last:border-b-0">
        <button
          ref={ref}
          type="button"
          onClick={() => onClick(item)}
          className={cn(
            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
            'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
            isUnread && 'bg-primary-soft',
          )}
        >
          {/* Dot izquierda: visible solo si sin leer (ocupa espacio igualmente
              para alineación constante entre leídas/sin leer). */}
          <span
            aria-hidden="true"
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              isUnread ? 'bg-primary' : 'bg-transparent',
            )}
          />

          {/* Avatar de icono por tipo */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name={item.iconName} size="sm" />
          </span>

          {/* Texto */}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm text-on-surface',
                isUnread ? 'font-semibold' : 'font-medium',
              )}
            >
              {item.title}
            </p>
            {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>}
            <p className="mt-1 text-xs text-muted">
              <time dateTime={item.createdAt}>{item.relativeTime}</time>
            </p>
          </div>
        </button>
      </li>
    );
  },
);
