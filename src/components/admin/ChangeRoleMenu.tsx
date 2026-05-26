'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, Icon } from '@/components/ui';
import type { UserRole } from '@/lib/admin/queries';
import type { AssignableRole } from '@/lib/admin/schemas';
import { cn } from '@/lib/utils/cn';
import { ChangeRoleConfirmDialog, type ChangeRoleDialogAction } from './ChangeRoleConfirmDialog';

export interface ChangeRoleMenuProps {
  userId: string;
  currentRole: UserRole;
  currentIsActive: boolean;
  userDisplayName: string;
}

interface RoleMenuItem {
  role: AssignableRole;
  label: string;
  icon: string;
}

const ROLE_ITEMS: ReadonlyArray<RoleMenuItem> = [
  { role: 'admin', label: 'Administrador', icon: 'shield' },
  { role: 'agent', label: 'Agente', icon: 'support_agent' },
  { role: 'user', label: 'Usuario', icon: 'person' },
];

/**
 * Dropdown del botón "Cambiar rol". WAI-ARIA Menu pattern:
 *  - trigger con `aria-haspopup="menu"` / `aria-expanded`
 *  - panel con `role="menu"`, items `role="menuitem"`
 *  - flechas ↑/↓, Home/End, Escape, click-outside
 *
 * Items: 3 roles asignables (admin/agent/user) + suspender/reactivar
 * según `currentIsActive`. Click → cierra menú + abre el confirm dialog.
 */
export function ChangeRoleMenu({
  userId,
  currentRole,
  currentIsActive,
  userDisplayName,
}: ChangeRoleMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<ChangeRoleDialogAction | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  // Click-outside, Escape, focus management.
  useEffect(() => {
    if (!open) return;

    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);

    // Foco al primer item al abrir.
    const rafId = requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    });

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  function getMenuItems(): HTMLElement[] {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function focusByOffset(offset: number) {
    const items = getMenuItems();
    if (items.length === 0) return;
    const activeIndex = items.findIndex((el) => el === document.activeElement);
    const next = (activeIndex + offset + items.length) % items.length;
    items[next].focus();
  }

  function handleMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusByOffset(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusByOffset(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      getMenuItems()[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const items = getMenuItems();
      items[items.length - 1]?.focus();
    }
  }

  function handleRoleClick(role: AssignableRole) {
    close();
    if (role === currentRole) return; // No-op visual: la action server lo rechaza igual.
    setDialogAction({ kind: 'set_role', nextRole: role, currentRole });
  }

  function handleStatusClick() {
    close();
    setDialogAction(currentIsActive ? { kind: 'suspend' } : { kind: 'reactivate', currentRole });
  }

  return (
    <>
      <div className="relative inline-flex">
        <Button
          ref={triggerRef}
          variant="secondary"
          size="sm"
          trailingIcon={open ? 'expand_less' : 'expand_more'}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Cambiar rol de ${userDisplayName}`}
          onClick={() => setOpen((prev) => !prev)}
        >
          Cambiar rol
        </Button>

        {open && (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Acciones para ${userDisplayName}`}
            onKeyDown={handleMenuKey}
            className="absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-lg bg-primary text-on-primary shadow-dropdown focus:outline-none"
          >
            <div className="py-1">
              {ROLE_ITEMS.map((item) => {
                const isCurrent = item.role === currentRole;
                return (
                  <button
                    key={item.role}
                    role="menuitem"
                    type="button"
                    onClick={() => handleRoleClick(item.role)}
                    className={cn(
                      'group flex w-full items-center px-4 py-3 text-left text-xs transition-colors',
                      'focus:outline-none',
                      isCurrent
                        ? 'bg-on-primary/15 font-medium text-on-primary'
                        : 'text-on-primary/80 hover:bg-on-primary/10 hover:text-on-primary focus:bg-on-primary/10 focus:text-on-primary',
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size="sm"
                      className={cn(
                        'mr-3',
                        isCurrent
                          ? 'text-on-primary'
                          : 'text-on-primary/60 group-hover:text-on-primary group-focus:text-on-primary',
                      )}
                    />
                    {item.label}
                  </button>
                );
              })}

              <div className="my-1 border-t border-on-primary/10" />

              <button
                role="menuitem"
                type="button"
                onClick={handleStatusClick}
                className={cn(
                  'group flex w-full items-center px-4 py-3 text-left text-xs transition-colors',
                  'focus:outline-none',
                  'text-on-primary/80 hover:bg-on-primary/10 hover:text-on-primary focus:bg-on-primary/10 focus:text-on-primary',
                )}
              >
                <Icon
                  name={currentIsActive ? 'block' : 'restart_alt'}
                  size="sm"
                  className="mr-3 text-on-primary/60 group-hover:text-on-primary group-focus:text-on-primary"
                />
                {currentIsActive ? 'Suspender usuario' : 'Reactivar usuario'}
              </button>
            </div>
          </div>
        )}
      </div>

      {dialogAction && (
        <ChangeRoleConfirmDialog
          open
          onClose={() => {
            setDialogAction(null);
            // Devolvemos foco al trigger después de cerrar el dialog.
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          userId={userId}
          userDisplayName={userDisplayName}
          action={dialogAction}
        />
      )}
    </>
  );
}
