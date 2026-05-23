'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Avatar, Icon } from '@/components/ui';
import { signOut } from '@/lib/auth/actions';
import { cn } from '@/lib/utils/cn';

export interface AvatarDropdownItem {
  key: string;
  label: string;
  href: string;
  /** Si está activo, marca como current y aplica estilo destacado. */
  isCurrent?: boolean;
}

export interface AvatarDropdownProps {
  /** Items que navegan a una ruta. Se ordenan en el menú antes del separador. */
  items: AvatarDropdownItem[];
  /** Display name (full_name o fallback al email). */
  displayName: string;
  /** Email para fallback de iniciales y subtítulo del header. */
  email: string;
  /** URL del avatar, opcional. */
  avatarUrl?: string | null;
  className?: string;
}

/**
 * Botón con `<Avatar>` que abre un menú accesible:
 * - Enter/Space en el trigger lo abre.
 * - ArrowDown/Up navega entre items.
 * - Escape cierra y devuelve el foco al trigger.
 * - Click fuera cierra.
 * - Sign out usa `<form action={signOut}>` para funcionar sin JS adicional.
 */
export function AvatarDropdown({
  items,
  displayName,
  email,
  avatarUrl,
  className,
}: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Cerrar al click fuera + Escape global, y mover foco al abrir.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        // Al tabear afuera del menú, cerrar (Tab natural sigue al siguiente
        // elemento del DOM; no robamos el foco).
        const active = document.activeElement;
        if (active && menuRef.current && !menuRef.current.contains(active)) {
          setOpen(false);
        }
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);

    // Mover foco al primer item del menú al abrir.
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Navegación con flechas dentro del menú.
  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    items[nextIndex]?.focus();
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center rounded-full transition-shadow',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        )}
      >
        <span className="sr-only">Abrir menú de usuario</span>
        <Avatar
          src={avatarUrl ?? undefined}
          name={displayName}
          size="sm"
          ring
          ringColor={open ? 'primary' : 'surface'}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Menú de usuario"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-lg border border-divider bg-surface shadow-dropdown',
            'focus:outline-none',
          )}
        >
          <div className="border-b border-divider px-4 py-3">
            <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>

          <ul className="py-1">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  role="menuitem"
                  href={item.href}
                  aria-current={item.isCurrent ? 'page' : undefined}
                  onClick={close}
                  className={cn(
                    'flex items-center justify-between px-4 py-2 text-sm transition-colors',
                    'hover:bg-surface-hover focus:bg-surface-hover focus:outline-none',
                    item.isCurrent ? 'font-medium text-primary' : 'text-on-surface',
                  )}
                >
                  <span>{item.label}</span>
                  {item.isCurrent && <Icon name="check" size="sm" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-divider py-1">
            <form action={signOut}>
              <button
                role="menuitem"
                type="submit"
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger transition-colors',
                  'hover:bg-surface-hover focus:bg-surface-hover focus:outline-none',
                )}
              >
                <Icon name="logout" size="sm" aria-hidden />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
