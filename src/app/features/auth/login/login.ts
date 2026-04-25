import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly logger = inject(LoggerService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginForm: FormGroup = this.fb.group({
    userId: ['user-1', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(50)
    ]],
    tenantId: ['acme-corp', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(50)
    ]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { userId, tenantId } = this.loginForm.value as {
      userId: string;
      tenantId: string;
    };

    this.logger.info('Login attempt initiated');

    this.authService.login(userId, tenantId).subscribe({
      next: () => {
        this.loading.set(false);
        this.logger.info('Login successful');

        const redirectUrl = this.getSafeRedirectUrl();
        this.router.navigateByUrl(redirectUrl);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
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
}