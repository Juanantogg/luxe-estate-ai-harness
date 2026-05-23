import { Icon } from '@/components/ui';
import { formatArea } from '@/lib/properties/format';

export interface PropertyFeaturesProps {
  areaSqm: number | null;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number | null;
}

interface Feature {
  icon: string;
  value: string;
  label: string;
}

/**
 * Grid de specs principales (m², habitaciones, baños, estacionamientos)
 * dentro de una card blanca. Cada celda usa el patrón hint-green soft
 * para reforzar la jerarquía visual sin competir con la card de precio.
 *
 * Si `area_sqm` viene `null`, se omite la celda (3 cells en md+, 1 row
 * en mobile). Para `parking_spaces` mostramos `0` cuando es `null` o `0`
 * — mantiene el grid balanceado en lugar de un hueco.
 */
export function PropertyFeatures({
  areaSqm,
  bedrooms,
  bathrooms,
  parkingSpaces,
}: PropertyFeaturesProps) {
  const formattedArea = formatArea(areaSqm);
  const features: Feature[] = [];

  if (formattedArea) {
    features.push({ icon: 'square_foot', value: formattedArea, label: 'Metros cuadrados' });
  }
  features.push({ icon: 'king_bed', value: String(bedrooms), label: 'Habitaciones' });
  features.push({ icon: 'bathtub', value: String(bathrooms), label: 'Baños' });
  features.push({
    icon: 'directions_car',
    value: String(parkingSpaces ?? 0),
    label: 'Estacionamientos',
  });

  return (
    <section className="rounded-xl border border-divider-soft bg-surface p-6 shadow-soft md:p-8">
      <h2 className="mb-6 text-lg font-semibold text-on-surface md:text-xl">Características</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.label}
            className="flex flex-col items-center justify-center rounded-lg border border-primary/10 bg-primary-soft p-4 text-center"
          >
            <Icon name={feature.icon} size="lg" className="mb-2 text-primary" />
            <span className="text-xl font-bold text-on-surface">{feature.value}</span>
            <span className="mt-1 text-xs tracking-wider text-muted uppercase">
              {feature.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
