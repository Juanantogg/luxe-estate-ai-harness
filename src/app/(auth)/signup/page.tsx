import { permanentRedirect } from 'next/navigation';

/**
 * `/signup` es un alias permanente (308) hacia `/login?mode=signup`. La
 * pantalla canónica del flujo de autenticación es `/login` con el modo
 * controlado por searchParam. Mantenemos esta URL accesible para deep
 * links externos sin duplicar UI ni lógica.
 */
export default function SignupAliasPage(): never {
  permanentRedirect('/login?mode=signup');
}
