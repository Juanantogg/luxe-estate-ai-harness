import Link from 'next/link';
import { Button } from '@/components/ui';

export default function PropertyEditNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-on-surface">Propiedad no encontrada</h1>
      <p className="text-sm text-muted">
        La propiedad no existe o no tienes permiso para editarla.
      </p>
      <Link href="/dashboard">
        <Button variant="primary">Volver al dashboard</Button>
      </Link>
    </div>
  );
}
