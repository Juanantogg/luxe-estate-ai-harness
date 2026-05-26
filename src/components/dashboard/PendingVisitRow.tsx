'use client';

import { useState, useTransition } from 'react';
import { Button, Icon } from '@/components/ui';
import { cancelVisit } from '@/lib/visits/actions';

export interface PendingVisitRowProps {
  visit: {
    id: string;
    scheduledAt: string;
    propertyTimezone: string;
    userDisplayName: string;
  };
  onCancelled: (visitId: string) => void;
}

function formatScheduledAt(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Fila dentro del delete-dialog en modo "bloqueado": muestra una visita
 * pendiente con botón para cancelarla individualmente.
 *
 * Estados:
 *  - Idle: muestra fecha+hora + nombre del user + botón "Cancelar".
 *  - Pending: el botón muestra spinner (`loading={true}`).
 *  - Error: alert inline `text-danger text-xs` debajo de la fila.
 *
 * Cuando la cancelación es exitosa, llama a `onCancelled(id)` para que el
 * dialog padre actualice optimistamente el array de pendingVisits.
 */
export function PendingVisitRow({ visit, onCancelled }: PendingVisitRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const formatted = formatScheduledAt(visit.scheduledAt, visit.propertyTimezone);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelVisit({ visitId: visit.id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCancelled(visit.id);
    });
  }

  return (
    <li className="flex flex-col gap-1 border-b border-divider-soft py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <Icon name="event" size="sm" className="text-muted" />
            <span className="truncate">{formatted}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">Agendada por {visit.userDisplayName}</p>
        </div>
        <Button
          variant="danger"
          size="sm"
          leadingIcon="event_busy"
          loading={isPending}
          onClick={handleCancel}
          aria-label={`Cancelar visita del ${formatted}`}
        >
          Cancelar
        </Button>
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
