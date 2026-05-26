'use client';

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import {
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  PROPERTY_IMAGES_BUCKET,
  deleteDraftImage,
  getDraftImagePublicUrl,
  getImageValidationMessage,
  uploadDraftImage,
  validateImageFile,
  type ImageValidationError,
} from '@/lib/properties/image-upload';
import { MAX_IMAGES_PER_PROPERTY } from '@/lib/properties/form-schemas';
import { cn } from '@/lib/utils/cn';
import { GalleryThumb, type GalleryImageStatus } from './GalleryThumb';
import { SectionCard } from './SectionCard';

export interface GallerySectionImage {
  localId: string;
  /** Si existe, es una imagen ya persistida en DB. */
  dbId?: string;
  storagePath: string;
  isMain: boolean;
  altText: string | null;
  position: number;
  status: GalleryImageStatus;
  progress: number;
  /** URL de preview (object URL para nuevas, URL pública para existentes). */
  previewUrl: string;
  /** Marca para borrar (solo para imágenes con `dbId`). Si true, no se muestra. */
  deleted?: boolean;
  /** Cacheado para reintentos cuando un upload falla. */
  pendingFile?: File;
}

export interface GallerySectionProps {
  userId: string;
  images: GallerySectionImage[];
  /** Replaza completamente el array de imágenes en el padre. */
  onImagesChange: (images: GallerySectionImage[]) => void;
  /** Error global asociado a `images` (ej. "Subí al menos una imagen"). */
  error?: string;
  /** Cuando true, deshabilita el input file (en submit). */
  disabled?: boolean;
}

function makeImage(file: File, userId: string, makeMain: boolean): GallerySectionImage {
  const localId = crypto.randomUUID();
  return {
    localId,
    storagePath: '', // se llena tras el upload
    isMain: makeMain,
    altText: null,
    position: 0,
    status: 'uploading',
    progress: 5,
    previewUrl: URL.createObjectURL(file),
    pendingFile: file,
  };
}

/**
 * Card 3 — Galería (spec §6.3 / §8).
 *
 * - Acepta drag & drop o click en el dropzone.
 * - Valida cliente: <=5MB, JPG/PNG/WEBP.
 * - Sube cada archivo a `_drafts/{userId}/{uuid}.{ext}` con progreso
 *   cosmético (10% cada 200ms hasta 90%; 100% al `await` resolver).
 * - Marca como Main automáticamente la primera imagen subida.
 * - Click en `delete`: si `_drafts/`, borra del bucket; si DB, marca
 *   `deleted=true` para que la Server Action haga el cleanup.
 * - Max 12 imágenes (spec §15 decisión 3); deshabilita input al alcanzar.
 */
function GallerySectionInner({
  userId,
  images,
  onImagesChange,
  error,
  disabled,
}: GallerySectionProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (supabaseRef.current === null) {
    supabaseRef.current = createClient();
  }

  // Cleanup de object URLs al desmontar / cambiar imágenes
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Registrar new URLs
    for (const img of images) {
      if (img.previewUrl.startsWith('blob:')) {
        objectUrlsRef.current.add(img.previewUrl);
      }
    }
  }, [images]);
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const visibleImages = useMemo(() => images.filter((i) => !i.deleted), [images]);
  const liveCount = visibleImages.length;
  const isFull = liveCount >= MAX_IMAGES_PER_PROPERTY;

  // Closures actualizables para que los timers async vean siempre las
  // últimas `images` y la última `onImagesChange`. Se mantienen como
  // refs sincronizadas en un `useEffect` post-render (los lints recientes
  // de `react-hooks` prohíben mutar refs durante el render).
  const liveImagesRef = useRef<GallerySectionImage[]>(images);
  const liveOnChangeRef = useRef(onImagesChange);
  useEffect(() => {
    liveImagesRef.current = images;
  }, [images]);
  useEffect(() => {
    liveOnChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  const applyImagesUpdate = useCallback(
    (updater: (prev: GallerySectionImage[]) => GallerySectionImage[]) => {
      const next = updater(liveImagesRef.current);
      liveImagesRef.current = next;
      liveOnChangeRef.current(next);
    },
    [],
  );

  const uploadFile = useCallback(
    async (file: File, image: GallerySectionImage) => {
      const supabase = supabaseRef.current!;
      // Simulación de progreso cosmético hasta 90%
      const progressTimer = setInterval(() => {
        applyImagesUpdate((prev) =>
          prev.map((i) =>
            i.localId === image.localId && i.status === 'uploading' && i.progress < 90
              ? { ...i, progress: Math.min(i.progress + 10, 90) }
              : i,
          ),
        );
      }, 200);

      const result = await uploadDraftImage({
        supabase,
        userId,
        file,
        localId: image.localId,
      });
      clearInterval(progressTimer);

      applyImagesUpdate((prev) => {
        if (result.ok) {
          return prev.map((i) =>
            i.localId === image.localId
              ? {
                  ...i,
                  status: 'ready' as const,
                  progress: 100,
                  storagePath: result.storagePath,
                  pendingFile: undefined,
                }
              : i,
          );
        }
        return prev.map((i) =>
          i.localId === image.localId ? { ...i, status: 'error' as const, progress: 0 } : i,
        );
      });
    },
    [applyImagesUpdate, userId],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      const accepted: File[] = [];
      const errors: string[] = [];
      const remainingSlots = MAX_IMAGES_PER_PROPERTY - liveCount;
      let slotsTaken = 0;

      for (const file of fileArr) {
        if (slotsTaken >= remainingSlots) {
          errors.push(`Máximo ${MAX_IMAGES_PER_PROPERTY} imágenes. "${file.name}" no se agregó.`);
          continue;
        }
        const v = validateImageFile(file);
        if (!v.ok) {
          errors.push(
            `"${file.name}": ${getImageValidationMessage(v.reason as ImageValidationError)}`,
          );
          continue;
        }
        accepted.push(file);
        slotsTaken += 1;
      }
      setBatchErrors(errors);
      if (accepted.length === 0) return;

      // Create local images en estado "uploading", marcamos la primera como
      // main solo si todavía no hay ninguna main.
      const hasMainAlready = images.some((i) => !i.deleted && i.isMain);
      const newImages: GallerySectionImage[] = accepted.map((file, idx) => {
        const shouldBeMain = !hasMainAlready && idx === 0;
        const img = makeImage(file, userId, shouldBeMain);
        img.position = liveCount + idx;
        return img;
      });
      onImagesChange([...images, ...newImages]);

      // Disparar uploads
      for (let i = 0; i < newImages.length; i++) {
        const file = accepted[i];
        const img = newImages[i];
        void uploadFile(file, img);
      }
    },
    [images, liveCount, onImagesChange, uploadFile, userId],
  );

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isFull) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleFiles(files);
    }
  };
  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (disabled || isFull) return;
    setIsDragging(true);
  };
  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
    }
    // Reset para permitir re-seleccionar el mismo archivo
    e.target.value = '';
  };

  const handleDelete = useCallback(
    async (localId: string) => {
      const target = images.find((i) => i.localId === localId);
      if (!target) return;

      if (target.dbId) {
        // Imagen existente: marcar para borrar (no tocar Storage hasta el submit).
        // Si era main, pasar la marca a la primera no-deleted.
        const updated = images.map((i) => (i.localId === localId ? { ...i, deleted: true } : i));
        // Reasignar main si hace falta
        const stillVisible = updated.filter((i) => !i.deleted);
        if (target.isMain) {
          const firstVisible = stillVisible[0];
          if (firstVisible) {
            const refined = updated.map((i) => {
              if (i.deleted) return i;
              return { ...i, isMain: i.localId === firstVisible.localId };
            });
            onImagesChange(refined);
            return;
          }
        }
        onImagesChange(updated);
        return;
      }

      // Imagen draft (sin dbId): borrar de Storage y quitar del estado.
      if (target.storagePath) {
        await deleteDraftImage(supabaseRef.current!, target.storagePath);
      }
      const remaining = images.filter((i) => i.localId !== localId);
      // Si era main, asignar a la primera disponible (no-deleted, ready)
      if (target.isMain) {
        const candidate = remaining.find((i) => !i.deleted && i.status === 'ready');
        if (candidate) {
          onImagesChange(
            remaining.map((i) => (i.localId === candidate.localId ? { ...i, isMain: true } : i)),
          );
          return;
        }
      }
      onImagesChange(remaining);
      // Liberar object URL
      if (target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
      }
    },
    [images, onImagesChange],
  );

  const handleMarkMain = useCallback(
    (localId: string) => {
      onImagesChange(images.map((i) => (i.deleted ? i : { ...i, isMain: i.localId === localId })));
    },
    [images, onImagesChange],
  );

  const handleRetry = useCallback(
    (localId: string) => {
      const target = images.find((i) => i.localId === localId);
      if (!target?.pendingFile) return;
      // Resetear status a uploading y disparar de nuevo
      onImagesChange(
        images.map((i) =>
          i.localId === localId ? { ...i, status: 'uploading' as const, progress: 5 } : i,
        ),
      );
      void uploadFile(target.pendingFile, target);
    },
    [images, onImagesChange, uploadFile],
  );

  const acceptAttr = ALLOWED_MIME_TYPES.join(',');

  return (
    <SectionCard
      title="Galería"
      icon="image"
      description={`Hasta ${MAX_IMAGES_PER_PROPERTY} imágenes · Máx 5 MB por imagen · JPG, PNG, WEBP`}
      trailing={
        <span className="rounded-full border border-divider-soft bg-surface-soft/40 px-2 py-1 text-xs font-medium text-on-surface">
          {liveCount}/{MAX_IMAGES_PER_PROPERTY}
        </span>
      }
    >
      <div className="space-y-4">
        <label
          htmlFor={inputId}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-neutral-50 px-6 py-10 text-center transition-colors',
            isDragging
              ? 'border-primary bg-surface-soft/40'
              : 'border-outline hover:border-primary/40 hover:bg-surface-soft/20',
            (disabled || isFull) && 'pointer-events-none opacity-60',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-card">
            <Icon name="cloud_upload" size="md" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">
              {isFull ? 'Máximo de imágenes alcanzado' : 'Arrastrá imágenes o hacé clic'}
            </p>
            <p className="text-xs text-muted">
              {`Hasta 5 MB por imagen · ${(MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0)} MB · JPG, PNG, WEBP`}
            </p>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={acceptAttr}
            onChange={onInputChange}
            className="sr-only"
            disabled={disabled || isFull}
          />
        </label>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {batchErrors.length > 0 ? (
          <ul className="space-y-1 rounded border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {batchErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}

        {visibleImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleImages.map((img) => (
              <GalleryThumb
                key={img.localId}
                localId={img.localId}
                previewUrl={img.previewUrl}
                status={img.status}
                progress={img.progress}
                isMain={img.isMain}
                altText={img.altText}
                onDelete={handleDelete}
                onMarkMain={handleMarkMain}
                onRetry={img.pendingFile ? handleRetry : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

export const GallerySection = memo(GallerySectionInner);

/**
 * Construye una imagen inicial para `images` cuando se carga una propiedad
 * existente (modo edit). Estado `ready`, preview vía URL pública del bucket.
 */
export function makeExistingImage(input: {
  dbId: string;
  storagePath: string;
  isMain: boolean;
  altText: string | null;
  position: number;
}): GallerySectionImage {
  return {
    localId: input.dbId,
    dbId: input.dbId,
    storagePath: input.storagePath,
    isMain: input.isMain,
    altText: input.altText,
    position: input.position,
    status: 'ready',
    progress: 100,
    previewUrl: getDraftImagePublicUrl(input.storagePath),
  };
}

// Re-export para silenciar advertencias de tree-shaking (PROPERTY_IMAGES_BUCKET
// queda referenciada por la URL pública compose). El símbolo se importa
// arriba sólo por su efecto de tipos.
void PROPERTY_IMAGES_BUCKET;
