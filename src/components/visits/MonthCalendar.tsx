'use client';

import { useCallback, useMemo, useRef } from 'react';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import {
  firstOfMonthIso,
  formatDayAriaLabel,
  formatMonthLabel,
  getMonthDays,
  shiftMonthIso,
} from '@/lib/visits/slot-utils';

export interface MonthCalendarProps {
  /** "YYYY-MM-DD" del mes a renderizar (típicamente día 1). */
  monthDateIso: string;
  /** "YYYY-MM-DD" del día seleccionado (o null). */
  selectedDateIso: string | null;
  /** Set<string> de "YYYY-MM-DD" totalmente reservados (line-through). */
  fullyBookedSet: Set<string>;
  /** Zona IANA de la propiedad. */
  timeZone: string;
  /** Cambia el mes visible (chevron). El padre normaliza al día 1. */
  onMonthChange: (nextMonthDateIso: string) => void;
  /** Click/Enter sobre un día → selecciona ese día. */
  onSelect: (dateIso: string) => void;
  /** Si se pasa, el calendario queda inerte (no foco, no clicks). */
  disabled?: boolean;
}

const WEEKDAY_LABELS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Calendario mensual con grid 7-col (week-start = Lunes, D10 confirmada).
 * Navegación de mes con chevrons + roving tabindex en los días (Arrow,
 * Home/End, PageUp/PageDown, Enter/Space).
 *
 * Estados de día:
 * - Seleccionado: `bg-primary text-on-primary` + scale-105.
 * - Hoy: ring sutil con `ring-primary-soft`.
 * - Pasado o fuera de ventana: `text-muted/40 cursor-not-allowed`.
 * - Totalmente reservado: `text-muted line-through cursor-not-allowed`.
 * - Overflow del mes anterior/siguiente: opacidad reducida.
 */
export function MonthCalendar({
  monthDateIso,
  selectedDateIso,
  fullyBookedSet,
  timeZone,
  onMonthChange,
  onSelect,
  disabled = false,
}: MonthCalendarProps) {
  const days = useMemo(() => getMonthDays(monthDateIso, timeZone), [monthDateIso, timeZone]);

  const monthLabel = useMemo(
    () => formatMonthLabel(monthDateIso, timeZone),
    [monthDateIso, timeZone],
  );

  // Roving tabindex: tabbable = el día seleccionado si está visible, sino
  // el primer día del mes que sea seleccionable.
  const rovingIso = useMemo(() => {
    if (selectedDateIso && days.some((d) => d.iso === selectedDateIso && d.inMonth)) {
      return selectedDateIso;
    }
    const firstSelectable = days.find(
      (d) => d.inMonth && !d.isPast && !d.isOutOfWindow && !fullyBookedSet.has(d.iso),
    );
    return firstSelectable?.iso ?? days.find((d) => d.inMonth)?.iso ?? null;
  }, [days, selectedDateIso, fullyBookedSet]);

  const gridRef = useRef<HTMLDivElement>(null);

  const focusDay = useCallback((iso: string) => {
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
    btn?.focus();
  }, []);

  const isSelectable = useCallback(
    (iso: string) => {
      const d = days.find((x) => x.iso === iso);
      if (!d) return false;
      return !d.isPast && !d.isOutOfWindow && !fullyBookedSet.has(iso);
    },
    [days, fullyBookedSet],
  );

  // Navegación con teclado siguiendo patrón roving tabindex.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIso: string) => {
    const visibleIsos = days.map((d) => d.iso);
    const idx = visibleIsos.indexOf(currentIso);
    if (idx === -1) return;

    let nextIdx: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        nextIdx = idx - 1;
        break;
      case 'ArrowRight':
        nextIdx = idx + 1;
        break;
      case 'ArrowUp':
        nextIdx = idx - 7;
        break;
      case 'ArrowDown':
        nextIdx = idx + 7;
        break;
      case 'Home': {
        // Inicio de la fila.
        const rowStart = Math.floor(idx / 7) * 7;
        nextIdx = rowStart;
        break;
      }
      case 'End': {
        const rowEnd = Math.floor(idx / 7) * 7 + 6;
        nextIdx = Math.min(rowEnd, visibleIsos.length - 1);
        break;
      }
      case 'PageUp':
        e.preventDefault();
        onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, -1)));
        return;
      case 'PageDown':
        e.preventDefault();
        onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, 1)));
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isSelectable(currentIso)) onSelect(currentIso);
        return;
      default:
        return;
    }

    if (nextIdx == null) return;
    e.preventDefault();

    if (nextIdx < 0) {
      // Salta al mes anterior y enfoca el último día del mismo "weekday".
      onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, -1)));
      return;
    }
    if (nextIdx >= visibleIsos.length) {
      onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, 1)));
      return;
    }

    focusDay(visibleIsos[nextIdx]);
  };

  const headingId = `cal-heading-${monthDateIso}`;

  return (
    <div className={cn('space-y-3', disabled && 'pointer-events-none opacity-60')}>
      <div className="flex items-center justify-between">
        <h2
          id={headingId}
          className="text-xs font-semibold tracking-wider text-on-surface uppercase"
        >
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <IconButton
            icon="chevron_left"
            aria-label="Mes anterior"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, -1)))}
          />
          <IconButton
            icon="chevron_right"
            aria-label="Mes siguiente"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(firstOfMonthIso(shiftMonthIso(monthDateIso, 1)))}
          />
        </div>
      </div>

      <div ref={gridRef} role="grid" aria-labelledby={headingId} className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS_ES.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="py-2 text-center text-xs font-medium text-muted"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const isSelected = day.iso === selectedDateIso;
          const isBooked = fullyBookedSet.has(day.iso);
          const isDisabled = !day.inMonth || day.isPast || day.isOutOfWindow || isBooked;
          const isTabbable = day.iso === rovingIso;

          return (
            <div role="gridcell" key={day.iso}>
              <button
                type="button"
                data-iso={day.iso}
                tabIndex={isTabbable ? 0 : -1}
                disabled={isDisabled}
                aria-pressed={isSelected}
                aria-disabled={isDisabled || undefined}
                aria-label={formatDayAriaLabel(day.iso, timeZone)}
                onClick={() => {
                  if (!isDisabled) onSelect(day.iso);
                }}
                onKeyDown={(e) => handleKeyDown(e, day.iso)}
                className={cn(
                  'flex h-10 w-full items-center justify-center rounded-lg text-sm transition-all',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none',
                  // Default disponible
                  !isDisabled && !isSelected && 'text-on-surface hover:bg-surface-hover',
                  // Seleccionado
                  isSelected && 'scale-105 bg-primary font-semibold text-on-primary shadow-soft',
                  // Hoy (cuando no seleccionado)
                  day.isToday && !isSelected && 'ring-1 ring-primary-soft',
                  // Overflow (otro mes)
                  !day.inMonth && 'opacity-30',
                  // Pasado / fuera de ventana
                  (day.isPast || day.isOutOfWindow) && 'cursor-not-allowed text-muted/40',
                  // Booked
                  isBooked &&
                    day.inMonth &&
                    !day.isPast &&
                    !day.isOutOfWindow &&
                    'cursor-not-allowed text-muted line-through',
                )}
              >
                {day.dayOfMonth}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
