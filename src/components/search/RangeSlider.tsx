'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

export interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Etiqueta accesible para el thumb mínimo. */
  ariaLabelMin?: string;
  /** Etiqueta accesible para el thumb máximo. */
  ariaLabelMax?: string;
  className?: string;
}

/**
 * Slider dual-thumb implementado con dos `<input type="range">` superpuestos
 * sobre un track decorativo. Es una técnica clásica que evita dependencias.
 *
 * - Ambos inputs comparten el mismo min/max/step.
 * - El thumb min se sincroniza con `value[0]`, el thumb max con `value[1]`.
 * - Si el usuario arrastra el thumb min más allá del max (o viceversa), se
 *   clamp en `onChange`.
 * - El track activo (entre los dos thumbs) es un `<div>` posicionado con
 *   `left`/`right` calculados a porcentaje.
 * - Styling del thumb vía la utility `.range-thumb-primary` en globals.css
 *   (porque los pseudo-elementos `::-webkit-slider-thumb` no se pueden
 *   tematizar con clases Tailwind).
 *
 * Spec: §"Anatomía §2 Price Range" + §"Componentes → RangeSlider".
 */
export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabelMin = 'Mínimo',
  ariaLabelMax = 'Máximo',
  className,
}: RangeSliderProps) {
  const [minVal, maxVal] = value;

  const { leftPct, rightPct } = useMemo(() => {
    const span = max - min;
    if (span <= 0) return { leftPct: 0, rightPct: 100 };
    return {
      leftPct: ((minVal - min) / span) * 100,
      rightPct: ((maxVal - min) / span) * 100,
    };
  }, [min, max, minVal, maxVal]);

  const handleMin = (next: number) => {
    const clamped = Math.min(Math.max(next, min), maxVal);
    onChange([clamped, maxVal]);
  };

  const handleMax = (next: number) => {
    const clamped = Math.max(Math.min(next, max), minVal);
    onChange([minVal, clamped]);
  };

  return (
    <div className={cn('relative h-6 w-full select-none', className)}>
      {/* Track de fondo */}
      <div
        className="pointer-events-none absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 rounded-full bg-neutral-200"
        aria-hidden
      />
      {/* Track activo */}
      <div
        className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        aria-hidden
      />
      {/* Input min — z-index alto si los dos thumbs coinciden en el extremo. */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minVal}
        onChange={(e) => handleMin(Number(e.target.value))}
        aria-label={ariaLabelMin}
        className={cn(
          'range-thumb-primary absolute inset-0 h-6 w-full bg-transparent',
          minVal >= max - step && 'z-30',
        )}
      />
      {/* Input max */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxVal}
        onChange={(e) => handleMax(Number(e.target.value))}
        aria-label={ariaLabelMax}
        className="range-thumb-primary absolute inset-0 z-20 h-6 w-full bg-transparent"
      />
    </div>
  );
}
