'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { Icon, IconButton, Input } from '@/components/ui';

export interface UserDirectorySearchProps {
  initialQuery: string;
}

/**
 * Search input del directorio admin. Sin debounce automático: submit
 * explícito por Enter o blur (decisión §14 del spec). Preserva la tab
 * activa (`?tab=`) al re-armar la URL via `searchParams.toString()`.
 *
 * Botón "Limpiar" aparece cuando hay query y dispara una navegación a la
 * URL sin `?q=`.
 *
 * Para que el estado interno se sincronice cuando `initialQuery` cambia
 * (navegación lateral / pop state), el padre debe pasar `key={initialQuery}`
 * y forzar remount — es más barato que `useEffect(setState)` que React 19
 * desaconseja explícitamente.
 */
export function UserDirectorySearch({ initialQuery }: UserDirectorySearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const inputId = useId();

  function buildHref(nextQuery: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      params.set('q', nextQuery);
    } else {
      params.delete('q');
    }
    params.delete('page');
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : '/admin/users';
  }

  function submit(next: string) {
    const trimmed = next.trim();
    if (trimmed === initialQuery) return;
    startTransition(() => {
      router.replace(buildHref(trimmed));
    });
  }

  function handleClear() {
    setValue('');
    startTransition(() => {
      router.replace(buildHref(''));
    });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
      className="relative w-full md:w-80"
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar usuarios por nombre o email
      </label>
      <Input
        id={inputId}
        type="search"
        size="md"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => submit(event.target.value)}
        leadingIcon="search"
        placeholder="Buscar por nombre o email…"
        autoComplete="off"
        className={value ? 'pr-10' : undefined}
      />
      {value && (
        <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <IconButton
            type="button"
            icon="close"
            variant="ghost"
            size="sm"
            aria-label="Limpiar búsqueda"
            onClick={handleClear}
          />
        </span>
      )}
      {/* Submit oculto para que Enter funcione sin botón visible */}
      <button type="submit" aria-hidden="true" tabIndex={-1} className="sr-only">
        <Icon name="search" />
      </button>
    </form>
  );
}
