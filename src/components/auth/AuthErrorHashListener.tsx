'use client';

import { useEffect, useState } from 'react';
import { Toast } from '@/components/ui';

type AuthErrorKind = 'otp_expired' | 'access_denied' | 'unknown';

interface ParsedError {
  kind: AuthErrorKind;
  /** Mensaje en español ya resuelto desde el mapa. */
  message: string;
}

const AUTO_DISMISS_MS = 6000;

const COPY: Record<AuthErrorKind, string> = {
  otp_expired: 'El link de invitación expiró. Pídele al admin que te envíe uno nuevo.',
  access_denied: 'El link ya fue usado o no es válido. Si necesitas otro, pídeselo al admin.',
  unknown:
    'Hubo un problema con tu link de autenticación. Intenta de nuevo o pídele al admin un link nuevo.',
};

function parseHash(rawHash: string): ParsedError | null {
  if (!rawHash || rawHash === '#') return null;
  const params = new URLSearchParams(rawHash.replace(/^#/, ''));
  if (!params.has('error')) return null;

  const code = params.get('error_code');
  const kind: AuthErrorKind = code === 'otp_expired' || code === 'access_denied' ? code : 'unknown';

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[AuthErrorHashListener]', {
      error: params.get('error'),
      error_code: code,
      error_description: params.get('error_description'),
    });
  }

  return { kind, message: COPY[kind] };
}

/**
 * Lee `window.location.hash` al montarse y, si Supabase Auth devolvió un
 * error en el fragment (`#error=...&error_code=...`), muestra un toast
 * `warning` en español con el copy correspondiente. Limpia el hash de la
 * barra de direcciones con `history.replaceState` para que un F5 o un
 * compartir-URL no vuelva a disparar el aviso.
 *
 * El fragment es client-side: NO viaja al server, así que ni el
 * middleware ni la home Server Component pueden verlo. Por eso este
 * componente es Client y se monta en la home pública.
 */
export function AuthErrorHashListener() {
  const [error, setError] = useState<ParsedError | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseHash(window.location.hash);
    if (!parsed) return;

    // Limpia el hash sin agregar entry al history stack — lo hacemos antes
    // del setState para que el primer paint del toast ya tenga la URL
    // limpia.
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);

    // `setError` diferido a la próxima tick para no violar la regla
    // `react-hooks/set-state-in-effect` (mismo patrón usado en
    // `NotificationsDropdown`/`NotifBell`). La diferencia perceptible es
    // nula: el toast aparece en el siguiente frame.
    const t = setTimeout(() => setError(parsed), 0);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss y Escape los maneja el primitivo `Toast`. El listener solo
  // decide CUÁNDO abrir y le pasa `onClose` para que el primitivo pueda
  // cerrar.
  return (
    <Toast
      open={error !== null}
      onClose={() => setError(null)}
      variant="warning"
      message={error?.message ?? ''}
      autoDismissMs={AUTO_DISMISS_MS}
    />
  );
}
