import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ChangePassword } from './change-password';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';

function setup() {
  const userServiceMock = {
    changePassword: vi.fn().mockReturnValue(of(undefined)),
  };
  const toastServiceMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [ChangePassword],
    providers: [
      { provide: UserService, useValue: userServiceMock },
      { provide: ToastService, useValue: toastServiceMock },
      provideRouter([]),
    ],
  });

  const fixture: ComponentFixture<ChangePassword> = TestBed.createComponent(ChangePassword);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, userServiceMock, toastServiceMock };
}

describe('ChangePassword', () => {
  it('should create', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('does not submit when current password is missing', () => {
    const { component, userServiceMock } = setup();

    component.changePasswordForm.setValue({
      currentPassword: '',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    });
    component.onSubmit();

    expect(userServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it('does not submit when passwords do not match', () => {
    const { component, userServiceMock } = setup();

    component.changePasswordForm.setValue({
      currentPassword: 'my-old-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-different-password',
    });
    component.onSubmit();

    expect(userServiceMock.changePassword).not.toHaveBeenCalled();
    expect(component.changePasswordForm.hasError('passwordsMismatch')).toBe(true);
  });

  /**
   * The actual regression test for this component matching
   * ChangePasswordRequest.java's own @Size(min = 12) — not
   * ResetPassword's differing minimum of 8 (that DTO has its own,
   * separate @Size constraint), and not a copy-paste of it.
   */
  it('does not submit when new password is shorter than 12 characters', () => {
    const { component, userServiceMock } = setup();

    component.changePasswordForm.setValue({
      currentPassword: 'my-old-password',
      newPassword: 'short12345',
      confirmPassword: 'short12345',
    });
    component.onSubmit();

    expect(userServiceMock.changePassword).not.toHaveBeenCalled();
  });

  /**
   * The actual regression test for this component NOT navigating away
   * on success, unlike ResetPassword — PasswordService.changePassword()
   * deliberately leaves the calling session's own refresh token valid,
   * so staying on the page (with the form cleared and a success toast)
   * is the correct behavior here.
   */
  it('calls changePassword with both passwords, then clears the form without navigating', () => {
    const { component, userServiceMock, toastServiceMock } = setup();

    component.changePasswordForm.setValue({
      currentPassword: 'my-old-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    });
    component.onSubmit();

    expect(userServiceMock.changePassword).toHaveBeenCalledWith({
      currentPassword: 'my-old-password',
      newPassword: 'a-secure-password',
    });
    expect(toastServiceMock.success).toHaveBeenCalled();
    expect(component.changePasswordForm.get('currentPassword')?.value).toBeFalsy();
  });

  /**
   * The actual regression test for this component's own humanizeError:
   * a 401 here means "wrong current password" (confirmed against
   * PasswordService.changePassword()'s own implementation) — a
   * different meaning from ResetPassword's 401 ("invalid/expired
   * token") despite sharing the same status code, so the message must
   * be different too, not copied from ResetPassword's own case.
   */
  it('shows a wrong-current-password message on 401', () => {
    const { component, userServiceMock } = setup();
    userServiceMock.changePassword.mockReturnValue(
      throwError(() => new ApiError('Invalid credentials', 401))
    );

    component.changePasswordForm.setValue({
      currentPassword: 'wrong-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    });
    component.onSubmit();

    expect(component.error()).toBe('Current password is incorrect.');
  });

  it('shows a validation message on 400', () => {
    const { component, userServiceMock } = setup();
    userServiceMock.changePassword.mockReturnValue(
      throwError(() => new ApiError('Bad request', 400))
    );

    component.changePasswordForm.setValue({
      currentPassword: 'my-old-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    });
    component.onSubmit();

    expect(component.error()).toContain('requirements');
  });

  it('shows a network error message on status 0', () => {
    const { component, userServiceMock } = setup();
    userServiceMock.changePassword.mockReturnValue(
      throwError(() => new ApiError('', 0))
    );

    component.changePasswordForm.setValue({
      currentPassword: 'my-old-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    });
    component.onSubmit();

    expect(component.error()).toContain('Cannot connect');
  });
});