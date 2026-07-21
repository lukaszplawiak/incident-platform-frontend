import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ResetPassword } from './reset-password';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';

function setup(token: string | null) {
  const authServiceMock = {
    resetPassword: vi.fn().mockReturnValue(of(undefined)),
  };
  const toastServiceMock = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const routerMock = {
    navigate: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [ResetPassword],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: ToastService, useValue: toastServiceMock },
      { provide: Router, useValue: routerMock },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(token ? { token } : {}),
          },
        },
      },
    ],
  });

  const fixture: ComponentFixture<ResetPassword> = TestBed.createComponent(ResetPassword);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock, toastServiceMock, routerMock };
}

describe('ResetPassword', () => {
  it('should create', () => {
    const { component } = setup('valid-token');
    expect(component).toBeTruthy();
  });

  describe('when the token query param is missing', () => {
    it('sets tokenMissing to true and does not call resetPassword on submit', () => {
      const { component, authServiceMock } = setup(null);

      expect(component.tokenMissing).toBe(true);

      component.onSubmit();

      expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('when the token query param is present', () => {
    it('sets tokenMissing to false', () => {
      const { component } = setup('valid-token');
      expect(component.tokenMissing).toBe(false);
    });

    it('does not submit when passwords do not match', () => {
      const { component, authServiceMock } = setup('valid-token');

      component.resetPasswordForm.setValue({
        newPassword: 'a-secure-password',
        confirmPassword: 'a-different-password',
      });
      component.onSubmit();

      expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
      expect(component.resetPasswordForm.hasError('passwordsMismatch')).toBe(true);
    });

    it('does not submit when password is shorter than 8 characters', () => {
      const { component, authServiceMock } = setup('valid-token');

      component.resetPasswordForm.setValue({ newPassword: 'short1', confirmPassword: 'short1' });
      component.onSubmit();

      expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
    });

    it('calls resetPassword with token and newPassword, then navigates to /login on success', () => {
      const { component, authServiceMock, toastServiceMock, routerMock } = setup('valid-token');

      component.resetPasswordForm.setValue({
        newPassword: 'a-secure-password',
        confirmPassword: 'a-secure-password',
      });
      component.onSubmit();

      expect(authServiceMock.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'a-secure-password',
      });
      expect(toastServiceMock.success).toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('shows an invalid-link message on 401 without navigating', () => {
      const { component, authServiceMock, routerMock } = setup('valid-token');
      authServiceMock.resetPassword.mockReturnValue(
        throwError(() => new ApiError('Invalid or expired credentials.', 401))
      );

      component.resetPasswordForm.setValue({
        newPassword: 'a-secure-password',
        confirmPassword: 'a-secure-password',
      });
      component.onSubmit();

      expect(component.error()).toContain('invalid, has expired, or has already been used');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });
});