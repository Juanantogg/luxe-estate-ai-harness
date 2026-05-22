'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { resendVerificationEmail } from '@/lib/auth/actions';

interface ResendButtonProps {
  email: string;
}

const COOLDOWN_SECONDS = 60;

type Status =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

/**
 * Botón "Reenviar correo" con cooldown local de 60s tras éxito y feedback
 * accesible (`role="status"`/`role="alert"`). Invoca la Server Action
 * `resendVerificationEmail`.
 */
export function ResendButton({ email }: ResendButtonProps) {
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [remaining, setRemaining] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  function handleClick() {
    if (isPending || remaining > 0) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', email);
      const result = await resendVerificationEmail(formData);
      if (result.ok) {
        setStatus({ type: 'success', message: 'Te enviamos un nuevo enlace de confirmación.' });
        setRemaining(COOLDOWN_SECONDS);
      } else {
        setStatus({ type: 'error', message: result.error.message });
      }
    });
  }

  const disabled = isPending || remaining > 0;
  const label = remaining > 0 ? `Reenviar correo (${remaining}s)` : 'Reenviar correo';

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handleClick}
        loading={isPending}
        disabled={disabled}
        fullWidth
      >
        {label}
      </Button>
      {status.type === 'success' && (
        <p
          role="status"
          aria-live="polite"
          className="rounded bg-success-soft px-3 py-2 text-sm text-success"
        >
          {status.message}
        </p>
      )}
      {status.type === 'error' && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
