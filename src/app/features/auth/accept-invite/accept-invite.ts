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
 * Accept-invite screen — reached via the link in the invite email sent by
 * auth-service (AuthEmailOutbox, email_type=INVITE).
 *
 * Unlike mfa-verify, the token here travels through email and must survive
 * as a URL query parameter (?token=...) rather than router navigation
 * state — there is no in-app navigation to carry state from; the user is
 * arriving fresh from their inbox, possibly in a new browser or tab with
 * no prior session at all.
 *
 * Consequently, a missing or malformed token is a real, user-facing error
 * condition (stale link, forwarded email, copy-paste mistake) rather than
 * an internal misuse of the route the way it is for mfa-verify. We show an
 * inline explanation instead of silently redirecting to /login.
 */
@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './accept-invite.html',
  styleUrl: './accept-invite.scss',
})
export class AcceptInvite {

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

  /** True when the link is missing or malformed — no form is rendered. */
  readonly tokenMissing = this.token === null || this.token.trim() === '';

  readonly acceptInviteForm: FormGroup = this.fb.group(
    {
      password: ['', [
        Validators.required,
        // Mirrors AcceptInviteRequest's @Size(min = 12) in auth-service.
        // Intentionally stricter than reset-password's min. 8 — accepting
        // an invite sets the very first credential for the account.
        Validators.minLength(12),
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
      this.logger.warn('Accept-invite screen reached without a token');
    }
  }

  onSubmit(): void {
    if (this.tokenMissing || !this.token) {
      return;
    }

    if (this.acceptInviteForm.invalid) {
      this.acceptInviteForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { password } = this.acceptInviteForm.value as {
      password: string;
      confirmPassword: string;
    };

    this.authService.acceptInvite({ token: this.token, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.logger.info('Invite accepted — password set');
        // ToastService is app-root-level and survives navigation, so this
        // is still visible on the login screen after the redirect below —
        // same pattern used across the admin panels for success feedback.
        this.toast.success('Password set. You can now log in.');
        this.router.navigate(['/login']);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.acceptInviteForm.reset();
        this.error.set(this.humanizeError(err));
        this.logger.warn('Accept-invite failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.acceptInviteForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  hasMismatchError(): boolean {
    const confirmControl = this.acceptInviteForm.get('confirmPassword');
    return !!(
      confirmControl?.touched &&
      this.acceptInviteForm.hasError('passwordsMismatch')
    );
  }

  private humanizeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        // Matches InviteService.acceptInvite() in auth-service, which
        // collapses "invalid", "expired", and "already used" into a
        // single 401 — there's no finer-grained code to branch on.
        return 'This invite link is invalid, has expired, or has already been used. Ask an administrator to resend your invite.';
      }
      if (err.status === 400) {
        return 'Please check your password meets the requirements.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Could not set your password. Please try again.';
  }
}

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordsMismatch: true };
}