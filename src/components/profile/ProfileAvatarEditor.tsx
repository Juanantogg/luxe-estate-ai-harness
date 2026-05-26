'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button, Icon } from '@/components/ui';
import { removeAvatar, uploadAvatar } from '@/lib/profile/actions';
import { AVATAR_ALLOWED_MIME, AVATAR_MAX_BYTES } from '@/lib/profile/schemas';
import { cn } from '@/lib/utils/cn';

export interface ProfileAvatarEditorProps {
  /** URL pública actual del avatar; `null` si el user todavía no subió uno. */
  avatarUrl: string | null;
  /** Nombre para iniciales fallback cuando no hay imagen. */
  displayName: string;
  /** Mismo string que `displayName` por default; se separa para tests. */
  alt?: string;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Avatar grande del header con FAB de edición. Al hacer click en el FAB se
 * abre un panel modal (centrado en desktop, full-width abajo en mobile) con
 * preview, selector de archivo, y los botones "Eliminar foto" / "Guardar" /
 * "Cancelar".
 *
 * Validación cliente antes de invocar Server Action:
 * - Tamaño ≤ 2 MB.
 * - MIME ∈ {jpeg, png, webp}.
 *
 * El Server Action revalida los mismos límites server-side (defense-in-depth).
 *
 * No usamos el primitivo `Avatar` porque acá necesitamos `position: relative`
 * con un FAB absoluto encima y tamaños mayores que `xl` (`h-24` / `h-32`).
 */
export function ProfileAvatarEditor({ avatarUrl, displayName, alt }: ProfileAvatarEditorProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const initials = getInitials(displayName);

  // Revoca el object URL cuando cambia el preview o se desmonta.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Bloquea scroll del body mientras el modal está abierto + ESC cierra.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);

    // Focus inicial al botón cerrar (patrón coherente con bottom-sheet).
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKey);
    };
    // `handleClose` es estable dentro del componente; no es necesario en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpen() {
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setFile(null);
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Devolvemos foco al FAB.
    fabRef.current?.focus();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const next = event.target.files?.[0] ?? null;
    if (!next) {
      setFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(next.type)) {
      setError('Formato no soportado. Usá JPG, PNG o WEBP.');
      return;
    }
    if (next.size > AVATAR_MAX_BYTES) {
      setError('Archivo demasiado grande (máx 2 MB).');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadAvatar(fd);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      handleClose();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      handleClose();
    });
  }

  const displayedSrc = previewUrl ?? avatarUrl;
  const canSave = file !== null && !isPending;

  return (
    <>
      <div className="relative shrink-0">
        <div
          className={cn(
            'relative h-24 w-24 overflow-hidden rounded-full border-4 border-surface shadow-card lg:h-32 lg:w-32',
            'bg-primary-soft text-primary',
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={alt ?? displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-medium lg:text-3xl">
              {initials || <Icon name="person" size="xl" aria-label="Sin avatar" />}
            </span>
          )}
        </div>
        <button
          ref={fabRef}
          type="button"
          onClick={handleOpen}
          aria-label="Editar foto de perfil"
          aria-busy={isPending || undefined}
          className={cn(
            'absolute -right-1 -bottom-1 inline-flex h-8 w-8 items-center justify-center rounded-full',
            'bg-primary text-on-primary shadow-card transition-colors',
            'hover:bg-surface-inverse',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft focus-visible:outline-none',
            'lg:h-10 lg:w-10',
            isPending && 'opacity-70',
          )}
        >
          <Icon name="edit" size="sm" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-surface-inverse/40 p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            // Click en backdrop cierra.
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className={cn(
              'w-full max-w-md bg-surface shadow-soft-hover',
              'rounded-t-2xl sm:rounded-2xl',
              'flex flex-col gap-4 p-6',
            )}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-on-surface">
                  Cambiar foto de perfil
                </h2>
                <p className="mt-1 text-sm text-muted">JPG, PNG o WEBP de hasta 2 MB.</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                aria-label="Cerrar"
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted',
                  'hover:bg-surface-hover hover:text-on-surface',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                )}
              >
                <Icon name="close" size="md" />
              </button>
            </header>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              aria-busy={isPending || undefined}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-soft bg-primary-soft text-primary shadow-card">
                  {displayedSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayedSrc}
                      alt={previewUrl ? 'Previsualización del avatar' : displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl font-medium">
                      {initials || <Icon name="person" size="xl" />}
                    </span>
                  )}
                </div>

                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded border border-outline px-4 py-2 text-sm font-medium text-on-surface',
                    'hover:border-primary hover:text-primary',
                    'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
                  )}
                >
                  <Icon name="upload" size="sm" />
                  Elegir archivo
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="sr-only"
                    disabled={isPending}
                  />
                </label>
                {file && (
                  <p className="text-xs text-muted">
                    Seleccionado: <span className="font-medium text-on-surface">{file.name}</span>
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleRemove}
                    loading={isPending && !file}
                    className="text-danger hover:text-danger sm:mr-auto"
                  >
                    Eliminar foto
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isPending && Boolean(file)}
                  disabled={!canSave}
                >
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
