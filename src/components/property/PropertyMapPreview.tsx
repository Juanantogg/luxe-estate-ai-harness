import { Icon } from '@/components/ui';

export interface PropertyMapPreviewProps {
  latitude: number | null;
  longitude: number | null;
  address: string;
}

/**
 * Placeholder de mapa. NO usa Google Maps real (decisión MVP); pinta una
 * grilla SVG inline + pin animado al centro. El link "Ver en Google Maps"
 * resuelve a la URL pública de Maps usando lat/lng cuando existen o el
 * address textual como fallback.
 *
 * Server Component: la URL se compone en el render y el ancla es estática.
 */
export function PropertyMapPreview({ latitude, longitude, address }: PropertyMapPreviewProps) {
  const hasCoords = latitude != null && longitude != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="rounded-xl border border-divider-soft bg-surface p-2 shadow-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-soft">
        {/* Patrón de grilla decorativo — sustituye al tile real de Maps */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full text-primary/15"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>

        {/* Pin central animado */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-primary shadow-soft ring-4 ring-surface">
            <Icon name="home" size="sm" className="text-on-primary" />
          </div>
        </div>

        {/* CTA inferior derecho */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-surface/90 px-2 py-1 text-xs font-medium text-on-surface shadow-card backdrop-blur-sm transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Icon name="open_in_new" size="xs" />
          Ver en Google Maps
        </a>
      </div>
    </div>
  );
}
