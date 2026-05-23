import Link from 'next/link';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; filters?: string }>;
}

/**
 * Placeholder de búsqueda. Renderiza el query recibido sin ejecutar nada en
 * la DB. La implementación real corresponde a la feature `search_filters_modal`.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = sp.q?.trim();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="mb-2 text-3xl font-light text-on-surface">Búsqueda</h1>
      <p className="text-muted">
        Esta sección llega pronto.{' '}
        {query && (
          <>
            Buscaste: <span className="font-medium text-on-surface">&ldquo;{query}&rdquo;</span>.
          </>
        )}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Volver a la home
      </Link>
    </div>
  );
}
