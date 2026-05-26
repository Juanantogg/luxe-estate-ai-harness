'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { InviteUserDialog } from './InviteUserDialog';

/**
 * Botón "Invitar usuario" del header del directorio. Maneja el estado
 * local `open` del dialog.
 */
export function InviteUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="md" leadingIcon="person_add" onClick={() => setOpen(true)}>
        Invitar usuario
      </Button>
      <InviteUserDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
