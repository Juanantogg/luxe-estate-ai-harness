import Image from 'next/image';
import { AgentBadge } from '@/components/property/AgentBadge';
import { Badge, Icon } from '@/components/ui';
import { getImageUrl } from '@/lib/images/get-image-url';
import { deriveListingBadge } from '@/lib/properties/derive-badges';
import { formatArea, formatPriceParts } from '@/lib/properties/format';
import type { PropertyForDetail } from '@/lib/properties/queries';
import { formatTimezoneLabel } from '@/lib/visits/timezone-label';

export interface VisitPropertySummaryProps {
  property: PropertyForDetail;
  isAuthenticated: boolean;
}

/**
 * Sidebar del schedule_visit_screen: foto + badge listing + título +
 * dirección + label de timezone + divisor + precio + specs + AgentBadge.
 *
 * Server Component: solo presentación; no hay estado.
 */
export function VisitPropertySummary({ property, isAuthenticated }: VisitPropertySummaryProps) {
  const mainImage = property.images[0] ?? null;
  const priceParts = formatPriceParts(property.price, property.listing_type);
  const listingBadge = deriveListingBadge(property.listing_type);

  const regionPart = property.state ?? property.country ?? '';
  const addressLine = `${property.address_line}, ${property.city}${regionPart ? `, ${regionPart}` : ''}`;
  const tzLabel = formatTimezoneLabel(property.timezone);

  const areaLabel = formatArea(property.area_sqm);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-hover">
        {mainImage ? (
          <Image
            src={getImageUrl(mainImage.storage_path)}
            alt={mainImage.alt_text ?? property.title}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Icon name="image" size="lg" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge variant="soft" size="sm" uppercase>
            {listingBadge.label}
          </Badge>
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-medium text-on-surface md:text-2xl">{property.title}</h2>
        <p className="flex items-start gap-1 text-sm text-muted">
          <Icon name="place" size="sm" className="mt-0.5 text-primary" />
          <span className="leading-snug">{addressLine}</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Icon name="schedule" size="xs" />
          <span>Zona horaria: {tzLabel}</span>
        </p>
      </div>

      <div className="h-px bg-divider-soft" />

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Precio</p>
        <p className="text-2xl font-bold text-primary md:text-3xl">
          {priceParts.base}
          {priceParts.suffix && (
            <span className="ml-1 text-base font-normal text-muted">{priceParts.suffix}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium tracking-wider text-on-surface uppercase">
          <span className="inline-flex items-center gap-1">
            <Icon name="bed" size="sm" className="text-primary" />
            {property.bedrooms} hab
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="bathtub" size="sm" className="text-primary" />
            {property.bathrooms} baños
          </span>
          {areaLabel && (
            <span className="inline-flex items-center gap-1">
              <Icon name="square_foot" size="sm" className="text-primary" />
              {areaLabel}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-divider-soft" />

      <AgentBadge
        owner={property.owner}
        isAuthenticated={isAuthenticated}
        propertySlug={property.slug}
      />
    </div>
  );
}
