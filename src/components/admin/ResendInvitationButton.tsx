'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { resendInvitation } from '@/lib/admin/actions';

export interface ResendInvitationButtonProps {
  userId: string;
  userEmail: string;
  userDisplayName: string;
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string };

/**
 * Botón "Reenviar invitación" para filas pending con last_invited_at
 * antiguo. Llama a la Server Action `resendInvitation`. Sigue el patrón
 * de feedback inline ya usado en InviteUserDialog (success/error como
 * <p> bajo el control) porque no hay sistema global de toast en el repo
 * todavía. El feedback se auto-limpia tras 4s en éxito y persiste hasta
 * próximo clic en error.
 *
 * Decisión: `useTransition` (no `useState<isPending>` manual). Razones:
 *  - Es un Server Action call — useTransition lo wrappea naturalmente.
 *  - Permite que React mantenga visible la UI vieja durante la transición
 *    (mismo patrón que InviteUserDialog / ChangeRoleConfirmDialog).
 *  - Permite usar `loading={isPending}` directamente en el Button.
 */
export function ResendInvitationButton({
  userId,
  userEmail,
  userDisplayName,
}: ResendInvitationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });

  function handleClick() {
    setFeedback({ kind: 'idle' });
    startTransition(async () => {
      const result = await resendInvitation({ targetUserId: userId });
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message });
        return;
      }
      setFeedback({ kind: 'success', email: result.email });
      // Auto-limpia tras 4s para que la fila vuelva a su estado
      // "esperando aceptación" visualmente.
      setTimeout(() => setFeedback({ kind: 'idle' }), 4000);
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5 md:items-end">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon="send"
        loading={isPending}
        disabled={isPending || feedback.kind === 'success'}
        aria-label={`Reenviar invitación a ${userEmail}`}
        aria-busy={isPending}
        onClick={handleClick}
        className="md:w-auto"
        fullWidth
      >
        Reenviar invitación
      </Button>
      {feedback.kind === 'success' && (
        <p className="text-xs text-primary md:text-right" role="status">
          Invitación reenviada a <span className="font-medium">{userDisplayName}</span>.
        </p>
      )}
      {feedback.kind === 'error' && (
        <p className="text-xs text-danger md:text-right" role="alert">
          {feedback.message}
        </p>
      )}
    </div>
  );
}
