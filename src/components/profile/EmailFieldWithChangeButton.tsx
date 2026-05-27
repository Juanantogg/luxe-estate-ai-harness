'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { ChangeEmailDialog } from './ChangeEmailDialog';

export interface EmailFieldWithChangeButtonProps {
  /** Email actual del usuario (mostrado en el field readonly + en el dialog). */
  email: string;
  /**
   * Si `false`, el botón "Cambiar" queda disabled con tooltip y helper
   * text específico para el caso OAuth-only (ver `progress/change_email_flow/design.md`
   * §7). Detección en el server-side desde `user.identities`.
   */
  canChangeEmail: boolean;
}

/**
 * Field "Dirección de correo" del `SettingsPanel` con el botón "Cambiar"
 * que abre el `ChangeEmailDialog`. Aislado como Client Component para
 * que `SettingsPanel` siga siendo Server Component (lectura del email
 * desde el profile + composición pura).
 *
 * Cuando `canChangeEmail === false` (cuenta OAuth-only sin password):
 * el botón queda `disabled` con tooltip + helper text explicativo. El
 * modal nunca se abre. Defense-in-depth server-side: la action
 * `changeEmail` también devuelve `oauth_only` si el form llega POSTeado.
 */
export function EmailFieldWithChangeButton({
  email,
  canChangeEmail,
}: EmailFieldWithChangeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label
        htmlFor="settings-email"
        className="mb-2 block text-xs font-bold tracking-wider text-muted uppercase"
      >
        Dirección de correo
      </label>
      <div className="flex h-[50px] items-center gap-3 rounded-lg border border-outline bg-background px-3">
        <Icon name="mail" size="sm" className="text-muted" />
        <input
          id="settings-email"
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          className="flex-1 border-none bg-transparent text-sm text-on-surface outline-none placeholder:text-muted"
        />
        {canChangeEmail ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Cambiar dirección de correo"
            className={cn(
              'text-xs font-medium text-primary hover:underline',
              'focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
            )}
          >
            Cambiar
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Tu cuenta usa Google; no es posible cambiar el correo desde acá por ahora."
            aria-label="Cambiar dirección de correo (no disponible para cuentas de Google)"
            className="cursor-not-allowed text-xs font-medium text-muted disabled:opacity-60"
          >
            Cambiar
          </button>
        )}
      </div>
      {!canChangeEmail && (
        <p className="mt-1 text-xs text-muted">
          Para cambiar el correo de una cuenta de Google, inicia sesión con Google y actualízalo
          desde tu cuenta.
        </p>
      )}

      {canChangeEmail && (
        <ChangeEmailDialog open={open} currentEmail={email} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
