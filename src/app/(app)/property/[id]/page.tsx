import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/Footer';
import {
  FavoriteButton,
  MortgageCard,
  PriceAndAgentCard,
  PropertyAbout,
  PropertyAmenitiesList,
  PropertyFeatures,
  PropertyGallery,
  PropertyMapPreview,
} from '@/components/property';
import { Badge, Icon } from '@/components/ui';
import { getImageUrl } from '@/lib/images/get-image-url';
import { deriveBadge, deriveListingBadge } from '@/lib/properties/derive-badges';
import { getPropertyDetail, getUserFavoriteIds } from '@/lib/properties/queries';
import { createClient } from '@/lib/supabase/server';

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detalle público de propiedad. Render server-side con joins (images,
 * amenities, owner profile) y soporte para visitante anónimo.
 *
 * Reglas:
 * - `notFound()` si RLS oculta la propiedad o no existe (incluye el caso
 *   anon viendo una propiedad no-`active`).
 * - Heart, CTAs y bloques de contacto se degradan a redirects de login
 *   con `next=/property/[id]` cuando no hay sesión.
 * - Si el visitante es el dueño, los CTAs cambian a "Editar en dashboard"
 *   y se oculta el heart.
 */
export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  const property = await getPropertyDetail(supabase, id, { isAuthenticated });
  if (!property) notFound();

  const isOwner = Boolean(user && property.owner_id === user.id);
  const isFavorite =
    user && !isOwner
      ? (await getUserFavoriteIds(supabase, user.id, [property.id])).has(property.id)
      : false;

  const galleryImages = property.images.map((image) => ({
    id: image.id,
    src: getImageUrl(image.storage_path),
    alt: image.alt_text ?? property.title,
  }));

  const exclusiveOrNewBadge = deriveBadge({
    is_featured: property.is_featured,
    is_premium: property.is_premium,
    price: property.price,
    previous_price: property.previous_price,
    published_at: property.published_at,
    listing_type: property.listing_type,
  });
  const listingBadge = deriveListingBadge(property.listing_type);

  const galleryOverlays = (
    <>
      {/* Badges superiores izquierda */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
        {exclusiveOrNewBadge.label && (
          <Badge
            variant={exclusiveOrNewBadge.kind === 'exclusive' ? 'primary' : 'soft'}
            size="md"
            uppercase
          >
            {exclusiveOrNewBadge.label}
          </Badge>
        )}
        <Badge variant="soft" size="md" uppercase>
          {listingBadge.label}
        </Badge>
      </div>

      {/* Favorito superior derecha (oculto si dueño) */}
      {!isOwner && (
        <div className="absolute top-4 right-4 z-20">
          <FavoriteButton
            propertyId={property.id}
            initialIsFavorite={isFavorite}
            isAuthenticated={isAuthenticated}
            redirectNext={`/property/${property.id}`}
            size="lg"
          />
        </div>
      )}
    </>
  );

  const addressFull = [
    property.address_line,
    property.city,
    property.state ?? property.country ?? '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:py-8">
        {/* Volver — sólo mobile/tablet */}
        <div className="mb-4 pt-6 lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Icon name="arrow_back" size="sm" />
            Volver
          </Link>
        </div>

        {/* Título accesible (h1 único de la página) */}
        <h1 className="sr-only">{property.title}</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Columna principal — galería + secciones de contenido */}
          <div className="space-y-8 lg:col-span-8">
            <PropertyGallery
              images={galleryImages}
              title={property.title}
              overlays={galleryOverlays}
            />

            {/* Título visible — convive como h2 dentro del flow */}
            <div className="space-y-1">
              <h2 className="text-2xl font-medium text-on-surface md:text-3xl">{property.title}</h2>
              <p className="flex items-center gap-1 text-sm text-muted">
                <Icon name="place" size="sm" className="text-primary" />
                <span className="truncate">{addressFull}</span>
              </p>
            </div>

            <PropertyFeatures
              areaSqm={property.area_sqm}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              parkingSpaces={property.parking_spaces}
            />

            <PropertyAbout description={property.description} />

            <PropertyAmenitiesList amenities={property.amenities} />

            <MortgageCard price={property.price} listingType={property.listing_type} />
          </div>

          {/* Sidebar — sticky en lg+ */}
          <aside className="lg:col-span-4">
            <div className="space-y-6 lg:sticky lg:top-24">
              <PriceAndAgentCard
                property={property}
                isAuthenticated={isAuthenticated}
                isOwner={isOwner}
              />
              <PropertyMapPreview
                latitude={property.latitude}
                longitude={property.longitude}
                address={addressFull}
              />
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </>
  );
}
