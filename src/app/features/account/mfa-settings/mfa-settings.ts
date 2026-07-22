import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import * as QRCode from 'qrcode';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';
import { MfaSetupResponse, MfaBackupCodesStatus } from '../../../core/models/auth.model';

/**
 * Account security page — self-service MFA setup, enable, disable.
 *
 * Route uses authGuard, not adminGuard: every user manages their own MFA,
 * this has nothing to do with the ROLE_ADMIN/ROLE_RESPONDER distinction.
 *
 * Reads and writes User.mfaEnabled — added to UserSummaryDto alongside
 * this branch specifically so this page could tell "not set up yet" from
 * "already enabled" without resorting to using GET /mfa/backup-codes'
 * 409-vs-200 response as an implicit status probe.
 */
@Component({
  selector: 'app-mfa-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './mfa-settings.html',
  styleUrl: './mfa-settings.scss',
})
export class MfaSettings implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly mfaEnabled = signal(false);
  readonly backupCodesStatus = signal<MfaBackupCodesStatus | null>(null);

  // ── Setup flow (not yet enabled → scanning QR → confirming code) ───────────

  readonly setupResponse = signal<MfaSetupResponse | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly setupLoading = signal(false);
  readonly setupError = signal<string | null>(null);

  readonly enableLoading = signal(false);
  readonly enableError = signal<string | null>(null);

  readonly enableForm: FormGroup = this.fb.group({
    totpCode: ['', [
      Validators.required,
      Validators.pattern(/^[0-9]{6}$/),
    ]],
  });

  /**
   * Set once, right after a successful enableMfa() call — shown exactly
   * once with a "confirm you've saved these" gate, then cleared. The
   * backend never returns these codes again after this point.
   */
  readonly justEnabledBackupCodes = signal<string[] | null>(null);

  // ── Disable flow ─────────────────────────────────────────────────────────

  readonly showDisableForm = signal(false);
  readonly disableLoading = signal(false);
  readonly disableError = signal<string | null>(null);

  readonly disableForm: FormGroup = this.fb.group({
    password: ['', Validators.required],
    totpCode: ['', [
      Validators.required,
      Validators.pattern(/^[0-9]{6}$/),
    ]],
  });

  ngOnInit(): void {
    this.userService.getMe().subscribe({
      next: user => {
        this.mfaEnabled.set(user.mfaEnabled);
        this.loading.set(false);
        if (user.mfaEnabled) {
          this.loadBackupCodesStatus();
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load account security status');
      }
    });
  }

  private loadBackupCodesStatus(): void {
    this.authService.getBackupCodesStatus().subscribe({
      next: status => this.backupCodesStatus.set(status),
      error: () => { /* non-critical — page still works without the count */ }
    });
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  startSetup(): void {
    this.setupLoading.set(true);
    this.setupError.set(null);

    this.authService.setupMfa().subscribe({
      next: async response => {
        this.setupResponse.set(response);
        this.setupLoading.set(false);
        try {
          // Rendered entirely client-side — response.qrUrl embeds the raw
          // TOTP secret and must never be sent to any third-party QR
          // generation service.
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
        this.setupLoading.set(false);
        this.setupError.set(this.humanizeSetupError(err));
      }
    });
  }

  cancelSetup(): void {
    this.setupResponse.set(null);
    this.qrDataUrl.set(null);
    this.enableForm.reset();
    this.setupError.set(null);
    this.enableError.set(null);
  }

  submitEnable(): void {
    if (this.enableForm.invalid) {
      this.enableForm.markAllAsTouched();
      return;
    }

    const { totpCode } = this.enableForm.value as { totpCode: string };

    this.enableLoading.set(true);
    this.enableError.set(null);

    this.authService.enableMfa({ totpCode }).subscribe({
      next: response => {
        this.enableLoading.set(false);
        this.mfaEnabled.set(true);
        this.setupResponse.set(null);
        this.qrDataUrl.set(null);
        this.enableForm.reset();
        this.justEnabledBackupCodes.set(response.backupCodes);
        this.logger.info('MFA enabled');
      },
      error: (err: unknown) => {
        this.enableLoading.set(false);
        this.enableForm.reset();
        this.enableError.set(this.humanizeEnableError(err));
      }
    });
  }

  /** User clicked "I've saved my backup codes" — dismiss the one-time display. */
  confirmBackupCodesSaved(): void {
    this.justEnabledBackupCodes.set(null);
    this.toast.success('Two-factor authentication is now enabled');
    this.loadBackupCodesStatus();
  }

  // ── Disable ──────────────────────────────────────────────────────────────

  openDisableForm(): void {
    this.disableForm.reset();
    this.disableError.set(null);
    this.showDisableForm.set(true);
  }

  cancelDisable(): void {
    this.showDisableForm.set(false);
  }

  submitDisable(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    const { password, totpCode } = this.disableForm.value as {
      password: string;
      totpCode: string;
    };

    this.disableLoading.set(true);
    this.disableError.set(null);

    this.authService.disableMfa({ password, totpCode }).subscribe({
      next: () => {
        this.disableLoading.set(false);
        this.showDisableForm.set(false);
        this.mfaEnabled.set(false);
        this.backupCodesStatus.set(null);
        this.disableForm.reset();
        this.toast.success('Two-factor authentication disabled');
        this.logger.info('MFA disabled');
      },
      error: (err: unknown) => {
        this.disableLoading.set(false);
        this.disableForm.patchValue({ totpCode: '' });
        this.disableError.set(this.humanizeDisableError(err));
      }
    });
  }

  // ── Form error helpers ──────────────────────────────────────────────────

  hasEnableError(errorType: string): boolean {
    const control = this.enableForm.get('totpCode');
    return !!(control?.touched && control?.hasError(errorType));
  }

  hasDisableError(field: string, errorType: string): boolean {
    const control = this.disableForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  private humanizeSetupError(err: unknown): string {
    if (err instanceof ApiError && err.status === 409) {
      return 'MFA is already enabled on this account.';
    }
    return 'Could not start MFA setup. Please try again.';
  }

  private humanizeEnableError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Invalid code. Check your authenticator app and try again.';
      }
      if (err.status === 409) {
        return 'No pending setup found — please restart setup.';
      }
    }
    return 'Could not enable MFA. Please try again.';
  }

  private humanizeDisableError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Invalid password or code.';
      }
      if (err.status === 409) {
        return 'MFA is not currently enabled.';
      }
    }
    return 'Could not disable MFA. Please try again.';
  }
}