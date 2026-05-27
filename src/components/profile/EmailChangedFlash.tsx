'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast, type ToastVariant } from '@/components/ui';

export type EmailChangedKind = 'success' | 'pending' | 'error' | null;

export interface EmailChangedFlashProps {
  /**
   * Resultado del flujo, derivado en el server desde
   * `searchParams.email_changed`. Si es `null`, el componente no renderiza
   * nada (cero overhead en navegaciones normales del perfil).
   */
  kind: EmailChangedKind;
}

interface VariantSpec {
  variant: ToastVariant;
  message: string;
}

const SPEC: Record<Exclude<EmailChangedKind, null>, VariantSpec> = {
  success: {
    variant: 'success',
    message: 'Correo actualizado correctamente.',
  },
  pending: {
    variant: 'warning',
    message: 'Confirmaste un link. Revisa tu otro correo para terminar de cambiar el email.',
  },
  error: {
    variant: 'warning',
    message:
      'No pudimos confirmar el cambio. El link puede haber expirado o ya fue usado. Intenta solicitar uno nuevo.',
  },
};

const AUTO_DISMISS_MS = 6000;

/**
 * Toast efímero post-confirmación del flujo `change_email_flow`.
 *
 * El route handler `/auth/email-change` redirige a
 * `/profile?tab=settings&email_changed=<flag>` tras procesar el code. La
 * página del perfil (Server Component) parsea el flag y se lo pasa acá
 * como `kind`. Este componente monta el primitivo `<Toast>` con la
 * variant/copy correspondientes y, al cerrarse, limpia el query param
 * con `router.replace` para que:
 *  - Un F5 / share-URL no vuelva a disparar el toast.
 *  - El refresh de Server Components recoja el nuevo email (caso
 *    `pending → 1` tras el segundo link).
 *
 * Usamos `router.replace` (no `history.replaceState`) deliberadamente:
 * `router.replace` no añade entry al history stack y, a la vez, fuerza el
 * refresh de RSC que `replaceState` no hace.
 */
export function EmailChangedFlash({ kind }: EmailChangedFlashProps) {
  const router = useRouter();
  // `open` arranca true sii hay flag válido. Mantenerlo en state local
  // permite que el botón X del Toast lo baje a false sin refetch del
  // query param.
  const [open, setOpen] = useState<boolean>(kind !== null);

  // Si la prop `kind` cambia (caso teórico: navegación SPA que llega con
  // un nuevo `email_changed`), reabrimos el toast. `setOpen` diferido a
  // la próxima tick por la regla ESLint `react-hooks/set-state-in-effect`
  // (mismo patrón que `AuthErrorHashListener`).
  useEffect(() => {
    const t = setTimeout(() => setOpen(kind !== null), 0);
    return () => clearTimeout(t);
  }, [kind]);

  // Cuando el toast se cierra (auto-dismiss, Escape, X), limpiamos el
  // query param para que la URL quede en `/profile?tab=settings`.
  useEffect(() => {
    if (open || kind === null) return;
    router.replace('/profile?tab=settings');
  }, [open, kind, router]);

  if (kind === null) return null;
  const spec = SPEC[kind];

  return (
    <Toast
      open={open}
      onClose={() => setOpen(false)}
      variant={spec.variant}
      message={spec.message}
      autoDismissMs={AUTO_DISMISS_MS}
    />
  );
}
