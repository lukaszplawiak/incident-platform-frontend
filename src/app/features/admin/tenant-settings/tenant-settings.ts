import { Component, OnInit, inject, signal } from '@angular/core';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Tenant-wide settings — currently just mfaRequired. ADMIN only
 * (@PreAuthorize("hasRole('ADMIN')") on both GET and POST on the
 * backend), so this route uses adminGuard, matching /admin/users,
 * /admin/teams, /admin/integrations.
 *
 * Turning mfaRequired on is a real, disruptive action for any user
 * without personal MFA already configured: their next login returns
 * mfaSetupRequired instead of completing normally, and they're routed
 * through /mfa-setup-required before they can do anything else. That
 * flow works correctly end-to-end (see the auth-service backend fix this
 * branch depends on — previously it was a hard login lockout with no
 * self-service recovery), but it's still an interruption every affected
 * user will hit at their next login, not something to flip casually. The
 * confirmation dialog below exists for that reason — turning it back off
 * needs no such warning, since it only relaxes a requirement.
 */
@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [],
  templateUrl: './tenant-settings.html',
  styleUrl: './tenant-settings.scss',
})
export class TenantSettings implements OnInit {

  private readonly tenantSettingsService = inject(TenantSettingsService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly mfaRequired = signal(false);
  readonly showEnableConfirm = signal(false);

  ngOnInit(): void {
    this.tenantSettingsService.getSettings().subscribe({
      next: settings => {
        this.mfaRequired.set(settings.mfaRequired);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load tenant settings');
      }
    });
  }

  onToggleClick(): void {
    if (this.mfaRequired()) {
      // Turning off is always safe — no confirmation needed.
      this.save(false);
    } else {
      this.showEnableConfirm.set(true);
    }
  }

  confirmEnable(): void {
    this.showEnableConfirm.set(false);
    this.save(true);
  }

  cancelEnable(): void {
    this.showEnableConfirm.set(false);
  }

  private save(mfaRequired: boolean): void {
    this.saving.set(true);

    this.tenantSettingsService.updateSettings({ mfaRequired }).subscribe({
      next: settings => {
        this.mfaRequired.set(settings.mfaRequired);
        this.saving.set(false);
        this.toast.success(
          settings.mfaRequired
            ? 'MFA is now required for all users in this tenant.'
            : 'MFA is no longer required tenant-wide.'
        );
        this.logger.info('Tenant settings updated', { mfaRequired: settings.mfaRequired });
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Failed to update tenant settings');
      }
    });
  }
}