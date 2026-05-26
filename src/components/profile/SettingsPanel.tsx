import { Icon } from '@/components/ui';
import { NotificationsToggle } from './NotificationsToggle';

export interface SettingsPanelProps {
  email: string;
}

/**
 * Tab "Preferencias y ajustes". Replica del bloque "Account Preferences" del
 * mockup: 2 fields en grid (1 col en <md, 2 cols en md+).
 *
 * - **Email**: readonly con ícono + botón "Cambiar" deshabilitado.
 *   El flujo real de cambio de email se implementa en la feature
 *   `change_email_flow` (ya agregada al backlog). Hasta entonces el control
 *   se pinta disabled con tooltip "Próximamente" para no romper el layout.
 * - **Notificaciones**: toggle placeholder sin persistencia.
 */
export function SettingsPanel({ email }: SettingsPanelProps) {
  return (
    <section
      aria-labelledby="settings-heading"
      className="rounded-2xl border border-divider-soft bg-surface p-6 sm:p-8"
    >
      <header>
        <h2 id="settings-heading" className="text-xl font-bold text-on-surface">
          Preferencias de la cuenta
        </h2>
        <p className="mt-1 text-sm text-muted">Gestiona tus ajustes y notificaciones.</p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="settings-email"
            className="mb-2 block text-xs font-bold tracking-wider text-muted uppercase"
          >
            Dirección de correo
          </label>
          <div className="flex h-[50px] items-center gap-3 rounded-lg border border-outline bg-background px-3">
            <Icon name="mail" size="sm" className="text-muted" />
            <input
              id="settings-email"
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className="flex-1 border-none bg-transparent text-sm text-on-surface outline-none placeholder:text-muted"
            />
            <button
              type="button"
              disabled
              title="Próximamente — el flujo de cambio de email se implementa en la feature change_email_flow"
              aria-label="Cambiar email (próximamente)"
              className="cursor-not-allowed text-xs font-medium text-muted disabled:opacity-60"
            >
              Cambiar
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            El cambio de email estará disponible próximamente.
          </p>
        </div>

        <div>
          <label
            htmlFor="settings-notifications"
            className="mb-2 block text-xs font-bold tracking-wider text-muted uppercase"
          >
            Notificaciones
          </label>
          <NotificationsToggle label="Alertas de nuevas propiedades" defaultChecked />
          <p className="mt-1 text-xs text-muted">Próximamente podrás guardar tus preferencias.</p>
        </div>
      </div>
    </section>
  );
}
