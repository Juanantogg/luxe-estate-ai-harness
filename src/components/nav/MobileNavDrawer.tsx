'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui';
import { signOut } from '@/lib/auth/actions';
import { isLinkActive } from '@/lib/nav/active-link';
import { cn } from '@/lib/utils/cn';
import type { NavLink } from './NavLinks';
import type { AvatarDropdownItem } from './AvatarDropdown';

export interface MobileNavDrawerProps {
  links: NavLink[];
  /** Items que se replican del avatar dropdown para que el menú móvil sea autosuficiente. */
  dropdownItems: AvatarDropdownItem[];
  /** Display name del header del drawer. */
  displayName: string;
  email: string;
  /**
   * Modo anónimo: el header se reemplaza por CTAs "Iniciar sesión" /
   * "Registrarse" y se omite el botón de cerrar sesión.
   */
  anonymous?: boolean;
}

/**
 * Drawer lateral que se desliza desde la derecha en mobile. Incluye los
 * links del nav + los items del dropdown del avatar para que sea
 * autosuficiente. Maneja focus trap, scroll lock del body y devuelve el
 * foco al botón hamburguesa al cerrar.
 */
export function MobileNavDrawer({
  links,
  dropdownItems,
  displayName,
  email,
  anonymous = false,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Scroll lock + Escape + focus trap + foco al abrir/cerrar.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Capturamos el trigger en una variable local: el ref puede cambiar
    // entre el run del efecto y su cleanup (regla react-hooks/exhaustive-deps).
    const triggerNode = triggerRef.current;

    // Scroll lock del body sin saltos visuales.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function getFocusable(): HTMLElement[] {
      if (!panelRef.current) return [];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);

    // Mover foco al primer elemento focusable (botón close).
    const focusables = getFocusable();
    focusables[0]?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Devolver foco al trigger si sigue en el DOM.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        triggerNode?.focus();
      }
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-primary-soft hover:text-primary md:hidden',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        )}
      >
        <Icon name="menu" size="md" />
      </button>

      {/* El overlay + panel se portalizan a `document.body` para sacarlos del
          subárbol del `<nav>` del TopNav. El nav tiene `backdrop-filter: blur`,
          lo que por spec CSS lo convierte en el containing block de TODOS sus
          descendientes `position: fixed`. Mientras vivían dentro del nav, este
          `fixed inset-0` se anclaba al nav (~64px de alto) en vez del viewport:
          el drawer aparecía como una tira pegada al navbar en vez de ocupar la
          pantalla. Al portalizar a body recupera el viewport como containing
          block. `panelRef`/`triggerRef` siguen funcionando porque las refs
          apuntan al nodo esté donde esté en el DOM.
          Guard SSR-safe: `createPortal` necesita `document.body`, ausente en el
          server. El bloque solo se renderiza tras el click del usuario
          (post-hidratación), así que no hay riesgo de mismatch. */}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
            <button
              type="button"
              aria-label="Cerrar menú"
              tabIndex={-1}
              onClick={close}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm duration-200 animate-in fade-in"
            />

            <div
              ref={panelRef}
              id={drawerId}
              role="dialog"
              aria-modal="true"
              aria-label="Navegación móvil"
              className={cn(
                'absolute top-0 right-0 flex h-full w-[80%] max-w-xs flex-col bg-surface shadow-dropdown',
                'duration-200 animate-in slide-in-from-right',
              )}
            >
              <div className="flex items-center justify-between border-b border-divider px-4 py-4">
                {anonymous ? (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">Bienvenido</p>
                    <p className="text-xs text-muted">Inicia sesión para guardar y agendar.</p>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
                    <p className="truncate text-xs text-muted">{email}</p>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={close}
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-primary-soft hover:text-primary',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                  )}
                >
                  <Icon name="close" size="md" />
                </button>
              </div>

              {anonymous && (
                <div className="space-y-2 border-b border-divider px-4 py-4">
                  <Link
                    href="/login?mode=signup"
                    onClick={close}
                    className={cn(
                      'inline-flex h-10 w-full items-center justify-center rounded bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-soft transition-colors hover:bg-primary-hover',
                      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
                    )}
                  >
                    Registrarse
                  </Link>
                  <Link
                    href="/login"
                    onClick={close}
                    className={cn(
                      'inline-flex h-10 w-full items-center justify-center rounded border border-outline bg-transparent px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:border-primary hover:text-primary',
                      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
                    )}
                  >
                    Iniciar sesión
                  </Link>
                </div>
              )}

              <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-2 py-3">
                <ul className="space-y-1">
                  {links.map((link) => {
                    const active = isLinkActive(pathname, search, link.href);
                    return (
                      <li key={link.href + link.label}>
                        <Link
                          href={link.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={close}
                          className={cn(
                            'block rounded-sm px-3 py-2 text-base font-medium transition-colors',
                            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                            active
                              ? 'bg-primary-soft text-primary'
                              : 'text-on-surface hover:bg-surface-hover',
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {dropdownItems.length > 0 && (
                  <>
                    <div className="my-3 border-t border-divider" />
                    <ul className="space-y-1">
                      {dropdownItems.map((item) => (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            aria-current={item.isCurrent ? 'page' : undefined}
                            onClick={close}
                            className={cn(
                              'block rounded-sm px-3 py-2 text-sm transition-colors',
                              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                              item.isCurrent
                                ? 'font-medium text-primary'
                                : 'text-on-surface hover:bg-surface-hover',
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </nav>

              {!anonymous && (
                <div className="border-t border-divider px-2 py-3">
                  <form action={signOut}>
                    <button
                      type="submit"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-danger transition-colors',
                        'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
                      )}
                    >
                      <Icon name="logout" size="sm" aria-hidden />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
