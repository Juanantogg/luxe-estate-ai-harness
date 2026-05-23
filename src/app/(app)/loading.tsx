import { HomePageSkeleton } from '@/components/home';

/**
 * Skeleton mostrado mientras la home (o cualquier ruta dentro de (app)/ sin
 * loading propio) está cargando.
 */
export default function Loading() {
  return <HomePageSkeleton />;
}
