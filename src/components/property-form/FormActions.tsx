'use client';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export type FormPhase = 'idle' | 'saving';

export interface FormActionsProps {
  mode: 'create' | 'edit';
  phase: FormPhase;
  /** Etiqueta del botón Save Draft (sin spinner). */
  draftLabel?: string;
  /** Etiqueta del botón Save Property/Cambios. */
  publishLabel?: string;
  /** Si está activo, deshabilita ambos botones (ej. uploads pendientes). */
  disabledReason?: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** Variante de layout: header inline (desktop) o sticky bar (móvil). */
  variant: 'inline' | 'sticky';
  className?: string;
}

/**
 * Botones Save Draft + Save Property. Spec §6.2 (desktop) y §6.1
 * (mobile sticky bar). El estado de "guardando" inhabilita ambos y
 * agrega el spinner del Button primitive.
 */
export function FormActions({
  mode,
  phase,
  draftLabel,
  publishLabel,
  disabledReason,
  onSaveDraft,
  onPublish,
  variant,
  className,
}: FormActionsProps) {
  const loading = phase === 'saving';
  const disabled = loading || Boolean(disabledReason);
  const draftText = draftLabel ?? 'Guardar borrador';
  const publishText = publishLabel ?? (mode === 'edit' ? 'Guardar cambios' : 'Publicar');

  if (variant === 'sticky') {
    return (
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-surface px-4 py-3 shadow-soft md:hidden',
          className,
        )}
      >
        <div className="flex flex-col gap-2">
          {disabledReason ? (
            <p className="text-center text-xs text-muted">{disabledReason}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onSaveDraft}
              disabled={disabled}
              loading={loading}
              fullWidth
            >
              {draftText}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onPublish}
              disabled={disabled}
              loading={loading}
              fullWidth
              leadingIcon="save"
            >
              {publishText}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onSaveDraft}
        disabled={disabled}
        loading={loading}
      >
        {draftText}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onPublish}
        disabled={disabled}
        loading={loading}
        leadingIcon="save"
      >
        {publishText}
      </Button>
    </div>
  );
}
