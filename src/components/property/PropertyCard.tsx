import Image from 'next/image';
import Link from 'next/link';
import { Badge, Icon } from '@/components/ui';
import { getImageUrl } from '@/lib/images/get-image-url';
import { deriveBadge, deriveListingBadge } from '@/lib/properties/derive-badges';
import { formatArea } from '@/lib/properties/format';
import type { PropertyForCard } from '@/lib/properties/queries';
import { cn } from '@/lib/utils/cn';
import { FavoriteButton } from './FavoriteButton';
import { PriceTag } from './PriceTag';

export type PropertyCardVariant = 'featured' | 'compact';

export interface PropertyCardProps {
  property: PropertyForCard;
  variant: PropertyCardVariant;
  isFavorite: boolean;
  /** Si false, el corazón redirige a `/login?next=/` en vez de mutar. */
  isAuthenticated: boolean;
  /** Pasar `true` solo en las cards above-the-fold (las primeras 2). */
  priority?: boolean;
}

/**
 * Card de propiedad reutilizable. NO usa el primitivo `Card` porque necesita
 * `group`, `overflow-hidden` y composición específica (badge absoluto, heart
 * absoluto, link absoluto sobre toda la card). El primitivo `Card` apunta a
 * casos genéricos.
 *
 * Patrón de click: el `<Link>` que cubre la card va con `z-10` y el
 * `FavoriteButton` con `z-20`. Eso permite que el heart sea clickeable sin
 * `stopPropagation` adicional en el lado del padre.
 */
export function PropertyCard({
  property,
  variant,
  isFavorite,
  isAuthenticated,
  priority = false,
}: PropertyCardProps) {
  return variant === 'featured' ? (
    <FeaturedPropertyCard
      property={property}
      isFavorite={isFavorite}
      isAuthenticated={isAuthenticated}
      priority={priority}
    />
  ) : (
    <CompactPropertyCard
      property={property}
      isFavorite={isFavorite}
      isAuthenticated={isAuthenticated}
      priority={priority}
    />
  );
}

interface InternalCardProps {
  property: PropertyForCard;
  isFavorite: boolean;
  isAuthenticated: boolean;
  priority: boolean;
}

function FeaturedPropertyCard({
  property,
  isFavorite,
  isAuthenticated,
  priority,
}: InternalCardProps) {
  const derived = deriveBadge(property);
  const imageUrl = property.main_image ? getImageUrl(property.main_image.storage_path) : null;
  const altText = property.main_image?.alt_text ?? property.title;
  const area = formatArea(property.area_sqm);
  const regionLabel = property.state ?? property.country ?? '';

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl bg-surface shadow-soft',
        'transition-shadow duration-300 hover:shadow-soft-hover',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
      )}
    >
      <Link
        href={`/property/${property.id}`}
        aria-label={`Ver detalle de ${property.title}`}
        className="absolute inset-0 z-10 focus:outline-none"
      >
        <span className="sr-only">{property.title}</span>
      </Link>

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText}
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-soft text-muted">
            <Icon name="apartment" size="xl" />
          </div>
        )}

        {derived.label && (
          <div className="absolute top-4 left-4 z-20">
            <Badge variant="soft" size="sm" uppercase>
              {derived.label}
            </Badge>
          </div>
        )}

        <FavoriteButton
          propertyId={property.id}
          initialIsFavorite={isFavorite}
          isAuthenticated={isAuthenticated}
          size="lg"
          className="absolute top-4 right-4 z-20"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
      </div>

      <div className="relative p-4 md:p-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-medium text-on-surface transition-colors group-hover:text-primary">
              {property.title}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <Icon name="place" size="sm" />
              <span className="truncate">
                {property.city}
                {regionLabel ? `, ${regionLabel}` : ''}
              </span>
            </p>
          </div>
          <PriceTag
            amount={property.price}
            listingType={property.listing_type}
            variant="featured"
            className="shrink-0"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-divider-soft pt-6 text-sm text-muted">
          <span className="flex items-center gap-2">
            <Icon name="king_bed" size="md" />
            {property.bedrooms} hab
          </span>
          <span className="flex items-center gap-2">
            <Icon name="bathtub" size="md" />
            {property.bathrooms} baños
          </span>
          {area && (
            <span className="flex items-center gap-2">
              <Icon name="square_foot" size="md" />
              {area}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactPropertyCard({
  property,
  isFavorite,
  isAuthenticated,
  priority,
}: InternalCardProps) {
  const listingBadge = deriveListingBadge(property.listing_type);
  const imageUrl = property.main_image ? getImageUrl(property.main_image.storage_path) : null;
  const altText = property.main_image?.alt_text ?? property.title;
  const area = formatArea(property.area_sqm);

  const listingBadgeClasses =
    listingBadge.kind === 'rent'
      ? 'bg-primary/90 text-on-primary backdrop-blur-sm'
      : 'bg-surface-inverse/90 text-on-surface-inverse backdrop-blur-sm';

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-card',
        'transition-all duration-300 hover:shadow-soft',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
      )}
    >
      <Link
        href={`/property/${property.id}`}
        aria-label={`Ver detalle de ${property.title}`}
        className="absolute inset-0 z-10 focus:outline-none"
      >
        <span className="sr-only">{property.title}</span>
      </Link>

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText}
            fill
            sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-soft text-muted">
            <Icon name="apartment" size="lg" />
          </div>
        )}

        <FavoriteButton
          propertyId={property.id}
          initialIsFavorite={isFavorite}
          isAuthenticated={isAuthenticated}
          size="md"
          className="absolute top-3 right-3 z-20"
        />

        <div className="absolute bottom-3 left-3 z-20">
          <Badge size="sm" uppercase className={listingBadgeClasses}>
            {listingBadge.label}
          </Badge>
        </div>
      </div>

      <div className="flex flex-grow flex-col p-4">
        <PriceTag amount={property.price} listingType={property.listing_type} variant="compact" />
        <h4 className="mt-1 mb-1 truncate font-medium text-on-surface">{property.title}</h4>
        <p className="mb-4 text-xs text-muted">
          {property.address_line}, {property.city}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-divider-soft pt-3">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Icon name="king_bed" size="sm" className="text-primary/80" />
            {property.bedrooms}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Icon name="bathtub" size="sm" className="text-primary/80" />
            {property.bathrooms}
          </span>
          {area && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Icon name="square_foot" size="sm" className="text-primary/80" />
              {area}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
