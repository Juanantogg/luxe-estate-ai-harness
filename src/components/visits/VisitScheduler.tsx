'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button, Toast } from '@/components/ui';
import { getPropertyUrl } from '@/lib/properties';
import { scheduleVisit } from '@/lib/visits/actions';
import {
  firstOfMonthIso,
  formatIsoDate,
  generateDaySlots,
  isFullyBooked,
} from '@/lib/visits/slot-utils';
import { cn } from '@/lib/utils/cn';
import { MessageTextarea } from './MessageTextarea';
import { MonthCalendar } from './MonthCalendar';
import { TimeSlotGrid } from './TimeSlotGrid';

export interface VisitSchedulerProps {
  /** UUID de la propiedad. Se envía al Server Action `scheduleVisit` que
   *  valida ownership y resuelve agente vía RLS. */
  propertyId: string;
  /** Slug de la propiedad. Se usa para construir el href de "Cancelar"
   *  (URL pública canónica). */
  propertySlug: string;
  /** Timestamps ISO (UTC) ya ocupados por el agente. */
  occupiedSlotsIso: string[];
  /** Zona IANA de la propiedad (ej. 'America/Los_Angeles'). */
  propertyTimeZone: string;
  /** Label humano-legible de la zona (ej. "Los Ángeles (UTC-08)"). */
  propertyTimeZoneLabel: string;
  /** Día inicial preseleccionado (ISO date "YYYY-MM-DD"). Opcional. */
  initialDateIso?: string;
}

const MAX_MESSAGE_LENGTH = 500;
const MIN_HOURS_AHEAD = 24;

/**
 * Orquesta el form de agendar visita. Maneja:
 * - State local: selectedDateIso, selectedSlotIso, message, error, toast.
 * - Submit via `scheduleVisit` Server Action con `useTransition`.
 * - Tras éxito: toast 600ms → router.push('/profile?tab=visits').
 * - Tras `slot_taken`: limpia slot y `router.refresh()` para re-fetchear.
 */
export function VisitScheduler({
  propertyId,
  propertySlug,
  occupiedSlotsIso,
  propertyTimeZone,
  propertyTimeZoneLabel,
  initialDateIso,
}: VisitSchedulerProps) {
  const router = useRouter();

  // Referencias temporales estables durante el render.
  const now = useMemo(() => new Date(), []);
  const minDateTime = useMemo(() => new Date(now.getTime() + MIN_HOURS_AHEAD * 3600 * 1000), [now]);

  const occupiedIsoSet = useMemo(() => new Set(occupiedSlotsIso), [occupiedSlotsIso]);

  // Días totalmente reservados — derivamos en cliente.
  const fullyBookedSet = useMemo(() => {
    const bookedDays = new Set<string>();
    // Solo evaluamos para los días candidatos (ventana de 60 días + el mes
    // visible). Como occupiedSlotsIso ya viene cap-ed, iteramos sobre los
    // días que aparecen ahí.
    const daysWithAny = new Set<string>();
    for (const iso of occupiedSlotsIso) {
      const d = new Date(iso);
      daysWithAny.add(formatIsoDate(d, propertyTimeZone));
    }
    for (const dayIso of daysWithAny) {
      if (isFullyBooked(dayIso, occupiedIsoSet, propertyTimeZone, minDateTime)) {
        bookedDays.add(dayIso);
      }
    }
    return bookedDays;
  }, [occupiedSlotsIso, occupiedIsoSet, propertyTimeZone, minDateTime]);

  // Día seleccionado por defecto: el ?date= si viene válido, sino el primer
  // día seleccionable a partir de mañana.
  const defaultDateIso = useMemo(() => {
    if (initialDateIso) {
      const d = new Date(initialDateIso);
      if (!Number.isNaN(d.getTime())) {
        const candidate = formatIsoDate(d, propertyTimeZone);
        return candidate;
      }
    }
    // Primer día desde minDateTime (mañana en zona local de propiedad).
    return formatIsoDate(minDateTime, propertyTimeZone);
  }, [initialDateIso, minDateTime, propertyTimeZone]);

  /** Calcula el primer slot disponible del día (o null). */
  const computeFirstFreeSlot = (dateIso: string | null): string | null => {
    if (!dateIso) return null;
    const slots = generateDaySlots(dateIso, propertyTimeZone);
    const firstFree = slots.find((d) => {
      const iso = d.toISOString();
      return d.getTime() >= minDateTime.getTime() && !occupiedIsoSet.has(iso);
    });
    return firstFree ? firstFree.toISOString() : null;
  };

  const [monthDateIso, setMonthDateIso] = useState<string>(() => firstOfMonthIso(defaultDateIso));
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(defaultDateIso);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(() =>
    computeFirstFreeSlot(defaultDateIso),
  );
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelectDate = (iso: string) => {
    setSelectedDateIso(iso);
    setSelectedSlotIso(computeFirstFreeSlot(iso));
    setErrorMessage(null);
  };

  const handleMonthChange = (next: string) => {
    setMonthDateIso(next);
  };

  const handleSelectSlot = (iso: string) => {
    setSelectedSlotIso(iso);
    setErrorMessage(null);
  };

  const canSubmit = Boolean(selectedSlotIso) && !isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlotIso) return;

    startTransition(async () => {
      setErrorMessage(null);
      const result = await scheduleVisit({
        propertyId,
        scheduledAt: selectedSlotIso,
        message: message.trim() ? message.trim() : null,
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        if (result.error.code === 'slot_taken') {
          setSelectedSlotIso(null);
          router.refresh();
        }
        return;
      }

      // Éxito: toast efímero + redirect.
      setToastVisible(true);
      setTimeout(() => {
        router.push('/profile?tab=visits');
      }, 600);
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isPending} className="space-y-8">
      <MonthCalendar
        monthDateIso={monthDateIso}
        selectedDateIso={selectedDateIso}
        fullyBookedSet={fullyBookedSet}
        timeZone={propertyTimeZone}
        onMonthChange={handleMonthChange}
        onSelect={handleSelectDate}
        disabled={isPending}
      />

      <TimeSlotGrid
        selectedDateIso={selectedDateIso}
        occupiedIsoSet={occupiedIsoSet}
        selectedSlotIso={selectedSlotIso}
        minDateTimeIso={minDateTime.toISOString()}
        timeZone={propertyTimeZone}
        timeZoneLabel={propertyTimeZoneLabel}
        onSelect={handleSelectSlot}
        disabled={isPending}
      />

      <MessageTextarea
        value={message}
        onChange={setMessage}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={isPending}
      />

      {errorMessage && (
        <div role="alert" className="rounded bg-danger-soft px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      )}

      <div
        className={cn(
          'sticky bottom-0 -mx-6 flex items-center justify-end gap-4 border-t border-divider-soft bg-surface px-6 pt-6',
          'md:static md:mx-0 md:bg-transparent md:px-0',
        )}
      >
        <Link
          href={getPropertyUrl({ slug: propertySlug })}
          className="text-sm text-muted transition-colors hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={!canSubmit}
          trailingIcon="arrow_forward"
        >
          Confirmar visita
        </Button>
      </div>

      <Toast
        open={toastVisible}
        onClose={() => setToastVisible(false)}
        variant="success"
        message="Visita confirmada."
        autoDismissMs={0}
        dismissible={false}
      />
    </form>
  );
}
