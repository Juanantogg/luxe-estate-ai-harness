export type ProfileTabValue = 'saved' | 'visits' | 'settings';

export interface ProfileTab {
  value: ProfileTabValue;
  label: string;
}

const VALID_TAB_VALUES: ReadonlySet<ProfileTabValue> = new Set(['saved', 'visits', 'settings']);

/**
 * Normaliza el `?tab=` de la URL al `ProfileTabValue` correspondiente. Si el
 * valor falta o no es válido, devuelve `'saved'` (tab default). Vive en un
 * módulo neutro (sin `"use client"`) para que tanto el Server Component
 * `page.tsx` como el Client Component `ProfileTabs` puedan importarlo —
 * funciones exportadas desde archivos `"use client"` no se pueden invocar
 * desde el server (Next las marca como client references).
 */
export function parseProfileTab(raw: string | string[] | undefined): ProfileTabValue {
  if (typeof raw !== 'string') return 'saved';
  return VALID_TAB_VALUES.has(raw as ProfileTabValue) ? (raw as ProfileTabValue) : 'saved';
}
