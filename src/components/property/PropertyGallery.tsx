'use client';

import Image from 'next/image';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
}

export interface PropertyGalleryProps {
  images: GalleryImage[];
  title: string;
  initialIndex?: number;
  /**
   * Render slot para badges/overlays absolutos sobre la imagen principal
   * (ej. `EXCLUSIVA`, `NUEVA`, `FavoriteButton`). Se renderiza dentro del
   * contenedor `aspect-[16/10]` con `z-20`. El componente decide el
   * posicionamiento.
   */
  overlays?: React.ReactNode;
}

/**
 * Galería principal + tira de thumbnails scrollable horizontal.
 *
 * Cliente porque mantiene `mainIndex` localmente. El "Ver galería completa"
 * NO abre lightbox (decisión MVP §9 D6): hace `scrollIntoView` sobre la
 * fila de thumbnails para guiar al usuario.
 *
 * Edge cases:
 * - `images.length === 0` → renderiza un placeholder con `Icon` "apartment"
 *   centrado y omite la fila de thumbnails.
 * - `images.length === 1` → omite la fila de thumbnails.
 */
export function PropertyGallery({
  images,
  title,
  initialIndex = 0,
  overlays,
}: PropertyGalleryProps) {
  const [mainIndex, setMainIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const mainImage = images[mainIndex];

  const handleThumbnailKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setMainIndex(index);
    }
  };

  const scrollToThumbnails = () => {
    thumbsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="space-y-4">
      <div className="group relative aspect-[16/10] overflow-hidden rounded-xl bg-surface-soft shadow-card">
        {mainImage ? (
          <Image
            key={mainImage.id}
            src={mainImage.src}
            alt={mainImage.alt || title}
            fill
            sizes="(min-width:1024px) 66vw, 100vw"
            priority
            className="object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Icon name="apartment" size="xl" />
          </div>
        )}

        {overlays}

        {images.length > 1 && (
          <button
            type="button"
            onClick={scrollToThumbnails}
            className="absolute right-4 bottom-4 z-20 inline-flex items-center gap-2 rounded-lg bg-surface/90 px-4 py-2 text-sm font-medium text-on-surface shadow-soft backdrop-blur-sm transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Icon name="grid_view" size="sm" />
            Ver galería completa
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div
          ref={thumbsRef}
          className="hide-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Miniaturas de la galería"
        >
          {images.map((image, index) => {
            const isActive = index === mainIndex;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setMainIndex(index)}
                onKeyDown={(event) => handleThumbnailKey(event, index)}
                role="tab"
                aria-selected={isActive}
                aria-label={`Mostrar imagen ${index + 1} de ${images.length}`}
                className={cn(
                  'relative aspect-[4/3] w-32 flex-none cursor-pointer snap-start overflow-hidden rounded-lg ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all sm:w-40',
                  'focus-visible:ring-primary focus-visible:outline-none',
                  isActive
                    ? 'opacity-100 ring-primary'
                    : 'opacity-70 hover:opacity-100 hover:ring-primary/40',
                )}
              >
                <Image
                  src={image.src}
                  alt={image.alt || `${title} — imagen ${index + 1}`}
                  fill
                  sizes="(max-width:640px) 30vw, 15vw"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
