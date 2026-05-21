import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Server Components y Server Actions.
 * Lee/escribe cookies del request actual para mantener sesión.
 *
 * Uso:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('properties').select('*');
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component sin response → ignoramos.
            // El middleware refresca la sesión en cada request.
          }
        },
      },
    },
  );
}
