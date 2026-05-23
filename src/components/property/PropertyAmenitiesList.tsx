import { Icon } from '@/components/ui';
import { AMENITY_LABEL_ES, type AmenityKey } from '@/lib/properties/amenities';

export interface PropertyAmenitiesListProps {
  amenities: AmenityKey[];
}

/**
 * Grid con las amenities de la propiedad. Cada amenity se renderiza con un
 * `check_circle` constante + label español (paridad con mockup), aunque
 * el mapa de íconos específicos exista en `amenities.ts` para reuso futuro.
 *
 * Si no hay amenities, el componente devuelve `null` para que la página
 * no muestre un título vacío.
 */
export function PropertyAmenitiesList({ amenities }: PropertyAmenitiesListProps) {
  if (amenities.length === 0) return null;

  return (
    <section className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
      <h2 className="mb-6 text-lg font-semibold text-on-surface md:text-xl">Amenidades</h2>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {amenities.map((key) => (
          <li key={key} className="flex items-center gap-3 text-on-surface">
            <Icon name="check_circle" size="sm" className="text-primary" />
            <span>{AMENITY_LABEL_ES[key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
