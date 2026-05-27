'use client';

import { useEffect } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/utils/cn';

export type ToastVariant = 'success' | 'warning' | 'danger';

export interface ToastProps {
  /** Si false, no renderiza nada. Controlado por el call site. */
  open: boolean;
  /**
   * Llamado cuando el toast pide cerrarse (auto-dismiss, Escape o botón X).
   * El call site decide si bajar `open` a false.
   */
  onClose: () => void;
  variant: ToastVariant;
  /** Texto en español, una sola línea conceptual. Envuelve si es largo. */
  message: string;
  /**
   * Milisegundos antes del auto-dismiss. `0` = no auto-dismiss (el call site
   * controla el cierre, p. ej. tras un redirect). Default 4000ms.
   */
  autoDismissMs?: number;
  /**
   * Si true (default), muestra botón X y permite Escape para cerrar. Si
   * false, solo cierra por auto-dismiss o porque el call site baje `open`
   * externamente.
   */
  dismissible?: boolean;
  /** Override del ícono. Si se omite, se usa el default por variant. */
  icon?: string;
}

interface VariantStyle {
  bg: string;
  text: string;
  ring: string;
  icon: string;
  role: 'status' | 'alert';
  live: 'polite' | 'assertive';
}

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    bg: 'bg-success',
    text: 'text-on-primary',
    ring: 'focus-visible:ring-success',
    icon: 'check_circle',
    role: 'status',
    live: 'polite',
  },
  warning: {
    bg: 'bg-warning',
    text: 'text-on-primary',
    ring: 'focus-visible:ring-warning',
    icon: 'warning',
    role: 'status',
    live: 'polite',
  },
  danger: {
    bg: 'bg-danger',
    text: 'text-on-primary',
    ring: 'focus-visible:ring-danger',
    icon: 'error',
    role: 'alert',
    live: 'assertive',
  },
};

/**
 * Toast primitivo flotante. Posición hardcoded `fixed bottom-20 left-1/2
 * -translate-x-1/2` porque los 3 call sites actuales del repo usan
 * exactamente esa posición.
 *
 * API controlada por props (sin provider/context): el call site mantiene
 * `open` en estado local y reacciona a `onClose` para cerrarlo. Esto
 * mantiene el componente como una primitiva fina y deja la coreografía
 * (cuándo abrir, en qué condición, qué hacer al cerrar) en el call site.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Toast
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   variant="success"
 *   message="Cambios guardados."
 * />
 */
export function Toast({
  open,
  onClose,
  variant,
  message,
  autoDismissMs = 4000,
  dismissible = true,
  icon,
}: ToastProps) {
  // Auto-dismiss
  useEffect(() => {
    if (!open || autoDismissMs <= 0) return;
    const t = setTimeout(() => onClose(), autoDismissMs);
    return () => clearTimeout(t);
  }, [open, autoDismissMs, onClose]);

  // Escape key (solo si dismissible)
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const styles = VARIANT_STYLES[variant];
  const iconName = icon ?? styles.icon;

  return (
    <div
      role={styles.role}
      aria-live={styles.live}
      className={cn(
        'fixed bottom-20 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2',
        'rounded-lg px-4 py-3 shadow-soft',
        'max-w-[calc(100%-2rem)] sm:max-w-md',
        styles.bg,
        styles.text,
      )}
    >
      <Icon name={iconName} size="sm" className="shrink-0" />
      <p className="text-sm leading-snug font-medium">{message}</p>
      {dismissible && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className={cn(
            'ml-1 shrink-0 cursor-pointer rounded p-0.5 transition-opacity hover:opacity-70',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            styles.ring,
          )}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
