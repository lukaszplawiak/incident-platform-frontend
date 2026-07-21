import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AcceptInvite } from './accept-invite';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';

function setup(token: string | null) {
  const authServiceMock = {
    acceptInvite: vi.fn().mockReturnValue(of(undefined)),
  };
  const toastServiceMock = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const routerMock = {
    navigate: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [AcceptInvite],
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

  const fixture: ComponentFixture<AcceptInvite> = TestBed.createComponent(AcceptInvite);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock, toastServiceMock, routerMock };
}

describe('AcceptInvite', () => {
  it('should create', () => {
    const { component } = setup('valid-token');
    expect(component).toBeTruthy();
  });

  describe('when the token query param is missing', () => {
    it('sets tokenMissing to true and does not call acceptInvite on submit', () => {
      const { component, authServiceMock } = setup(null);

      expect(component.tokenMissing).toBe(true);

      component.onSubmit();

      expect(authServiceMock.acceptInvite).not.toHaveBeenCalled();
    });
  });

  describe('when the token query param is present', () => {
    it('sets tokenMissing to false', () => {
      const { component } = setup('valid-token');
      expect(component.tokenMissing).toBe(false);
    });

    it('does not submit when passwords do not match', () => {
      const { component, authServiceMock } = setup('valid-token');

      component.acceptInviteForm.setValue({
        password: 'a-secure-password-123',
        confirmPassword: 'a-different-password',
      });
      component.onSubmit();

      expect(authServiceMock.acceptInvite).not.toHaveBeenCalled();
      expect(component.acceptInviteForm.hasError('passwordsMismatch')).toBe(true);
    });

    it('does not submit when password is shorter than 12 characters', () => {
      const { component, authServiceMock } = setup('valid-token');

      component.acceptInviteForm.setValue({
        password: 'short1',
        confirmPassword: 'short1',
      });
      component.onSubmit();

      expect(authServiceMock.acceptInvite).not.toHaveBeenCalled();
    });

    it('calls acceptInvite with the token and password, then navigates to /login on success', () => {
      const { component, authServiceMock, toastServiceMock, routerMock } = setup('valid-token');

      component.acceptInviteForm.setValue({
        password: 'a-secure-password-123',
        confirmPassword: 'a-secure-password-123',
      });
      component.onSubmit();

      expect(authServiceMock.acceptInvite).toHaveBeenCalledWith({
        token: 'valid-token',
        password: 'a-secure-password-123',
      });
      expect(toastServiceMock.success).toHaveBeenCalledWith('Password set. You can now log in.');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('shows an invalid-link message on 401 without navigating', () => {
      const { component, authServiceMock, routerMock } = setup('valid-token');
      authServiceMock.acceptInvite.mockReturnValue(
        throwError(() => new ApiError('Invalid or expired credentials.', 401))
      );

      component.acceptInviteForm.setValue({
        password: 'a-secure-password-123',
        confirmPassword: 'a-secure-password-123',
      });
      component.onSubmit();

      expect(component.error()).toContain('invalid, has expired, or has already been used');
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });
});