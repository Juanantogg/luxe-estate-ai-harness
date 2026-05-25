/**
 * Helper para mostrar zonas horarias de forma humano-legible.
 *
 * `formatTimezoneLabel('America/Los_Angeles')` → `"Los Ángeles (UTC-08)"`
 *
 * Implementación: mapping manual de IANA → label corto en español + offset
 * calculado dinámicamente con `Intl.DateTimeFormat` (`shortOffset`). Esto
 * deja el offset siempre coherente con el momento actual (respeta DST).
 *
 * Cero dependencias externas (spec §16.3.5).
 */

const TIMEZONE_CITY_ES: Record<string, string> = {
  'America/Los_Angeles': 'Los Ángeles',
  'America/Vancouver': 'Vancouver',
  'America/New_York': 'Nueva York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Mexico_City': 'Ciudad de México',
  'America/Phoenix': 'Phoenix',
  'America/Toronto': 'Toronto',
  'America/Sao_Paulo': 'São Paulo',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Bogota': 'Bogotá',
  'America/Lima': 'Lima',
  'America/Santiago': 'Santiago',
  'America/Caracas': 'Caracas',
  'America/Anchorage': 'Anchorage',
  'America/Honolulu': 'Honolulu',
  'Europe/Madrid': 'Madrid',
  'Europe/Lisbon': 'Lisboa',
  'Europe/London': 'Londres',
  'Europe/Paris': 'París',
  'Europe/Berlin': 'Berlín',
  'Europe/Copenhagen': 'Copenhague',
  'Europe/Amsterdam': 'Ámsterdam',
  'Europe/Rome': 'Roma',
  'Asia/Tokyo': 'Tokio',
  'Asia/Shanghai': 'Shanghái',
  'Asia/Dubai': 'Dubái',
  'Australia/Sydney': 'Sídney',
  UTC: 'UTC',
};

function fallbackCity(timeZone: string): string {
  // 'America/Mexico_City' → 'Mexico City'
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replaceAll('_', ' ');
}

/**
 * Devuelve el offset actual de una zona como "UTC-08" o "UTC+02".
 * Usa `timeZoneName: 'shortOffset'` que devuelve strings tipo
 * "GMT-8" o "GMT+5:30" → normalizamos.
 */
function getOffsetLabel(timeZone: string, ref: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(ref);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (!tzPart) return 'UTC';
    // Normaliza "GMT-8" → "UTC-08", "GMT+5:30" → "UTC+05:30", "GMT" → "UTC".
    let raw = tzPart.value;
    if (raw === 'GMT') return 'UTC';
    raw = raw.replace(/^GMT/, 'UTC');
    // Asegura dos dígitos en la parte de hora.
    return raw.replace(/^UTC([+-])(\d)(?!\d)/, 'UTC$10$2');
  } catch {
    return 'UTC';
  }
}

/**
 * `formatTimezoneLabel('America/Los_Angeles')` → `"Los Ángeles (UTC-08)"`.
 *
 * Si la zona no está en el mapping, hace fallback al último segmento del
 * IANA tz reemplazando `_` por espacio (ej. `America/Anchorage` →
 * `Anchorage`).
 */
export function formatTimezoneLabel(timeZone: string, ref: Date = new Date()): string {
  const city = TIMEZONE_CITY_ES[timeZone] ?? fallbackCity(timeZone);
  const offset = getOffsetLabel(timeZone, ref);
  return `${city} (${offset})`;
}
