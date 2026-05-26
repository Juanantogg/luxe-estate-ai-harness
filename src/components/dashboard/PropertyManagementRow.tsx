import Image from 'next/image';
import Link from 'next/link';
import { Avatar, Badge, Icon } from '@/components/ui';
import { getImageUrl } from '@/lib/images/get-image-url';
import type { PropertyForManagement } from '@/lib/dashboard/queries';
import { formatArea, formatPrice, getStatusBadgeProps } from '@/lib/properties/format';
import { cn } from '@/lib/utils/cn';
import { DeletePropertyButton } from './DeletePropertyButton';
import { EditPropertyLink } from './EditPropertyLink';
import { RestorePropertyButton } from './RestorePropertyButton';

export type ManagementViewerMode = 'agent' | 'admin';

export interface PropertyManagementRowProps {
  property: PropertyForManagement;
  viewerMode: ManagementViewerMode;
}

const PUBLIC_STATUSES = new Set<PropertyForManagement['listing_status']>([
  'active',
  'pending',
  'sold',
  'rented',
]);

/**
 * Renderiza la fila de una propiedad en el dashboard de gestión.
 *
 * - md+: layout 12-col grid (4 columnas: Propiedad / Precio / Estado /
 *   Acciones, o 5 columnas en modo admin con "Propietario" en col-span-2).
 * - <md: card stacked vertical con thumbnail + título + meta + precio +
 *   badge + acciones.
 *
 * Decisiones (spec §"Componentes > PropertyManagementRow"):
 *  - El título es link a `/property/[id]` con `target="_blank"` **solo si**
 *    `listing_status` es público (`active|pending|sold|rented`).
 *    Para `draft`/`archived`, es texto plano con tooltip
 *    `title="No disponible públicamente"`.
 *  - Si `listing_status === 'archived'`, las acciones muestran solo
 *    `RestorePropertyButton`. Sino, `EditPropertyLink` +
 *    `DeletePropertyButton`.
 *  - Modo admin agrega columna "Propietario" (avatar + nombre).
 */
export function PropertyManagementRow({ property, viewerMode }: PropertyManagementRowProps) {
  const isAdminMode = viewerMode === 'admin';
  const isArchived = property.listing_status === 'archived';
  const isPublic = PUBLIC_STATUSES.has(property.listing_status);

  const badgeProps = getStatusBadgeProps(property.listing_status);
  const formattedPrice = formatPrice(property.price, property.listing_type);
  const formattedArea = formatArea(property.area_sqm);
  const ownerName = property.owner_profile?.full_name?.trim() || 'Sin nombre';
  const ownerAvatarUrl = property.owner_profile?.avatar_url ?? null;
  const thumbnailUrl = property.main_image ? getImageUrl(property.main_image.storage_path) : null;

  // -----------------------------------------------------------------
  // Sub-bloques renderizables: extraemos para no duplicar entre
  // breakpoints. Cada bloque pinta su variante visual completa.
  // -----------------------------------------------------------------

  const titleNode = isPublic ? (
    <Link
      href={`/property/${property.id}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver "${property.title}" en pestaña nueva`}
      className="inline-flex items-baseline gap-1.5 rounded-sm text-base font-bold text-on-surface transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none md:text-lg"
    >
      <span>{property.title}</span>
      <Icon name="open_in_new" size="xs" className="shrink-0 text-muted" aria-hidden="true" />
    </Link>
  ) : (
    <span
      title="No disponible públicamente"
      className="text-base font-bold text-on-surface md:text-lg"
    >
      {property.title}
    </span>
  );

  const thumbnailNode = (
    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt={property.main_image?.alt_text ?? property.title}
          fill
          sizes="112px"
          className="object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-surface-soft text-primary"
          aria-hidden="true"
        >
          <Icon name="apartment" size="lg" />
        </div>
      )}
    </div>
  );

  const metaNode = (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <li className="inline-flex items-center gap-1">
        <Icon name="bed" size="xs" />
        <span>{property.bedrooms} habs</span>
      </li>
      <li className="inline-flex items-center gap-1">
        <Icon name="bathtub" size="xs" />
        <span>{property.bathrooms} baños</span>
      </li>
      {formattedArea && (
        <li className="inline-flex items-center gap-1">
          <Icon name="square_foot" size="xs" />
          <span>{formattedArea}</span>
        </li>
      )}
    </ul>
  );

  const priceNode = (
    <div className="flex flex-col">
      <span className="text-base font-semibold text-on-surface">{formattedPrice}</span>
      {property.listing_type === 'rent' && (
        <span className="text-xs text-muted">Renta mensual</span>
      )}
    </div>
  );

  const badgeNode = (
    <Badge variant={badgeProps.variant} size="md" withDot>
      {badgeProps.label}
    </Badge>
  );

  const actionsNode = (
    <div className="flex items-center justify-end gap-1.5">
      {isArchived ? (
        <RestorePropertyButton propertyId={property.id} propertyTitle={property.title} />
      ) : (
        <>
          <EditPropertyLink propertyId={property.id} propertyTitle={property.title} />
          <DeletePropertyButton propertyId={property.id} propertyTitle={property.title} />
        </>
      )}
    </div>
  );

  const ownerNode = isAdminMode && (
    <div className="flex items-center gap-2">
      <Avatar
        size="sm"
        src={ownerAvatarUrl ?? undefined}
        name={ownerName}
        alt={`Avatar de ${ownerName}`}
      />
      <span className="truncate text-sm text-on-surface">{ownerName}</span>
    </div>
  );

  // -----------------------------------------------------------------
  // Layout: mobile card (<md) vs desktop grid (md+).
  // Usamos `<li>` dentro de un `<ul role="list">` (spec §"Estructura
  // semántica > Alternativa A.2"). El a11y se cubre con aria-labelledby
  // apuntando al título.
  // -----------------------------------------------------------------

  const titleId = `property-mgmt-row-${property.id}`;

  return (
    <li
      aria-labelledby={titleId}
      className={cn(
        'group border-b border-divider-soft transition-colors last:border-b-0 hover:bg-surface-hover',
      )}
    >
      {/* Mobile card */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        <div className="flex items-start gap-4">
          {thumbnailNode}
          <div className="min-w-0 flex-1">
            <div id={titleId} className="break-words">
              {titleNode}
            </div>
            <p className="mt-1 text-sm text-muted">
              {property.address_line}, {property.city}
            </p>
            {isAdminMode && <p className="mt-1 text-xs text-muted">por {ownerName}</p>}
          </div>
        </div>
        {metaNode}
        <div className="flex items-center justify-between">
          {priceNode}
          {badgeNode}
        </div>
        <div className="flex justify-end">{actionsNode}</div>
      </div>

      {/* Desktop grid */}
      <div className={cn('hidden grid-cols-12 items-center gap-4 px-6 py-5 md:grid')}>
        {/* Propiedad */}
        <div className={cn('flex items-start gap-4', isAdminMode ? 'col-span-4' : 'col-span-6')}>
          {thumbnailNode}
          <div className="min-w-0 flex-1">
            <div id={titleId} className="break-words">
              {titleNode}
            </div>
            <p className="mt-1 text-sm text-muted">
              {property.address_line}, {property.city}
            </p>
            <div className="mt-2">{metaNode}</div>
          </div>
        </div>

        {isAdminMode && <div className="col-span-2 min-w-0">{ownerNode}</div>}

        <div className="col-span-2">{priceNode}</div>
        <div className="col-span-2">{badgeNode}</div>
        <div className="col-span-2 text-right">{actionsNode}</div>
      </div>
    </li>
  );
}
