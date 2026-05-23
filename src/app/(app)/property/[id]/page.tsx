import Link from 'next/link';

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Placeholder de detalle de propiedad. La implementación real corresponde a
 * `property_details_screen` y validará que el ID exista vía RLS. Por ahora
 * sólo renderiza el ID para evitar 404 desde los enlaces de PropertyCard.
 */
export default async function PropertyDetailPlaceholder({ params }: PropertyDetailPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="mb-2 text-3xl font-light text-on-surface">Detalle de propiedad</h1>
      <p className="mb-1 text-muted">Esta vista llega pronto.</p>
      <p className="mb-6 text-sm text-muted">
        ID:{' '}
        <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-on-surface">
          {id}
        </code>
      </p>
      <Link
        href="/"
        className="inline-block text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
