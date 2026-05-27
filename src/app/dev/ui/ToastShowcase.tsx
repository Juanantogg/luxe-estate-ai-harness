'use client';

import { useState } from 'react';
import { Button, Toast, type ToastVariant } from '@/components/ui';

const VARIANT_MESSAGES: Record<ToastVariant, string> = {
  success: 'Cambios guardados con éxito.',
  warning: 'El link de invitación expiró. Pídele al admin que te envíe uno nuevo.',
  danger: 'No se pudo procesar la solicitud. Intenta de nuevo.',
};

interface ToastRowProps {
  variant: ToastVariant;
}

/**
 * Fila de un variant de Toast: abre el toast con `autoDismissMs={0}` para
 * inspección visual estática y ofrece botón Reset para volver a abrirlo
 * tras cerrar manualmente.
 */
function ToastRow({ variant }: ToastRowProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-32 shrink-0 text-xs font-medium text-muted uppercase">{variant}</span>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={open}>
          Reset
        </Button>
        <span className="text-xs text-muted">
          {open ? 'Toast visible (fixed bottom-20).' : 'Cerrado — clic en Reset para reabrir.'}
        </span>
      </div>
      <Toast
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        message={VARIANT_MESSAGES[variant]}
        autoDismissMs={0}
      />
    </div>
  );
}

const VARIANTS: ToastVariant[] = ['success', 'warning', 'danger'];

/**
 * Showcase del primitivo Toast en `/dev/ui`. Como los 3 toasts compartirían
 * la misma posición fixed, se renderizan de a uno: el user clickea Reset
 * en la fila que quiere inspeccionar y cierra las otras con su X.
 */
export function ToastShowcase() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Los 3 variants comparten la misma posición fija (<code>bottom-20</code> centrado), por lo
        que solo conviene tener uno abierto a la vez. Cerrá uno con su X y abrí otro con Reset.
      </p>
      {VARIANTS.map((variant) => (
        <ToastRow key={variant} variant={variant} />
      ))}
    </div>
  );
}
