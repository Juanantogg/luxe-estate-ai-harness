'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import { Button, IconButton, Input } from '@/components/ui';
import { inviteUser } from '@/lib/admin/actions';
import type { AssignableRole } from '@/lib/admin/schemas';
import { cn } from '@/lib/utils/cn';

export interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: AssignableRole; label: string }> = [
  { value: 'user', label: 'Usuario' },
  { value: 'agent', label: 'Agente' },
  { value: 'admin', label: 'Administrador' },
];

/**
 * Modal de invitación. Form controlado (email + rol inicial). Patrón
 * propio de focus-trap + Escape + click-outside. Focus inicial en el
 * input de email (no en Cancelar, porque es el primer paso del flow).
 *
 * En éxito muestra el mensaje "Invitación enviada a {email}." por ~1.5s
 * y luego cierra. La página revalida via `revalidatePath` desde la action.
 */
export function InviteUserDialog({ open, onClose }: InviteUserDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();
  const emailFieldId = useId();
  const roleFieldId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('user');
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = useCallback(() => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  // No necesitamos `useEffect` para resetear el form: cuando `!open`
  // devolvemos `null`, así que la próxima apertura monta el componente
  // de cero con los valores iniciales del `useState`.

  // Auto-cierre tras éxito.
  useEffect(() => {
    if (!successEmail) return;
    const t = setTimeout(() => onClose(), 1500);
    return () => clearTimeout(t);
  }, [successEmail, onClose]);

  // Scroll lock + Escape + focus trap + focus initial en email input.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function getFocusable(): HTMLElement[] {
      if (!panelRef.current) return [];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    const rafId = requestAnimationFrame(() => emailInputRef.current?.focus());

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, close]);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await inviteUser({ email, initialRole: role });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSuccessEmail(result.email);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm duration-200 animate-in fade-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col bg-surface text-on-surface shadow-soft-hover',
          'rounded-t-xl md:my-auto md:max-w-md md:rounded-xl',
          'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
        )}
      >
        <header className="flex items-center justify-between border-b border-divider-soft px-6 py-4">
          <h2 id={headingId} className="text-lg font-bold tracking-tight text-on-surface">
            Invitar usuario
          </h2>
          <IconButton
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Cerrar diálogo"
            onClick={close}
            disabled={isPending}
          />
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-5 px-6 py-5">
            <p className="text-sm text-muted">
              Enviaremos un email con un link para que la persona complete su contraseña y acceda
              con el rol seleccionado.
            </p>

            <div>
              <label
                htmlFor={emailFieldId}
                className="mb-1.5 block text-xs font-medium tracking-wider text-muted uppercase"
              >
                Email del usuario
              </label>
              <Input
                ref={emailInputRef}
                id={emailFieldId}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@dominio.com"
                leadingIcon="mail_outline"
                disabled={isPending || successEmail !== null}
                autoComplete="off"
              />
            </div>

            <div>
              <label
                htmlFor={roleFieldId}
                className="mb-1.5 block text-xs font-medium tracking-wider text-muted uppercase"
              >
                Rol inicial
              </label>
              <select
                id={roleFieldId}
                value={role}
                onChange={(event) => setRole(event.target.value as AssignableRole)}
                disabled={isPending || successEmail !== null}
                className={cn(
                  'block h-10 w-full rounded border border-outline bg-surface px-4 text-sm text-on-surface',
                  'focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none',
                  'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-muted',
                )}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            {successEmail && (
              <p className="text-sm text-primary" role="status">
                Invitación enviada a <span className="font-medium">{successEmail}</span>.
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-divider-soft px-6 py-4">
            <Button type="button" variant="ghost" size="md" onClick={close} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leadingIcon="send"
              loading={isPending}
              disabled={successEmail !== null}
            >
              Enviar invitación
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
