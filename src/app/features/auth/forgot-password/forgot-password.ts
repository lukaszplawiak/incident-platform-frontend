import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ApiError } from '../../../core/errors/api-error';

/**
 * Forgot-password screen — POST /api/v1/auth/forgot-password.
 *
 * auth-service always returns 202 Accepted here, whether or not the email
 * has an account (user enumeration protection, layer 1 — see
 * ForgotPasswordService.initiateReset on the backend). This component
 * mirrors that at the UI layer: there is exactly one success state,
 * regardless of what the backend actually did. Never introduce a
 * client-side branch like "email not found" here — that would defeat the
 * server-side protection.
 *
 * tenantId is required (unlike reset-password) because
 * ForgotPasswordService looks the user up by email *and* tenantId — the
 * same email can exist in more than one tenant. Mirrors login.ts's field
 * set for the same reason.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {

  private readonly authService = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** True once a request has been submitted successfully — replaces the form. */
  readonly submitted = signal(false);

  readonly forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [
      Validators.required,
      Validators.email,
      Validators.maxLength(254),
    ]],
    tenantId: ['default', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(50),
    ]],
  });

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, tenantId } = this.forgotPasswordForm.value as {
      email: string;
      tenantId: string;
    };

    this.authService.forgotPassword({ email }, tenantId).subscribe({
      next: () => {
        this.loading.set(false);
        this.logger.info('Password reset requested');
        // Always the same success state — see class doc. Do not vary this
        // based on anything the backend might (or might not) tell us.
        this.submitted.set(true);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.humanizeError(err));
        this.logger.warn('Forgot-password request failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.forgotPasswordForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  private humanizeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 400) {
        return 'Please enter a valid email address.';
      }
      if (err.status === 429) {
        return 'Too many requests. Please wait a moment before trying again.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Something went wrong. Please try again.';
  }
}