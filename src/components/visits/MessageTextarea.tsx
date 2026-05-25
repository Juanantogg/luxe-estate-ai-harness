'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface MessageTextareaProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * Textarea controlada con contador "N / maxLength". Cambia el color del
 * contador según proximidad al límite (warning >= 90%, danger >= 100%).
 *
 * Decisión spec §9.9 + D11: mensaje completamente opcional. Vacío es ok.
 */
export function MessageTextarea({
  value,
  onChange,
  maxLength = 500,
  disabled = false,
}: MessageTextareaProps) {
  const id = useId();
  const counterId = `${id}-counter`;

  const length = value.length;
  const warnThreshold = Math.floor(maxLength * 0.9);
  const counterClass =
    length >= maxLength ? 'text-danger' : length >= warnThreshold ? 'text-warning' : 'text-muted';

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-xs font-semibold tracking-wider text-on-surface uppercase"
      >
        Mensaje para el agente <span className="text-muted normal-case">(Opcional)</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        disabled={disabled}
        rows={4}
        maxLength={maxLength}
        aria-describedby={counterId}
        placeholder="¿Alguna pregunta o solicitud para la visita?"
        className={cn(
          'w-full resize-none rounded-lg border border-outline bg-surface-soft p-3 text-sm text-on-surface placeholder:text-muted',
          'focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      />
      <div className="flex justify-end">
        <span
          id={counterId}
          aria-live="polite"
          className={cn('text-xs tabular-nums', counterClass)}
        >
          {length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
