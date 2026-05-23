'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { signInWithPassword, signUpAndRedirect, type AuthResult } from '@/lib/auth/actions';
import type { AuthErrorCode } from '@/lib/auth/errors';

export type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  initialMode: AuthMode;
  next?: string | null;
}

type State = AuthResult | null;

async function loginAction(_prev: State, formData: FormData): Promise<State> {
  return signInWithPassword(formData);
}

async function signupAction(_prev: State, formData: FormData): Promise<State> {
  return signUpAndRedirect(formData);
}

/**
 * Errores específicos por campo (modo signup). En login no exponemos el
 * campo concreto del error de credenciales para no facilitar enumeración.
 */
const SIGNUP_FIELD_ERRORS: Partial<Record<AuthErrorCode, 'email' | 'password'>> = {
  email_taken: 'email',
  weak_password: 'password',
};

/**
 * Form principal de la pantalla `/login`. Renderiza login o signup según
 * `initialMode`; el toggle se hace vía `<Link>` que cambia el searchParam,
 * con `key={initialMode}` en el page que fuerza un remount limpio.
 */
export function AuthForm({ initialMode, next }: AuthFormProps) {
  const mode = initialMode;
  const isSignup = mode === 'signup';

  // Dos hooks separados (uno por modo) para preservar la firma tipada de
  // cada Server Action; el remount por key descarta el estado del modo
  // anterior. Sólo el del modo activo se conecta al `<form action>`.
  const [loginState, loginFormAction, loginPending] = useActionState<State, FormData>(
    loginAction,
    null,
  );
  const [signupState, signupFormAction, signupPending] = useActionState<State, FormData>(
    signupAction,
    null,
  );

  const state = isSignup ? signupState : loginState;
  const formAction = isSignup ? signupFormAction : loginFormAction;
  const pending = isSignup ? signupPending : loginPending;

  const error = state && !state.ok ? state.error : null;
  const fieldError = error && isSignup ? SIGNUP_FIELD_ERRORS[error.code] : undefined;
  const emailFieldError = fieldError === 'email' ? error?.message : undefined;
  const passwordFieldError = fieldError === 'password' ? error?.message : undefined;
  const globalError = error && !fieldError ? error : null;

  // Foco programático: al montar va al primer campo editable; ante error
  // global se mueve al primero con `aria-invalid="true"`.
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!error) return;
    const node = formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]');
    node?.focus();
  }, [error]);

  // Capturamos el email tipeado para enlazar el reenvío de verificación
  // sin depender de leer el DOM en render (que rompe hidratación).
  const [emailDraft, setEmailDraft] = useState('');

  return (
    <div>
      <h2 id="auth-form-title" className="sr-only">
        {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
      </h2>

      {globalError && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 rounded border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <p>{globalError.message}</p>
          {globalError.code === 'email_not_confirmed' && emailDraft && (
            <Link
              href={`/auth/verify-email?email=${encodeURIComponent(emailDraft)}`}
              className="mt-1 inline-block font-semibold underline hover:no-underline"
            >
              Reenviar correo de confirmación
            </Link>
          )}
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ''} />

        {isSignup && (
          <Input
            ref={firstFieldRef}
            type="text"
            name="fullName"
            label="Nombre completo"
            placeholder="Tu nombre"
            autoComplete="name"
            required
            minLength={2}
            leadingIcon="person"
          />
        )}

        <Input
          ref={isSignup ? undefined : firstFieldRef}
          type="email"
          name="email"
          label="Correo electrónico"
          placeholder="tu@correo.com"
          autoComplete={isSignup ? 'email' : 'username'}
          inputMode="email"
          required
          leadingIcon="mail_outline"
          error={emailFieldError}
          value={emailDraft}
          onChange={(event) => setEmailDraft(event.target.value)}
        />

        <Input
          type="password"
          name="password"
          label="Contraseña"
          placeholder={isSignup ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : 1}
          leadingIcon="lock"
          helperText={
            isSignup && !passwordFieldError
              ? 'Mínimo 8 caracteres, incluye al menos una letra y un número.'
              : undefined
          }
          error={passwordFieldError}
        />

        {isSignup && (
          <Input
            type="password"
            name="confirmPassword"
            label="Confirma tu contraseña"
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            required
            minLength={8}
            leadingIcon="lock"
          />
        )}

        {!isSignup && (
          <div className="flex justify-end">
            <Link
              href="/auth/reset"
              className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={pending}
          disabled={pending}
          className="mt-2"
        >
          {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
        <Link
          href={isSignup ? '/login' : '/login?mode=signup'}
          className="font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {isSignup ? 'Inicia sesión' : 'Regístrate'}
        </Link>
      </p>
    </div>
  );
}
