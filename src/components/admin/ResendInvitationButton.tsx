'use client';

import { useState, useTransition } from 'react';
import { Button, Toast } from '@/components/ui';
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
 * antiguo. Llama a la Server Action `resendInvitation` y muestra el
 * resultado mediante el primitivo `Toast` flotante: variant `success`
 * cuando ok (auto-dismiss 4s), variant `danger` cuando error (sin
 * auto-dismiss para que el admin pueda leer el mensaje).
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
    });
  }

  const toastMessage =
    feedback.kind === 'success'
      ? `Invitación reenviada a ${userDisplayName}.`
      : feedback.kind === 'error'
        ? feedback.message
        : '';

  return (
    <>
      <div className="flex flex-col items-stretch md:items-end">
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
      </div>
      <Toast
        open={feedback.kind !== 'idle'}
        onClose={() => setFeedback({ kind: 'idle' })}
        variant={feedback.kind === 'error' ? 'danger' : 'success'}
        message={toastMessage}
        autoDismissMs={feedback.kind === 'error' ? 0 : 4000}
      />
    </>
  );
}
