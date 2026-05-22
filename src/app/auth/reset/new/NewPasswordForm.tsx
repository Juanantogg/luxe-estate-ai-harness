'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updatePassword, type AuthResult } from '@/lib/auth/actions';

type State = AuthResult | null;

async function action(_prev: State, formData: FormData): Promise<State> {
  return updatePassword(formData);
}

/**
 * Form controlado que invoca la Server Action `updatePassword`. En éxito
 * la action hace `redirect('/login?reset=ok')` y este componente nunca
 * llega a renderizar el resultado.
 */
export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  const errorMessage = state && !state.ok ? state.error.message : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Input
        type="password"
        name="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        required
        minLength={8}
        leadingIcon="lock"
      />
      <Input
        type="password"
        name="confirmPassword"
        label="Confirma la contraseña"
        autoComplete="new-password"
        required
        minLength={8}
        leadingIcon="lock"
      />
      {errorMessage && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {errorMessage}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={pending} fullWidth>
        Actualizar contraseña
      </Button>
    </form>
  );
}
