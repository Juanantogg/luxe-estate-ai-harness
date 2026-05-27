import { Icon } from '@/components/ui';

/**
 * Search bar del hero. Es un `<form>` GET nativo: sin JavaScript también
 * navega correctamente a `/search?q=...`. No es Client Component.
 *
 * El primitivo `Input` no se reutiliza porque tiene altura fija y no soporta
 * botón submit absoluto sin overrides agresivos; ver decisión § 2.1.
 */
export function HeroSearch() {
  return (
    <form action="/search" method="get" role="search" className="relative mx-auto w-full max-w-2xl">
      <span
        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted"
        aria-hidden
      >
        <Icon name="search" size="lg" />
      </span>
      <input
        type="text"
        name="q"
        autoComplete="off"
        aria-label="Buscar propiedades"
        placeholder="Buscar por ciudad, barrio o tipo"
        className="block w-full rounded-xl border-none bg-surface py-4 pr-32 pl-12 text-lg text-on-surface shadow-soft placeholder:text-muted/70 focus:ring-2 focus:ring-primary focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-1/2 right-2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary shadow-soft transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Buscar
      </button>
    </form>
  );
}
