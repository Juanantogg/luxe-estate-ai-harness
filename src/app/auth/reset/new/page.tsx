import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewPasswordForm } from './NewPasswordForm';

/**
 * Form de "nueva contraseña" tras hacer click en el link de reset.
 *
 * Server Component: verifica que exista una sesión activa (Supabase la
 * setea en `/auth/reset` al intercambiar el code). Si no hay user,
 * el link expiró o ya se usó → redirige a `/login` con el error claro.
 */
export default async function ResetNewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=reset_token_invalid');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <article className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <span className="material-icons text-2xl text-primary" aria-hidden="true">
            lock_reset
          </span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-bold text-on-surface">Nueva contraseña</h1>
        <p className="mt-3 text-center text-sm text-muted">
          Elige una contraseña segura para tu cuenta. Mínimo 8 caracteres con letras y números.
        </p>
        <div className="mt-6">
          <NewPasswordForm />
        </div>
      </article>
    </main>
  );
}
