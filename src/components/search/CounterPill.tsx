'use client';

import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface CounterPillProps {
  /** Etiqueta visible a la izquierda del pill (p.ej. "Habitaciones"). */
  label: string;
  /** Valor actual. 0 representa "sin filtro". */
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Función para formatear el valor mostrado al centro. */
  formatValue?: (n: number) => string;
  /** Texto para accesibilidad cuando se decrementa. */
  decrementLabel?: string;
  /** Texto para accesibilidad cuando se incrementa. */
  incrementLabel?: string;
}

const defaultFormat = (n: number, max: number): string => {
  if (n === 0) return 'Cualquiera';
  if (n >= max) return `${max}+`;
  return `${n}+`;
};

/**
 * Counter en formato pill (− [valor] +) usado para Bedrooms y Bathrooms.
 *
 * Spec: §"Anatomía §3 Counters" + §"Componentes → CounterPill".
 *
 * - Rango por defecto 0..6. 0 muestra "Cualquiera" y al hacer `−` se queda
 *   en 0 (botón visualmente disabled).
 * - Valor central en `aria-live="polite"` para que screen readers lean el
 *   cambio.
 */
export function CounterPill({
  label,
  value,
  onChange,
  min = 0,
  max = 6,
  formatValue,
  decrementLabel = 'Quitar uno',
  incrementLabel = 'Agregar uno',
}: CounterPillProps) {
  const display = formatValue ? formatValue(value) : defaultFormat(value, max);
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <div className="inline-flex items-center gap-1 rounded-full bg-background p-1">
        <button
          type="button"
          onClick={() => canDecrement && onChange(value - 1)}
          disabled={!canDecrement}
          aria-label={decrementLabel}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted shadow-card transition-colors',
            'hover:text-on-surface',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <Icon name="remove" size="sm" />
        </button>
        <span
          aria-live="polite"
          className="min-w-[5.25rem] text-center text-sm font-semibold text-on-surface tabular-nums"
        >
          {display}
        </span>
        <button
          type="button"
          onClick={() => canIncrement && onChange(value + 1)}
          disabled={!canIncrement}
          aria-label={incrementLabel}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary shadow-card transition-colors',
            'hover:bg-primary hover:text-on-primary',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <Icon name="add" size="sm" />
        </button>
      </div>
    </div>
  );
}
