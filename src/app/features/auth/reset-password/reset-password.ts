import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';

/**
 * Reset-password screen — reached via the link in the password-reset
 * email (POST /api/v1/auth/reset-password). Structurally almost identical
 * to AcceptInvite — see that component for the reasoning behind reading
 * the token from the query string and showing an inline (not redirected)
 * error when it's missing.
 *
 * Two differences worth calling out:
 *
 * 1. Password minimum length is 8 here, not 12. That mirrors
 *    ResetPasswordRequest's @Size(min = 8) in auth-service exactly — it's
 *    a genuine inconsistency between the two backend DTOs (AcceptInvite
 *    requires 12, since it sets the very first credential for a brand-new
 *    account), not a copy-paste mistake on the frontend. The frontend
 *    must match whatever each endpoint actually enforces.
 *
 * 2. No tenantId is sent. AuthController.resetPassword accepts an
 *    X-Tenant-Id header, but PasswordService.resetPassword() never
 *    actually reads the tenantId parameter it's given — the reset token
 *    alone identifies the user. Sending a tenant field here would ask the
 *    user for information the backend doesn't use.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly token: string | null =
    this.route.snapshot.queryParamMap.get('token');

  readonly tokenMissing = this.token === null || this.token.trim() === '';

  readonly resetPasswordForm: FormGroup = this.fb.group(
    {
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
      ]],
      confirmPassword: ['', [
        Validators.required,
      ]],
    },
    { validators: [passwordsMatchValidator] }
  );

  constructor() {
    if (this.tokenMissing) {
      this.logger.warn('Reset-password screen reached without a token');
    }
  }

  onSubmit(): void {
    if (this.tokenMissing || !this.token) {
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { newPassword } = this.resetPasswordForm.value as {
      newPassword: string;
      confirmPassword: string;
    };

    this.authService.resetPassword({ token: this.token, newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.logger.info('Password reset — all sessions invalidated');
        this.toast.success(
          'Password reset. You have been logged out of all devices — please log in again.'
        );
        this.router.navigate(['/login']);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.resetPasswordForm.reset();
        this.error.set(this.humanizeError(err));
        this.logger.warn('Reset-password failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.resetPasswordForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  hasMismatchError(): boolean {
    const confirmControl = this.resetPasswordForm.get('confirmPassword');
    return !!(
      confirmControl?.touched &&
      this.resetPasswordForm.hasError('passwordsMismatch')
    );
  }

  private humanizeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'This reset link is invalid, has expired, or has already been used.';
      }
      if (err.status === 400) {
        return 'Please check your password meets the requirements.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Could not reset your password. Please try again.';
  }
}

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordsMismatch: true };
}