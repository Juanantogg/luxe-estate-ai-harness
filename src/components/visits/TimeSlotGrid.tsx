'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatDayAriaLabel, formatSlotLabel, generateDaySlots } from '@/lib/visits/slot-utils';

export interface TimeSlotGridProps {
  /** "YYYY-MM-DD" del día seleccionado en zona local de la propiedad. */
  selectedDateIso: string | null;
  /** Set<string> de ISO (UTC) ya ocupados por el agente. */
  occupiedIsoSet: Set<string>;
  /** ISO (UTC) seleccionado por el usuario, o null. */
  selectedSlotIso: string | null;
  /** ISO (UTC) mínimo agendable (now + 24h). Slots anteriores quedan
   *  inertes ("Pasado"). */
  minDateTimeIso: string;
  /** Zona IANA de la propiedad. */
  timeZone: string;
  /** Etiqueta humano-legible de la zona (ej. "Los Ángeles (UTC-08)"). */
  timeZoneLabel: string;
  onSelect: (slotIso: string) => void;
  disabled?: boolean;
}

interface SlotItem {
  iso: string;
  label: string;
  isOccupied: boolean;
  isPast: boolean;
}

/**
 * Grid de 22 slots (9:00-19:30) para el día seleccionado.
 * Hint encima del grid: "Horarios en zona local de la propiedad (label)".
 *
 * Slot states:
 * - Default disponible → border outline.
 * - Seleccionado → bg-primary-soft + border-primary.
 * - Ocupado o pasado → line-through opacity-50 cursor-not-allowed.
 *
 * Si no hay día seleccionado o el día está completamente ocupado/pasado,
 * muestra un mensaje suave en lugar del grid (spec §9.4).
 */
export function TimeSlotGrid({
  selectedDateIso,
  occupiedIsoSet,
  selectedSlotIso,
  minDateTimeIso,
  timeZone,
  timeZoneLabel,
  onSelect,
  disabled = false,
}: TimeSlotGridProps) {
  const slots = useMemo<SlotItem[]>(() => {
    if (!selectedDateIso) return [];
    const minMs = new Date(minDateTimeIso).getTime();
    return generateDaySlots(selectedDateIso, timeZone).map((d) => {
      const iso = d.toISOString();
      return {
        iso,
        label: formatSlotLabel(d, timeZone),
        isOccupied: occupiedIsoSet.has(iso),
        isPast: d.getTime() < minMs,
      };
    });
  }, [selectedDateIso, timeZone, occupiedIsoSet, minDateTimeIso]);

  const dayLabel = selectedDateIso ? formatDayAriaLabel(selectedDateIso, timeZone) : '';

  if (!selectedDateIso) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wider text-on-surface uppercase">
          Horarios disponibles
        </h3>
        <p className="py-8 text-center text-sm text-muted">
          Selecciona un día en el calendario para ver los horarios disponibles.
        </p>
      </div>
    );
  }

  const allUnavailable = slots.every((s) => s.isOccupied || s.isPast);

  return (
    <div className={cn('space-y-3', disabled && 'pointer-events-none opacity-60')}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wider text-on-surface uppercase">
          Horarios disponibles
        </h3>
      </div>
      <p className="text-xs text-muted">
        Horarios en zona local de la propiedad ({timeZoneLabel}).
      </p>

      {allUnavailable ? (
        <p className="py-8 text-center text-sm text-muted">
          No hay horarios disponibles este día. Prueba con otra fecha.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {slots.map((slot) => {
            const isUnavailable = slot.isOccupied || slot.isPast;
            const isSelected = slot.iso === selectedSlotIso;
            return (
              <button
                key={slot.iso}
                type="button"
                onClick={() => {
                  if (!isUnavailable) onSelect(slot.iso);
                }}
                disabled={isUnavailable}
                aria-pressed={isSelected}
                aria-disabled={isUnavailable || undefined}
                aria-label={`${slot.label}, ${dayLabel}`}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                  // Default disponible
                  !isUnavailable &&
                    !isSelected &&
                    'border-outline text-on-surface hover:border-primary hover:text-primary',
                  // Seleccionado
                  isSelected && 'border-primary bg-primary-soft font-medium text-primary shadow-sm',
                  // Ocupado o pasado
                  isUnavailable &&
                    'cursor-not-allowed border-outline text-muted line-through opacity-50',
                )}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
