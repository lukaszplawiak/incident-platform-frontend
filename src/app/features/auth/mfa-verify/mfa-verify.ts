import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ApiError } from '../../../core/errors/api-error';

/**
 * MFA verification screen — shown after login when mfaRequired=true.
 *
 * Receives mfaToken and tenantId via Router navigation state
 * (not URL params — tokens must not appear in browser history).
 *
 * If the state is missing (direct navigation or page refresh),
 * redirects back to login.
 */
@Component({
  selector: 'app-mfa-verify',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './mfa-verify.html',
  styleUrl: './mfa-verify.scss'
})
export class MfaVerify implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly idleService = inject(IdleService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly logger = inject(LoggerService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private mfaToken = '';
  private tenantId = '';

  readonly mfaForm: FormGroup = this.fb.group({
    totpCode: ['', [
      Validators.required,
      Validators.pattern(/^\d{6}$/),
    ]],
  });

  ngOnInit(): void {
    // Router state is available only on the first render after navigation.
    // On page refresh, state is lost — redirect to login.
    const state = this.router.getCurrentNavigation()?.extras.state
      ?? history.state;

    if (!state?.['mfaToken'] || !state?.['tenantId']) {
      this.logger.warn('MFA screen accessed without state — redirecting to login');
      this.router.navigate(['/login']);
      return;
    }

    this.mfaToken = state['mfaToken'] as string;
    this.tenantId = state['tenantId'] as string;
  }

  onSubmit(): void {
    if (this.mfaForm.invalid) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { totpCode } = this.mfaForm.value as { totpCode: string };

    this.authService.verifyMfa(
      { mfaToken: this.mfaToken, totpCode },
      this.tenantId
    ).subscribe({
      next: () => {
        this.loading.set(false);
        this.logger.info('MFA verification successful');
        this.idleService.startWatching();
        this.router.navigate(['/incidents']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.mfaForm.get('totpCode')?.reset();
        this.error.set(this.humanizeError(err));
        this.logger.warn('MFA verification failed', { message: err.message });
      }
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.mfaForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  private humanizeError(err: Error): string {
    // See login.ts for why this branches on ApiError.status rather than
    // matching substrings — the interceptor's translated messages never
    // contain the raw status code.
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Invalid or expired code. Please check your authenticator app and try again.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Verification failed. Please try again.';
  }
}