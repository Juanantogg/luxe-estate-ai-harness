'use client';

import { Icon, IconButton } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export type GalleryImageStatus = 'ready' | 'uploading' | 'error';

export interface GalleryThumbProps {
  /** ID interno para reconciliar acciones; no es el id de DB. */
  localId: string;
  /** URL renderizable de preview (object URL local o URL pública del bucket). */
  previewUrl: string;
  status: GalleryImageStatus;
  /** Progreso 0..100 cuando `status === 'uploading'`. */
  progress?: number;
  isMain: boolean;
  altText?: string | null;
  onDelete: (localId: string) => void;
  onMarkMain: (localId: string) => void;
  onRetry?: (localId: string) => void;
}

/**
 * Tile individual de la grilla de imágenes (spec §8.5). Pinta el thumbnail,
 * un badge MAIN si corresponde, y al hover muestra dos acciones: eliminar
 * y marcar como principal.
 */
export function GalleryThumb({
  localId,
  previewUrl,
  status,
  progress,
  isMain,
  altText,
  onDelete,
  onMarkMain,
  onRetry,
}: GalleryThumbProps) {
  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg border border-divider-soft bg-surface shadow-card',
        status === 'error' && 'border-danger',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={altText ?? 'Imagen de propiedad'}
        className="h-full w-full object-cover"
      />

      {status === 'uploading' ? (
        <div className="absolute inset-x-2 bottom-2 rounded-full bg-on-surface/70 backdrop-blur-sm">
          <div
            className="h-1.5 rounded-full bg-on-primary transition-all"
            style={{ width: `${Math.min(Math.max(progress ?? 0, 0), 100)}%` }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-on-surface/70 text-on-primary backdrop-blur-sm">
          <Icon name="error_outline" size="md" />
          <p className="text-xs">Error al subir</p>
          {onRetry ? (
            <button
              type="button"
              onClick={() => onRetry(localId)}
              className="rounded bg-on-primary px-2 py-1 text-xs font-medium text-on-surface hover:bg-on-primary/90"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {isMain ? (
        <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-on-primary uppercase">
          Principal
        </span>
      ) : null}

      {status === 'ready' ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-on-surface/0 opacity-0 backdrop-blur-[2px] transition-all group-hover:bg-on-surface/55 group-hover:opacity-100 focus-within:bg-on-surface/55 focus-within:opacity-100">
          <IconButton
            icon={isMain ? 'star' : 'star_border'}
            variant={isMain ? 'primary' : 'ghost'}
            size="sm"
            aria-label={isMain ? 'Imagen principal' : 'Marcar como principal'}
            onClick={() => onMarkMain(localId)}
            className={cn(
              !isMain && 'bg-surface/90 text-on-surface hover:bg-surface',
              'shadow-card',
            )}
          />
          <IconButton
            icon="delete"
            variant="ghost"
            size="sm"
            aria-label="Eliminar imagen"
            onClick={() => onDelete(localId)}
            className="bg-surface/90 text-danger shadow-card hover:bg-surface"
          />
        </div>
      ) : null}
    </div>
  );
}
