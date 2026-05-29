import Link from 'next/link';
import { Badge, Button, Icon } from '@/components/ui';
import { getPropertyScheduleUrl, getPropertyUrl } from '@/lib/properties';
import { formatPriceParts } from '@/lib/properties/format';
import type { ListingStatus, PropertyForDetail } from '@/lib/properties/queries';
import { cn } from '@/lib/utils/cn';
import { AgentBadge } from './AgentBadge';

export interface PriceAndAgentCardProps {
  property: PropertyForDetail;
  isAuthenticated: boolean;
  isOwner: boolean;
}

/**
 * Sidebar card que combina precio + dirección + agente + CTAs principales.
 *
 * Reglas de los CTAs (resumen — detalle en design.md §4.4):
 * - Anónimo → "Agendar visita" redirige a `/login?next=/property/[id]`.
 *   (next apunta a la detail, no a /schedule, para evitar 404 tras login
 *    si la pantalla schedule aún no existe.)
 * - Usuario / agente / broker / admin no dueño → "Agendar visita" navega
 *   a `/property/[id]/schedule`.
 * - Dueño → reemplaza "Agendar visita" por "Editar en dashboard" hacia
 *   `/dashboard/properties/[id]/edit`. Oculta "Contactar al agente"
 *   (sería contactarse a sí mismo).
 */
export function PriceAndAgentCard({ property, isAuthenticated, isOwner }: PriceAndAgentCardProps) {
  const priceParts = formatPriceParts(property.price, property.listing_type);
  const previousPriceLower =
    property.previous_price != null && property.price < property.previous_price;

  const statusBadge =
    property.listing_status !== 'active' ? renderStatusBadge(property.listing_status) : null;

  const loginNext = `/login?next=${encodeURIComponent(getPropertyUrl(property))}`;

  const regionPart = property.state ?? property.country ?? '';
  const addressLine = `${property.address_line}, ${property.city}${regionPart ? `, ${regionPart}` : ''}`;

  return (
    <div className="rounded-xl border border-primary/5 bg-surface p-6 shadow-soft">
      {/* Badge de estado (solo para no-active visibles al dueño/admin). */}
      {statusBadge}

      {/* Precio + previous price */}
      <div className="mb-4">
        {previousPriceLower && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm text-muted line-through">
              {formatPriceParts(property.previous_price ?? 0, property.listing_type).base}
            </span>
            <Badge variant="success" size="sm" uppercase>
              Bajó de precio
            </Badge>
          </div>
        )}
        <h2 className={cn('mb-2 font-light text-on-surface', 'text-3xl md:text-4xl')}>
          {priceParts.base}
          {priceParts.suffix && (
            <span className="ml-1 text-base font-normal text-muted">{priceParts.suffix}</span>
          )}
        </h2>
        <p className="flex items-start gap-1 text-sm text-muted">
          <Icon name="location_on" size="sm" className="mt-0.5 text-primary" />
          <span className="leading-snug">{addressLine}</span>
        </p>
      </div>

      <div className="my-6 h-px bg-divider-soft" />

      {/* Agente */}
      <div className="mb-6">
        <AgentBadge
          owner={property.owner}
          isAuthenticated={isAuthenticated}
          propertySlug={property.slug}
        />
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        {isOwner ? (
          <Link
            href={`/dashboard/properties/${property.id}/edit`}
            className="block"
            aria-label="Editar esta propiedad en el dashboard"
          >
            <Button variant="secondary" size="lg" leadingIcon="edit" fullWidth>
              Editar en dashboard
            </Button>
          </Link>
        ) : (
          <Link
            href={isAuthenticated ? getPropertyScheduleUrl(property) : loginNext}
            className="block"
            aria-label="Agendar una visita a esta propiedad"
          >
            <Button variant="primary" size="lg" leadingIcon="calendar_today" fullWidth>
              Agendar visita
            </Button>
          </Link>
        )}

        {!isOwner && (
          <Link
            href={
              isAuthenticated && property.owner?.email
                ? `mailto:${property.owner.email}?subject=${encodeURIComponent(property.title)}`
                : loginNext
            }
            className="block"
            aria-label="Contactar al agente por correo"
          >
            <Button variant="secondary" size="lg" leadingIcon="mail_outline" fullWidth>
              Contactar al agente
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function renderStatusBadge(status: ListingStatus) {
  const labels: Record<ListingStatus, string> = {
    draft: 'Borrador',
    active: 'Activa',
    pending: 'Pendiente',
    sold: 'Vendida',
    rented: 'Rentada',
    archived: 'Archivada',
  };
  const variant: 'warning' | 'neutral' = status === 'pending' ? 'warning' : 'neutral';
  return (
    <div className="mb-4">
      <Badge variant={variant} size="sm" uppercase>
        {labels[status]}
      </Badge>
    </div>
  );
}
