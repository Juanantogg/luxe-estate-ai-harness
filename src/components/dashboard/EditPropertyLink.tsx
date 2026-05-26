import Link from 'next/link';
import { IconButton } from '@/components/ui';

export interface EditPropertyLinkProps {
  propertyId: string;
  propertyTitle: string;
}

/**
 * Link "Editar" para una propiedad. Renderiza un IconButton ghost dentro
 * de un `<Link>` que navega a `/dashboard/properties/[id]/edit`.
 *
 * Esa ruta NO existe aún (la materializa la feature `add_edit_property_form`)
 * — aceptamos 404 transitorio hasta entonces (deuda documentada en el spec
 * §"Acciones").
 */
export function EditPropertyLink({ propertyId, propertyTitle }: EditPropertyLinkProps) {
  return (
    <Link
      href={`/dashboard/properties/${propertyId}/edit`}
      aria-label={`Editar ${propertyTitle}`}
      className="inline-flex"
    >
      <IconButton
        icon="edit"
        variant="ghost"
        size="md"
        aria-label={`Editar ${propertyTitle}`}
        tabIndex={-1}
      />
    </Link>
  );
}
