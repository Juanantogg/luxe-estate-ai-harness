import { notFound, redirect } from 'next/navigation';
import { PropertyForm } from '@/components/property-form';
import { getSessionAndProfile } from '@/lib/auth/get-session';
import { getPropertyForEdit } from '@/lib/properties';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ROLES_ALLOWED = new Set(['agent', 'broker', 'admin']);

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/dashboard/properties/[id]/edit` — editar propiedad existente.
 *
 * Guards (spec §10.1):
 *  1. Sesión + rol agent/broker/admin.
 *  2. Property existe (sino `notFound`).
 *  3. Caller es owner O admin (sino `notFound`, no 403 — defense-in-depth
 *     contra leak de existencia).
 */
export default async function EditPropertyPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSessionAndProfile();
  if (!session?.user) {
    redirect(`/login?next=/dashboard/properties/${id}/edit`);
  }
  const role = session.profile?.role ?? 'user';
  if (!ROLES_ALLOWED.has(role)) {
    redirect('/');
  }

  const supabase = await createClient();
  const property = await getPropertyForEdit(supabase, id);
  if (!property) {
    notFound();
  }

  const isAdmin = role === 'admin';
  const isOwner = property.owner_id === session.user.id;
  if (!isAdmin && !isOwner) {
    notFound();
  }

  return <PropertyForm mode="edit" initial={property} ownerId={session.user.id} />;
}
