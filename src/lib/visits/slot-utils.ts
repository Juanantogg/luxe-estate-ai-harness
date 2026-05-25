/**
 * Helpers puros para el calendario y los time slots de la pantalla
 * `schedule_visit_screen`. Cero dependencias externas: solo `Date` e
 * `Intl.DateTimeFormat`.
 *
 * Decisión arquitectónica (spec §16.3.4): TODAS las horas se interpretan
 * en la zona local **de la propiedad**, no del browser. Para un visitante
 * en Madrid agendando una visita a Beverly Hills, el slot "10:00" se ve
 * igual que para alguien en Los Ángeles — el ISO string que viaja al
 * server es el UTC correspondiente a "10:00 hora de LA".
 */

/** Día visible del calendario. */
export interface MonthDay {
  /** ISO de la fecha (YYYY-MM-DD) representando el día calendario en
   *  zona de la propiedad. */
  iso: string;
  /** Día 1-31 del mes calendario. */
  dayOfMonth: number;
  /** True si pertenece al mes que se está navegando (false si es overflow
   *  del mes anterior/siguiente). */
  inMonth: boolean;
  /** True si el día está completamente en el pasado (hoy en la zona de la
   *  propiedad o antes). */
  isPast: boolean;
  /** True si es "hoy" en la zona de la propiedad. */
  isToday: boolean;
  /** True si está fuera de la ventana válida (más de 60 días en el
   *  futuro). */
  isOutOfWindow: boolean;
}

const HOUR_START = 9; // 09:00
const HOUR_END_INCLUSIVE = 19; // 19:30 último slot
const SLOTS_PER_DAY = 22; // 9:00, 9:30, ..., 19:30 = 22 slots

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Devuelve las partes (year, month, day, hour, minute) de un Date en una
 * zona horaria específica. Usa `Intl.DateTimeFormat` con `formatToParts`.
 */
function getZonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // weekday: en-US devuelve 'Mon'..'Sun'.
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * Construye un Date UTC que, cuando se interpreta en `timeZone`, cae en
 * el momento dado (year, month, day, hour, minute). Algoritmo:
 * 1. Asume que UTC y zone difieren por offset constante en ese instante.
 * 2. Construye un guess inicial usando `Date.UTC(...)`.
 * 3. Mide el offset real del guess en esa zona.
 * 4. Ajusta restando el offset.
 *
 * Es estable para todas las zonas que usamos (sin saltos extraños fuera
 * del DST típico ±1h, que se resuelve en 1 iteración).
 */
function zonedToUtc(
  year: number,
  monthIdx0: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, monthIdx0, day, hour, minute, 0));
  const parts = getZonedParts(guess, timeZone);
  const guessedZoned = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const wanted = Date.UTC(year, monthIdx0, day, hour, minute);
  const diff = wanted - guessedZoned;
  return new Date(guess.getTime() + diff);
}

/** Formatea un Date a "YYYY-MM-DD" en la zona dada. */
export function formatIsoDate(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) throw new Error(`ISO date inválido: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Genera los 22 slots (9:00 → 19:30) para un día dado, devolviendo los
 * timestamps UTC correspondientes a esas horas en la zona de la propiedad.
 *
 * @param dateIso "YYYY-MM-DD" representando el día calendario en zona de
 *                la propiedad.
 * @param timeZone Zona IANA de la propiedad.
 */
export function generateDaySlots(dateIso: string, timeZone: string): Date[] {
  const { year, month, day } = parseIsoDate(dateIso);
  const slots: Date[] = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const hour = HOUR_START + Math.floor(i / 2);
    const minute = i % 2 === 0 ? 0 : 30;
    if (hour > HOUR_END_INCLUSIVE) break;
    slots.push(zonedToUtc(year, month - 1, day, hour, minute, timeZone));
  }
  return slots;
}

/**
 * Formatea un slot como "HH:MM" en la zona de la propiedad.
 * Resultado consistente independientemente del browser del visitante.
 */
export function formatSlotLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Devuelve los días que componen el grid del mes (Lun → Dom, con overflow
 * del mes anterior y siguiente para completar las 6 filas estándar).
 *
 * @param monthDateIso "YYYY-MM-DD" — cualquier día del mes a mostrar.
 *                    El componente típicamente pasa el día 1.
 * @param timeZone Zona IANA de la propiedad.
 */
export function getMonthDays(monthDateIso: string, timeZone: string): MonthDay[] {
  const { year, month } = parseIsoDate(monthDateIso);
  const monthIdx0 = month - 1;

  // Primer día del mes y último día.
  const firstOfMonth = new Date(Date.UTC(year, monthIdx0, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthIdx0 + 1, 0));
  const daysInMonth = lastOfMonth.getUTCDate();

  // Día de la semana del 1ro (con weekStart = 1 → Lun). El weekday del 1ro
  // se calcula en UTC (sin TZ): los días calendario absolutos son los
  // mismos en cualquier zona razonable.
  // getUTCDay: 0=Dom, 1=Lun, ..., 6=Sáb. Queremos: 0=Lun, ..., 6=Dom.
  const firstDayOfWeek = (firstOfMonth.getUTCDay() + 6) % 7;

  const days: MonthDay[] = [];

  // Pad inicial: días del mes anterior visibles para llenar la primera fila.
  for (let i = 0; i < firstDayOfWeek; i++) {
    const d = new Date(Date.UTC(year, monthIdx0, 1 - (firstDayOfWeek - i)));
    days.push(makeMonthDay(d, timeZone, false));
  }

  // Días del mes propios.
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(Date.UTC(year, monthIdx0, i));
    days.push(makeMonthDay(d, timeZone, true));
  }

  // Pad final: completar hasta múltiplo de 7 (idealmente 42 = 6 filas).
  while (days.length < 42) {
    const last = days[days.length - 1];
    const lastParts = parseIsoDate(last.iso);
    const next = new Date(Date.UTC(lastParts.year, lastParts.month - 1, lastParts.day + 1));
    days.push(makeMonthDay(next, timeZone, false));
  }

  return days;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 60;

function makeMonthDay(utcDate: Date, timeZone: string, inMonth: boolean): MonthDay {
  const now = new Date();
  const todayIso = formatIsoDate(now, timeZone);
  const dayIso = formatIsoDate(utcDate, timeZone);

  // Comparamos como string "YYYY-MM-DD" (orden lexicográfico = temporal).
  const isPast = dayIso < todayIso;
  const isToday = dayIso === todayIso;

  // Para isOutOfWindow comparamos contra now + 60d en zona local.
  const maxUtc = new Date(now.getTime() + WINDOW_DAYS * MS_PER_DAY);
  const maxIso = formatIsoDate(maxUtc, timeZone);
  const isOutOfWindow = dayIso > maxIso;

  return {
    iso: dayIso,
    dayOfMonth: Number(dayIso.slice(8, 10)),
    inMonth,
    isPast,
    isToday,
    isOutOfWindow,
  };
}

/**
 * Para un día dado, devuelve true si TODOS sus 22 slots están ocupados o
 * en el pasado (es decir, no hay nada disponible para agendar).
 *
 * `occupiedIsoSet` es un Set<string> de timestamps ISO (UTC) ya ocupados.
 * `minDateTime` es `now + 24h` — los slots anteriores se consideran no
 * agendables (ventana mínima del spec §7.1).
 */
export function isFullyBooked(
  dateIso: string,
  occupiedIsoSet: Set<string>,
  timeZone: string,
  minDateTime: Date,
): boolean {
  const slots = generateDaySlots(dateIso, timeZone);
  for (const slot of slots) {
    if (slot.getTime() < minDateTime.getTime()) continue;
    if (!occupiedIsoSet.has(slot.toISOString())) return false;
  }
  return true;
}

/**
 * Devuelve un "year-month" ISO ("YYYY-MM") movido N meses respecto del
 * input. Útil para navegar mes anterior/siguiente con los chevrons.
 */
export function shiftMonthIso(monthDateIso: string, delta: number): string {
  const { year, month, day } = parseIsoDate(monthDateIso);
  const target = new Date(Date.UTC(year, month - 1 + delta, day));
  return formatIsoDate(target, 'UTC');
}

/**
 * Devuelve "YYYY-MM-01" del mes/año donde cae el ISO de entrada.
 * Útil para normalizar a "primer día del mes" al navegar.
 */
export function firstOfMonthIso(monthDateIso: string): string {
  const { year, month } = parseIsoDate(monthDateIso);
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Nombre del mes en español, con año (ej. "Octubre 2026").
 */
export function formatMonthLabel(monthDateIso: string, timeZone: string): string {
  const { year, month } = parseIsoDate(monthDateIso);
  const ref = zonedToUtc(year, month - 1, 1, 12, 0, timeZone);
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(ref);
  // Primera letra en mayúscula (es-MX devuelve minúscula).
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Devuelve `aria-label` legible para un día (ej. "Martes 8 de octubre de
 * 2026").
 */
export function formatDayAriaLabel(dateIso: string, timeZone: string): string {
  const { year, month, day } = parseIsoDate(dateIso);
  const ref = zonedToUtc(year, month - 1, day, 12, 0, timeZone);
  const label = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(ref);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Para una hora UTC dada y una zona, devuelve `{ hour, minute }` en esa
 * zona. Usado en la Server Action para validar `hour ∈ [9..19]` y
 * `minute ∈ {0,30}` en zona de la propiedad (spec §16.3.6).
 */
export function getZonedHourMinute(
  utcDate: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const p = getZonedParts(utcDate, timeZone);
  return { hour: p.hour, minute: p.minute };
}

export const VISIT_SLOT_CONSTANTS = {
  HOUR_START,
  HOUR_END_INCLUSIVE,
  SLOTS_PER_DAY,
  WINDOW_DAYS,
} as const;
