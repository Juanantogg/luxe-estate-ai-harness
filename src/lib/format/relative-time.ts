/**
 * Helper puro para formatear tiempo relativo en español neutro (es-MX).
 *
 * Casos cubiertos (spec D7):
 * - <1 min  → "ahora"
 * - <60 min → "hace N min"
 * - <24 h   → "hace N h"
 * - <48 h   → "ayer"
 * - <7 d    → "hace N días"
 * - resto   → fecha corta "dd MMM" (es-MX, p. ej. "12 oct")
 *
 * Sin dependencias externas. Usa `Intl.DateTimeFormat` para el fallback de
 * fecha absoluta.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ABSOLUTE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
});

/**
 * Devuelve un string en español describiendo la antigüedad de `date`
 * respecto a `now`. Si `date` está en el futuro (clock skew), devuelve
 * "ahora".
 */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return '';

  const diffMs = now.getTime() - target.getTime();

  if (diffMs < MINUTE) {
    // Incluye negativos (futuro por clock skew).
    return 'ahora';
  }

  if (diffMs < HOUR) {
    const mins = Math.floor(diffMs / MINUTE);
    return `hace ${mins} min`;
  }

  if (diffMs < DAY) {
    const hours = Math.floor(diffMs / HOUR);
    return `hace ${hours} h`;
  }

  if (diffMs < 2 * DAY) {
    return 'ayer';
  }

  if (diffMs < 7 * DAY) {
    const days = Math.floor(diffMs / DAY);
    return `hace ${days} días`;
  }

  // Fecha absoluta corta. Intl agrega punto en abreviaciones ("12 oct.");
  // limpiamos para verse compacto.
  return ABSOLUTE_FORMATTER.format(target).replace('.', '');
}
