import Link from 'next/link';
import { Button, Icon } from '@/components/ui';
import type { VisitsBuckets } from '@/lib/profile/queries';
import { VisitCard } from './VisitCard';

export interface VisitsListProps {
  buckets: VisitsBuckets;
}

interface SectionHeaderProps {
  id: string;
  title: string;
}

function SectionHeader({ id, title }: SectionHeaderProps) {
  return (
    <h2 id={id} className="mb-6 flex items-center gap-3 text-xl font-bold text-on-surface">
      <span className="h-7 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      {title}
    </h2>
  );
}

/**
 * Empty state del tab Visitas cuando AMBAS secciones (Próximas y Pasadas)
 * están vacías. Si solo una está vacía, esa sección no se renderiza.
 */
function VisitsEmptyState() {
  return (
    <section
      aria-labelledby="visits-empty-heading"
      className="rounded-xl bg-surface-soft px-4 py-16 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary">
        <Icon name="event_available" size="xl" />
      </div>
      <h2 id="visits-empty-heading" className="mt-6 text-xl font-medium text-on-surface">
        Aún no agendaste visitas
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Explorá propiedades y reservá una visita para verlas en persona.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/" aria-label="Explorar propiedades en la home">
          <Button variant="primary" size="md" leadingIcon="search" tabIndex={-1}>
            Explorar propiedades
          </Button>
        </Link>
      </div>
    </section>
  );
}

/**
 * Render del tab Visitas: dos secciones (Próximas / Pasadas), cada una solo
 * se pinta si tiene items. Si ambas están vacías, mostramos un empty state
 * con CTA hacia la home.
 *
 * Decisión humana (2026-05-25): "Pasadas" no muestra el botón Reagendar;
 * para repetir una visita el user vuelve al detalle de la propiedad y agenda
 * una nueva.
 */
export function VisitsList({ buckets }: VisitsListProps) {
  const { upcoming, past } = buckets;
  const isEmpty = upcoming.length === 0 && past.length === 0;

  if (isEmpty) {
    return <VisitsEmptyState />;
  }

  return (
    <div className="space-y-12">
      {upcoming.length > 0 && (
        <section aria-labelledby="visits-upcoming">
          <SectionHeader id="visits-upcoming" title="Próximas visitas" />
          <ul className="list-none space-y-4 p-0">
            {upcoming.map((visit) => (
              <li key={visit.id}>
                <VisitCard visit={visit} isUpcoming />
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="visits-past">
          <SectionHeader id="visits-past" title="Visitas pasadas" />
          <ul className="list-none space-y-4 p-0">
            {past.map((visit) => (
              <li key={visit.id}>
                <VisitCard visit={visit} isUpcoming={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
