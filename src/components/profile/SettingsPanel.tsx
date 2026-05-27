import { EmailFieldWithChangeButton } from './EmailFieldWithChangeButton';
import { NotificationsToggle } from './NotificationsToggle';

export interface SettingsPanelProps {
  email: string;
  /**
   * Si `false` (cuenta OAuth-only sin password), el field email muestra
   * el botón "Cambiar" deshabilitado con tooltip + helper text
   * específico. Si `true`, el botón abre el `ChangeEmailDialog`.
   * Detección server-side desde `user.identities`.
   */
  canChangeEmail: boolean;
}

/**
 * Tab "Preferencias y ajustes". Replica del bloque "Account Preferences" del
 * mockup: 2 fields en grid (1 col en <md, 2 cols en md+).
 *
 * - **Email**: readonly con ícono + botón "Cambiar". El botón abre el
 *   `ChangeEmailDialog` (Client Component aislado en
 *   `EmailFieldWithChangeButton`) cuando `canChangeEmail === true`. Si
 *   `false`, se renderiza disabled con tooltip — caso OAuth-only.
 * - **Notificaciones**: toggle placeholder sin persistencia.
 */
export function SettingsPanel({ email, canChangeEmail }: SettingsPanelProps) {
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
        <EmailFieldWithChangeButton email={email} canChangeEmail={canChangeEmail} />

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
