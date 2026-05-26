'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ArchivedToggleProps {
  /**
   * Estado inicial del toggle, derivado del search param en el server
   * (`sp.archived === '1'`). Evita hydration mismatch.
   */
  initial: boolean;
}

/**
 * Switch accesible "Ver archivadas". Refleja el searchParam `?archived=1`.
 * Al togglear:
 *  - Construye nueva URL con `archived=1|0` y reset `page=1`.
 *  - Preserva el resto de los search params (`status`, `type`).
 *  - Usa `router.replace` para no agregar entry al historial por cada toggle.
 *
 * Patrón `role="switch" aria-checked` con `<label>` asociado vía `htmlFor`
 * para que el screen reader anuncie correctamente el estado.
 */
export function ArchivedToggle({ initial }: ArchivedToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const switchId = useId();

  const checked = initial;

  function onToggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (checked) {
      next.delete('archived');
    } else {
      next.set('archived', '1');
    }
    // Reset page al cambiar de modo (la cantidad de resultados cambia).
    next.delete('page');
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard');
    });
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-on-surface">
        Ver archivadas
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={isPending || undefined}
        onClick={onToggle}
        title="Incluye propiedades archivadas. Las archivadas no son visibles al público."
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
          checked ? 'bg-primary' : 'bg-neutral-300',
        )}
      >
        <span className="sr-only">Ver archivadas</span>
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-surface shadow-card transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
