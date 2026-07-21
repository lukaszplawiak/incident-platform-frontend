import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ForgotPassword } from './forgot-password';
import { AuthService } from '../../../core/services/auth.service';
import { ApiError } from '../../../core/errors/api-error';

function setup() {
  const authServiceMock = {
    forgotPassword: vi.fn().mockReturnValue(of(undefined)),
  };

  TestBed.configureTestingModule({
    imports: [ForgotPassword],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authServiceMock },
    ],
  });

  const fixture: ComponentFixture<ForgotPassword> = TestBed.createComponent(ForgotPassword);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock };
}

describe('ForgotPassword', () => {
  it('should create', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('does not submit an invalid form', () => {
    const { component, authServiceMock } = setup();

    component.forgotPasswordForm.setValue({ email: 'not-an-email', tenantId: 'acme' });
    component.onSubmit();

    expect(authServiceMock.forgotPassword).not.toHaveBeenCalled();
  });

  it('calls forgotPassword with email and tenantId, then shows the success state', () => {
    const { component, authServiceMock } = setup();

    component.forgotPasswordForm.setValue({ email: 'user@acme.com', tenantId: 'acme-corp' });
    component.onSubmit();

    expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(
      { email: 'user@acme.com' },
      'acme-corp'
    );
    expect(component.submitted()).toBe(true);
  });

  it('shows the same success state regardless of whether the account exists', () => {
    // The backend always returns 202 for both cases (enumeration
    // protection) — this test documents that the component has no code
    // path that could distinguish them.
    const { component } = setup();

    component.forgotPasswordForm.setValue({ email: 'unknown@acme.com', tenantId: 'acme-corp' });
    component.onSubmit();

    expect(component.submitted()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('shows a rate-limit message on 429 without setting submitted', () => {
    const { component, authServiceMock } = setup();
    authServiceMock.forgotPassword.mockReturnValue(
      throwError(() => new ApiError('Too many requests. Please wait a moment and try again.', 429))
    );

    component.forgotPasswordForm.setValue({ email: 'user@acme.com', tenantId: 'acme-corp' });
    component.onSubmit();

    expect(component.submitted()).toBe(false);
    expect(component.error()).toContain('Too many requests');
  });
});