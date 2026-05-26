import Image from 'next/image';
import Link from 'next/link';
import { Badge, Icon } from '@/components/ui';
import { getImageUrl } from '@/lib/images/get-image-url';
import type { VisitForCard } from '@/lib/profile/queries';
import { cn } from '@/lib/utils/cn';

export interface VisitCardProps {
  visit: VisitForCard;
  /** Si true, muestra "Reagendar" + "Cómo llegar". Si false, sólo "Cómo llegar". */
  isUpcoming: boolean;
}

/**
 * Formatea una fecha UTC a "DD MMM, HH:MM" en la zona local de la propiedad.
 * Ejemplo es-MX en zona `America/Los_Angeles`: "24 OCT, 14:00".
 *
 * Usamos hour12=false para neutralidad regional (decisión coherente con
 * `schedule_visit_screen`).
 */
function formatScheduledAt(isoUtc: string, timeZone: string): string {
  const date = new Date(isoUtc);
  const datePart = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    timeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
  // Material Icons / es-MX devuelve "24 oct" → uppercase para el caption.
  return `${datePart.toUpperCase()}, ${timePart}`;
}

interface StatusBadgeMeta {
  label: string;
  variant: 'soft' | 'danger' | 'neutral';
}

const STATUS_BADGE: Partial<Record<VisitForCard['status'], StatusBadgeMeta>> = {
  pending: { label: 'Pendiente', variant: 'soft' },
  rescheduled: { label: 'Reagendada', variant: 'soft' },
  completed: { label: 'Realizada', variant: 'soft' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
  no_show: { label: 'No asistió', variant: 'neutral' },
};

function buildDirectionsUrl(p: VisitForCard['property']): string {
  const parts = [p.address_line, p.city, p.state, p.country].filter((v): v is string =>
    Boolean(v && v.trim()),
  );
  const query = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Card horizontal de visita (thumb + contenido + CTAs). Mobile: stackeada en
 * columna. md+: row con thumb a la izquierda y CTAs a la derecha.
 */
export function VisitCard({ visit, isUpcoming }: VisitCardProps) {
  const { property, agent } = visit;
  const imageUrl = property.main_image ? getImageUrl(property.main_image.storage_path) : null;
  const altText = property.main_image?.alt_text ?? property.title;
  const dateLabel = formatScheduledAt(visit.scheduled_at, property.timezone);
  const agentName = agent.full_name?.trim() || agent.email;
  const directionsUrl = buildDirectionsUrl(property);
  const statusMeta = STATUS_BADGE[visit.status];

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-divider-soft bg-surface p-2 shadow-card',
        'transition-shadow hover:shadow-soft-hover',
        'md:flex-row md:items-center md:gap-0',
      )}
    >
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg md:h-24 md:w-48">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText}
            fill
            sizes="(min-width: 768px) 12rem, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-soft text-muted">
            <Icon name="apartment" size="lg" />
          </div>
        )}
      </div>

      <div className="flex w-full flex-1 flex-col gap-3 p-2 md:flex-row md:items-center md:justify-between md:gap-4 md:p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-primary uppercase">
            <Icon name="calendar_today" size="sm" />
            <time dateTime={visit.scheduled_at}>{dateLabel}</time>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-on-surface">{property.title}</h3>
            {statusMeta && (
              <Badge variant={statusMeta.variant} size="sm" uppercase>
                {statusMeta.label}
              </Badge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <Icon name="person" size="sm" />
            <span className="truncate">Agente: {agentName}</span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:shrink-0">
          {isUpcoming && (
            <Link
              href={`/property/${property.id}/schedule?reschedule=${visit.id}`}
              className={cn(
                'inline-flex h-10 items-center justify-center rounded border border-outline px-4 text-sm font-medium text-on-surface',
                'transition-colors hover:bg-surface-hover hover:text-on-surface',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
                'sm:flex-1 md:flex-none',
              )}
            >
              Reagendar
            </Link>
          )}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex h-10 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-on-primary shadow-soft',
              'transition-colors hover:bg-primary-hover',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
              isUpcoming ? 'sm:flex-1 md:flex-none' : 'w-full md:w-auto',
            )}
          >
            Cómo llegar
          </a>
        </div>
      </div>
    </article>
  );
}
