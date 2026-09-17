import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';

/**
 * Account security page — self-service password change.
 *
 * Route uses authGuard, not adminGuard: every user manages their own
 * password, this has nothing to do with the ROLE_ADMIN/ROLE_RESPONDER
 * distinction — matches mfa-settings.ts's own routing rationale exactly
 * (the endpoint this calls has no @PreAuthorize at all on the backend).
 *
 * Kept as a separate component/route from mfa-settings rather than a
 * second section on that same page: mfa-settings.ts/.html were already
 * ~450 lines for MFA alone, and mixing two unrelated account-security
 * concerns into one file would have made an already-large component
 * harder to follow. Linked from/to mfa-settings instead — see both
 * templates' own "Account Security" navigation links.
 *
 * Structurally close to ResetPassword (same password-confirmation
 * validator, same humanizeError-per-status-code pattern). Two
 * differences worth calling out:
 *  - This form has a currentPassword field — ResetPassword's token
 *    already proves identity on its own, so it has none.
 *  - This does NOT navigate to /login on success.
 *    PasswordService.changePassword() deliberately leaves the calling
 *    session's own refresh token valid (see that method's own
 *    comment), only invalidating every *other* session — staying
 *    logged in here is correct, not an oversight.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {

  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly changePasswordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      // min 12 — mirrors ChangePasswordRequest.java's own @Size(min = 12)
      // exactly, not AcceptInvite/ResetPassword's differing minimums
      // (verified against that DTO, not assumed to match either one).
      newPassword: ['', [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
      ]],
      confirmPassword: ['', [
        Validators.required,
      ]],
    },
    { validators: [passwordsMatchValidator] }
  );

  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { currentPassword, newPassword } = this.changePasswordForm.value as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    this.userService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.changePasswordForm.reset();
        this.logger.info('Password changed — other sessions invalidated');
        this.toast.success(
          'Password changed. You have been logged out of all other devices.'
        );
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.humanizeError(err));
        this.logger.warn('Change-password failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      },
    });
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.changePasswordForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  hasMismatchError(): boolean {
    const confirmControl = this.changePasswordForm.get('confirmPassword');
    return !!(
      confirmControl?.touched &&
      this.changePasswordForm.hasError('passwordsMismatch')
    );
  }

  /**
   * 401 here means "wrong current password" — confirmed directly
   * against PasswordService.changePassword()'s own implementation
   * (BusinessException with ErrorCodes.UNAUTHORIZED when
   * passwordEncoder.matches() fails), not ResetPassword's 401 meaning
   * ("invalid/expired/used token") despite the shared status code.
   */
  private humanizeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return 'Current password is incorrect.';
      }
      if (err.status === 400) {
        return 'Please check your new password meets the requirements.';
      }
      if (err.status === 0) {
        return 'Cannot connect to the server. Check your network connection.';
      }
    }
    return 'Could not change your password. Please try again.';
  }
}

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordsMismatch: true };
}