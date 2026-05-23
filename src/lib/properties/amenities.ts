import type { Database } from '@/types/database';

/**
 * Mapeo enum → label español + ícono Material para las amenities de una
 * propiedad. El enum oficial vive en `amenity_key` (src/types/database.ts).
 *
 * Convención: el detalle de propiedad renderiza siempre `check_circle` para
 * cada amenity (paridad con el mockup). Los íconos específicos están aquí
 * mapeados para reusarlos en filtros y formularios futuros (search_filters,
 * add_edit_property_form), donde sí se diferencian visualmente.
 */

export type AmenityKey = Database['public']['Enums']['amenity_key'];

export const AMENITY_LABEL_ES: Record<AmenityKey, string> = {
  pool: 'Piscina',
  gym: 'Gimnasio',
  wifi: 'Wi-Fi',
  air_conditioning: 'Aire acondicionado',
  garden: 'Jardín',
  smart_home: 'Smart home',
  parking: 'Estacionamiento',
  patio: 'Patio',
  wine_cellar: 'Cava de vinos',
  ev_charging: 'Carga vehículo eléctrico',
  central_heating: 'Calefacción central',
};

/**
 * Ícono Material Icons asociado a cada amenity. NO se usa en
 * `property_details_screen` (que renderiza `check_circle` constante);
 * se reserva para el modal de filtros de búsqueda.
 */
export const AMENITY_ICON: Record<AmenityKey, string> = {
  pool: 'pool',
  gym: 'fitness_center',
  wifi: 'wifi',
  air_conditioning: 'ac_unit',
  garden: 'yard',
  smart_home: 'cottage',
  parking: 'local_parking',
  patio: 'deck',
  wine_cellar: 'wine_bar',
  ev_charging: 'ev_station',
  central_heating: 'thermostat',
};
