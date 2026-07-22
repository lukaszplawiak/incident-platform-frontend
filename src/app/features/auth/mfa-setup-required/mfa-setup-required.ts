import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ApiError } from '../../../core/errors/api-error';
import { MfaSetupResponse } from '../../../core/models/auth.model';

/**
 * Forced MFA setup screen — shown after login when mfaSetupRequired=true:
 * the tenant requires MFA, this user has none configured, and login is
 * blocked until setup completes (see LoginResponse.mfaSetupRequired on the
 * backend, and TenantSettings' mfaRequired toggle in the admin settings
 * page that causes this state to occur in the first place).
 *
 * Structurally a hybrid of mfa-verify.ts (public route, reads
 * mfaSetupToken/tenantId via router state, redirects to /login if state is
 * missing) and mfa-settings.ts (QR rendering, setup+enable flow, one-time
 * backup codes display) — but unlike mfa-settings, this page cannot use
 * authGuard or an access token, because none has been issued yet. That's
 * the entire reason this is a separate page rather than just redirecting
 * into /mfa-settings.
 */
@Component({
  selector: 'app-mfa-setup-required',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './mfa-setup-required.html',
  styleUrl: './mfa-setup-required.scss'
})
export class MfaSetupRequired implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly idleService = inject(IdleService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly logger = inject(LoggerService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly setupResponse = signal<MfaSetupResponse | null>(null);
  readonly qrDataUrl = signal<string | null>(null);

  readonly enableLoading = signal(false);
  readonly enableError = signal<string | null>(null);

  readonly justEnabledBackupCodes = signal<string[] | null>(null);

  private mfaSetupToken = '';

  readonly enableForm: FormGroup = this.fb.group({
    totpCode: ['', [
      Validators.required,
      Validators.pattern(/^\d{6}$/),
    ]],
  });

  ngOnInit(): void {
    // Router state available only on first render after navigation, same
    // reasoning as mfa-verify.ts — on page refresh, state is lost and
    // there is no way to recover the setup token, so redirect to /login
    // rather than show a dead-end form.
    const state = this.router.getCurrentNavigation()?.extras.state
      ?? history.state;

    if (!state?.['mfaSetupToken']) {
      this.logger.warn('MFA setup-required screen accessed without state — redirecting to login');
      this.router.navigate(['/login']);
      return;
    }

    this.mfaSetupToken = state['mfaSetupToken'] as string;
    this.loadSetup();
  }

  private loadSetup(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.setupMfaRequired({ mfaSetupToken: this.mfaSetupToken }).subscribe({
      next: async response => {
        this.setupResponse.set(response);
        this.loading.set(false);
        try {
          // Rendered entirely client-side — response.qrUrl embeds the raw
          // TOTP secret and must never be sent to any third-party QR
          // generation service. Same reasoning as mfa-settings.ts.
          const dataUrl = await QRCode.toDataURL(response.qrUrl, {
            width: 220,
            margin: 1,
          });
          this.qrDataUrl.set(dataUrl);
        } catch {
          this.logger.warn('Failed to render MFA QR code client-side');
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.humanizeSetupError(err));
      }
    });
  }

  submitEnable(): void {
    if (this.enableForm.invalid) {
      this.enableForm.markAllAsTouched();
      return;
    }

    const { totpCode } = this.enableForm.value as { totpCode: string };

    this.enableLoading.set(true);
    this.enableError.set(null);

    this.authService.completeMfaSetupRequired({
      mfaSetupToken: this.mfaSetupToken,
      totpCode,
    }).subscribe({
      next: response => {
        this.enableLoading.set(false);
        this.logger.info('MFA set up — login completed');
        this.justEnabledBackupCodes.set(response.backupCodes);
      },
      error: (err: unknown) => {
        this.enableLoading.set(false);
        this.enableForm.reset();
        this.enableError.set(this.humanizeEnableError(err));
      }
    });
  }

  /** User clicked "I've saved my backup codes" — finish, land on the dashboard. */
  continueToApp(): void {
    this.idleService.startWatching();
    this.router.navigate(['/incidents']);
  }

  hasEnableError(errorType: string): boolean {
    const control = this.enableForm.get('totpCode');
    return !!(control?.touched && control?.hasError(errorType));
  }

  private humanizeSetupError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'This setup session has expired. Please log in again.';
      }
      if (err.status === 409) {
        return 'MFA is already enabled on this account. Please log in again.';
      }
    }
    return 'Could not start MFA setup. Please try again.';
  }

  private humanizeEnableError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Invalid code, or this setup session has expired. Check your authenticator app, or log in again to restart.';
      }
      if (err.status === 409) {
        return 'No pending setup found — please log in again to restart.';
      }
    }
    return 'Could not complete MFA setup. Please try again.';
  }
}