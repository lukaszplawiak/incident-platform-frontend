import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { LoginResponse } from '../../../core/models/auth.model';
import { ApiError } from '../../../core/errors/api-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  private readonly authService = inject(AuthService);
  private readonly idleService = inject(IdleService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly logger = inject(LoggerService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [
      Validators.required,
      Validators.email,
      Validators.maxLength(254),
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(128),
    ]],
    tenantId: ['default', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(50),
    ]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password, tenantId } = this.loginForm.value as {
      email: string;
      password: string;
      tenantId: string;
    };

    this.logger.info('Login attempt initiated');

    this.authService.login({ email, password }, tenantId).subscribe({
      next: (response: LoginResponse) => {
        this.loading.set(false);

        if (response.mfaRequired && response.mfaToken) {
          // MFA step required — navigate to MFA verify screen.
          // Pass mfaToken and tenantId via router state (not URL — tokens
          // must not appear in browser history or server logs).
          this.logger.info('MFA required — redirecting to verify screen');
          this.router.navigate(['/auth/mfa'], {
            state: {
              mfaToken: response.mfaToken,
              tenantId,
            }
          });
          return;
        }

        // Single-factor login succeeded — tokens stored by AuthService.login()
        this.logger.info('Login successful');
        this.idleService.startWatching();

        const redirectUrl = this.getSafeRedirectUrl();
        this.router.navigateByUrl(redirectUrl);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(this.humanizeError(err));
        this.logger.warn('Login failed', { message: err.message });
      }
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  private getSafeRedirectUrl(): string {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    return '/incidents';
  }

  private humanizeError(err: Error): string {
    // The error interceptor throws an ApiError, which preserves the real
    // HTTP status code — branch on that directly rather than matching
    // substrings against translated UI copy (the previous approach here
    // never actually matched anything, since the interceptor's messages
    // don't contain the numeric status).
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Invalid email or password. Please try again.';
      }
      if (err.status === 423) {
        return 'Account locked due to too many failed attempts. Please try again later.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Login failed. Please try again.';
  }
}