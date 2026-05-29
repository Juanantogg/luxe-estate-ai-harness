import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Icon } from '@/components/ui';
import { VisitPropertySummary, VisitScheduler } from '@/components/visits';
import { getPropertyDetail } from '@/lib/properties/queries';
import { getPropertyUrl } from '@/lib/properties/urls';
import { createClient } from '@/lib/supabase/server';
import { getAgentOccupiedSlots } from '@/lib/visits/queries';
import { formatTimezoneLabel } from '@/lib/visits/timezone-label';

interface SchedulePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Página privada `/property/[slug]/schedule`. El middleware ya redirige a
 * `/login?next=...` si no hay sesión.
 *
 * Reglas (spec §2):
 * - `notFound()` si la propiedad no existe o no es `active`.
 * - Si el visitante es el dueño → redirect a `/dashboard/properties/[id]/edit`.
 * - Carga slots ocupados del agente vía RPC y los pasa al Client.
 * - Si el segmento recibido es un UUID legacy, se hace `permanentRedirect`
 *   (308) a `/property/<slug>/schedule` antes de cualquier otra lógica.
 */
export default async function SchedulePage({ params, searchParams }: SchedulePageProps) {
  const { slug } = await params;

  const supabase = await createClient();

  // Compatibilidad con URLs legacy con UUID en el path. Igual que el page
  // de detalle: lookup por id, leer slug, 308 al canónico.
  if (UUID_REGEX.test(slug)) {
    const { data: legacyRow, error: legacyError } = await supabase
      .from('properties')
      .select('slug')
      .eq('id', slug)
      .maybeSingle();
    if (legacyError || !legacyRow) notFound();
    permanentRedirect(`/property/${legacyRow.slug}/schedule`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // El middleware garantiza user != null para esta ruta — la doble verificación
  // es defense-in-depth. El `next` queda con el path literal (slug), no se usa
  // el helper porque acá `next=` es destino del login, no URL canónica.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/property/${slug}/schedule`)}`);
  }

  const property = await getPropertyDetail(supabase, { slug }, { isAuthenticated: true });
  if (!property || property.listing_status !== 'active') {
    notFound();
  }

  if (property.owner_id === user.id) {
    redirect(`/dashboard/properties/${property.id}/edit`);
  }

  const occupiedSlotsIso = await getAgentOccupiedSlots(supabase, property.owner_id);
  const tzLabel = formatTimezoneLabel(property.timezone);

  const { date: initialDate } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <Link
        href={getPropertyUrl(property)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Icon name="arrow_back" size="sm" />
        Volver al detalle
      </Link>

      <section className="overflow-hidden rounded-xl border border-divider-soft bg-surface shadow-soft">
        <div className="flex flex-col md:flex-row">
          <aside className="bg-surface-soft p-6 md:w-5/12 md:p-8 lg:p-10">
            <VisitPropertySummary property={property} isAuthenticated />
          </aside>

          <div className="flex flex-col p-6 md:w-7/12 md:p-8 lg:p-10">
            <header className="mb-8">
              <h1 className="mb-2 text-2xl font-medium text-on-surface md:text-3xl">
                Agendar una visita
              </h1>
              <p className="text-sm text-muted">
                Elige una fecha y hora para recorrer la propiedad en persona.
              </p>
            </header>

            <VisitScheduler
              propertyId={property.id}
              occupiedSlotsIso={occupiedSlotsIso}
              propertyTimeZone={property.timezone}
              propertyTimeZoneLabel={tzLabel}
              initialDateIso={initialDate}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
