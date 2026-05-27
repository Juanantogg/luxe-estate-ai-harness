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
import { Button, Icon, IconButton, Input } from '@/components/ui';
import { changeEmail } from '@/lib/profile/actions';
import { cn } from '@/lib/utils/cn';

export interface ChangeEmailDialogProps {
  open: boolean;
  /** Email actual del usuario (readonly, solo informativo). */
  currentEmail: string;
  onClose: () => void;
}

const AUTO_CLOSE_SUCCESS_MS = 8000;

/**
 * Modal de cambio de email. Copia el patrón de focus-trap propio de
 * `InviteUserDialog`: NO usamos Radix ni `<dialog>` nativo, NO extraemos
 * un primitivo `<Modal>` reusable (queda como deuda — ver
 * `progress/change_email_flow/design.md` §10).
 *
 * Estados internos:
 *  - `idle`     → form vacío editable, submit deshabilitado hasta que
 *                 ambos campos tengan al menos 1 char.
 *  - `loading`  → submit en curso. Inputs y botones Cancel/Close
 *                 deshabilitados; Escape ignorado (evita race entre
 *                 cierre y respuesta del server).
 *  - `success`  → form reemplazado por bloque "Revisa tu correo nuevo".
 *                 Auto-cierre a los 8s; Escape / Cancel / X cierran ok.
 *  - `error`    → form vuelve a editable con banner de error inline. El
 *                 banner desaparece cuando el user edita cualquier campo.
 *
 * Focus inicial: input "Correo nuevo" (el primer editable; "Correo actual"
 * es readonly). Focus restaurado al elemento previo al desmontar.
 */
export function ChangeEmailDialog({ open, currentEmail, onClose }: ChangeEmailDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const newEmailInputRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();
  const descId = useId();
  const emailFieldId = useId();
  const passwordFieldId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successNewEmail, setSuccessNewEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = useCallback(() => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  // Auto-cierre tras éxito.
  useEffect(() => {
    if (!successNewEmail) return;
    const t = setTimeout(() => onClose(), AUTO_CLOSE_SUCCESS_MS);
    return () => clearTimeout(t);
  }, [successNewEmail, onClose]);

  // Scroll lock + Escape + focus trap + focus inicial.
  // Mismo patrón que `InviteUserDialog`. En estado `loading`, el handler
  // `close()` ignora la solicitud por el guard interno.
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
    const rafId = requestAnimationFrame(() => newEmailInputRef.current?.focus());

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
    const trimmed = email.trim();
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', trimmed);
      formData.set('password', password);
      const result = await changeEmail(formData);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSuccessNewEmail(trimmed);
    });
  }

  function handleEditFieldChange(setter: (value: string) => void) {
    return (value: string) => {
      // Limpia banner de error al editar cualquier campo (UX rápida).
      if (error) setError(null);
      setter(value);
    };
  }

  const submitDisabled = email.trim().length === 0 || password.length === 0;

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
        aria-describedby={descId}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col bg-surface text-on-surface shadow-soft-hover',
          'rounded-t-xl md:my-auto md:max-w-md md:rounded-xl',
          'duration-200 animate-in slide-in-from-bottom md:fade-in md:zoom-in-95',
        )}
      >
        <header className="flex items-center justify-between border-b border-divider-soft px-6 py-4">
          <h2 id={headingId} className="text-lg font-bold tracking-tight text-on-surface">
            Cambiar dirección de correo
          </h2>
          <IconButton
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Cerrar"
            onClick={close}
            disabled={isPending}
          />
        </header>

        {successNewEmail ? (
          <SuccessBlock newEmail={successNewEmail} currentEmail={currentEmail} onClose={close} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <fieldset disabled={isPending} className="contents">
              <div className="flex-1 space-y-5 px-6 py-5">
                <p id={descId} className="text-sm text-muted">
                  Recibirás un link de confirmación en tu correo nuevo y otro en tu correo actual.
                  Hasta que confirmes ambos, tu correo seguirá siendo el actual.
                </p>

                <div>
                  <label
                    htmlFor={`${emailFieldId}-current`}
                    className="mb-1.5 block text-xs font-medium tracking-wider text-muted uppercase"
                  >
                    Correo actual
                  </label>
                  <Input
                    id={`${emailFieldId}-current`}
                    type="email"
                    value={currentEmail}
                    readOnly
                    aria-readonly="true"
                    leadingIcon="mail"
                    tabIndex={-1}
                  />
                </div>

                <div>
                  <label
                    htmlFor={emailFieldId}
                    className="mb-1.5 block text-xs font-medium tracking-wider text-muted uppercase"
                  >
                    Correo nuevo
                  </label>
                  <Input
                    ref={newEmailInputRef}
                    id={emailFieldId}
                    type="email"
                    required
                    value={email}
                    onChange={(event) => handleEditFieldChange(setEmail)(event.target.value)}
                    placeholder="tu-nuevo-correo@ejemplo.com"
                    leadingIcon="mail_outline"
                    autoComplete="email"
                    helperText="Debe ser distinto al correo actual."
                  />
                </div>

                <div>
                  <label
                    htmlFor={passwordFieldId}
                    className="mb-1.5 block text-xs font-medium tracking-wider text-muted uppercase"
                  >
                    Contraseña actual
                  </label>
                  <Input
                    id={passwordFieldId}
                    type="password"
                    required
                    value={password}
                    onChange={(event) => handleEditFieldChange(setPassword)(event.target.value)}
                    placeholder="Tu contraseña"
                    leadingIcon="lock"
                    autoComplete="current-password"
                    helperText="Confirmamos tu identidad antes de enviar los links."
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="rounded bg-danger-soft p-3 text-sm text-danger"
                  >
                    {error}
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-divider-soft px-6 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={close}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  leadingIcon="send"
                  loading={isPending}
                  disabled={submitDisabled}
                >
                  {isPending ? 'Enviando…' : 'Enviar links de confirmación'}
                </Button>
              </footer>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}

interface SuccessBlockProps {
  newEmail: string;
  currentEmail: string;
  onClose: () => void;
}

function SuccessBlock({ newEmail, currentEmail, onClose }: SuccessBlockProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center px-6 py-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
          <Icon name="mark_email_unread" size="lg" className="text-primary" />
        </div>
        <h3 className="text-xl font-bold text-on-surface">Revisa tu correo nuevo</h3>
        <p className="mt-3 text-sm text-muted">
          Te enviamos un link de confirmación a{' '}
          <span className="font-medium text-on-surface">{newEmail}</span>. También enviamos uno a tu
          correo actual (<span className="font-medium text-on-surface">{currentEmail}</span>). Tu
          correo cambiará cuando confirmes ambos.
        </p>
        <p className="mt-3 text-xs text-muted">
          Mientras tanto, tu correo actual sigue siendo válido para iniciar sesión.
        </p>
      </div>
      <footer className="flex items-center justify-end border-t border-divider-soft px-6 py-4">
        <Button type="button" variant="ghost" size="md" onClick={onClose}>
          Cerrar
        </Button>
      </footer>
    </div>
  );
}
