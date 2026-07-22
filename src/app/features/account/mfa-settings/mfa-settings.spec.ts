import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MfaSettings } from './mfa-settings';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';
import { User } from '../../../core/models/user.model';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_RESPONDER'],
    teamIds: [],
    active: true,
    mfaEnabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup(user: User = buildUser()) {
  const authServiceMock = {
    setupMfa: vi.fn().mockReturnValue(of({ qrUrl: 'otpauth://totp/test', secret: 'JBSWY3DPEHPK3PXP' })),
    enableMfa: vi.fn().mockReturnValue(of({ backupCodes: ['aaaa1111', 'bbbb2222'], message: 'ok' })),
    disableMfa: vi.fn().mockReturnValue(of(undefined)),
    getBackupCodesStatus: vi.fn().mockReturnValue(
      of({ remainingCodes: 8, mfaEnabledAt: '2026-01-01T00:00:00Z' })
    ),
  };
  const userServiceMock = {
    getMe: vi.fn().mockReturnValue(of(user)),
  };
  const toastServiceMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [MfaSettings],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: UserService, useValue: userServiceMock },
      { provide: ToastService, useValue: toastServiceMock },
    ],
  });

  const fixture: ComponentFixture<MfaSettings> = TestBed.createComponent(MfaSettings);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock, userServiceMock, toastServiceMock };
}

describe('MfaSettings', () => {
  it('should create', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  describe('initial load', () => {
    it('sets mfaEnabled from the user profile and does not fetch backup codes status when disabled', () => {
      const { component, authServiceMock } = setup(buildUser({ mfaEnabled: false }));

      expect(component.mfaEnabled()).toBe(false);
      expect(authServiceMock.getBackupCodesStatus).not.toHaveBeenCalled();
    });

    it('fetches backup codes status when MFA is already enabled', () => {
      const { component, authServiceMock } = setup(buildUser({ mfaEnabled: true }));

      expect(component.mfaEnabled()).toBe(true);
      expect(authServiceMock.getBackupCodesStatus).toHaveBeenCalled();
      expect(component.backupCodesStatus()?.remainingCodes).toBe(8);
    });
  });

  describe('setup flow', () => {
    it('calls setupMfa and stores the response', () => {
      const { component, authServiceMock } = setup();

      component.startSetup();

      expect(authServiceMock.setupMfa).toHaveBeenCalled();
      expect(component.setupResponse()?.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('shows a humanized error on 409 (already enabled)', () => {
      const { component, authServiceMock } = setup();
      authServiceMock.setupMfa.mockReturnValue(
        throwError(() => new ApiError('Invalid request. Please check your input.', 409))
      );

      component.startSetup();

      expect(component.setupError()).toContain('already enabled');
    });

    it('cancelSetup clears setup state', () => {
      const { component } = setup();

      component.startSetup();
      component.cancelSetup();

      expect(component.setupResponse()).toBeNull();
      expect(component.qrDataUrl()).toBeNull();
    });
  });

  describe('submitEnable', () => {
    it('does not submit an invalid code', () => {
      const { component, authServiceMock } = setup();

      component.enableForm.setValue({ totpCode: '12' });
      component.submitEnable();

      expect(authServiceMock.enableMfa).not.toHaveBeenCalled();
    });

    it('enables MFA and shows one-time backup codes on success', () => {
      const { component, authServiceMock } = setup();

      component.startSetup();
      component.enableForm.setValue({ totpCode: '123456' });
      component.submitEnable();

      expect(authServiceMock.enableMfa).toHaveBeenCalledWith({ totpCode: '123456' });
      expect(component.mfaEnabled()).toBe(true);
      expect(component.justEnabledBackupCodes()).toEqual(['aaaa1111', 'bbbb2222']);
      expect(component.setupResponse()).toBeNull();
    });

    it('shows a humanized error on 401 (invalid code)', () => {
      const { component, authServiceMock } = setup();
      authServiceMock.enableMfa.mockReturnValue(
        throwError(() => new ApiError('Invalid or expired credentials.', 401))
      );

      component.enableForm.setValue({ totpCode: '123456' });
      component.submitEnable();

      expect(component.enableError()).toContain('Invalid code');
      expect(component.mfaEnabled()).toBe(false);
    });

    it('confirmBackupCodesSaved dismisses the codes and reloads status', () => {
      const { component, authServiceMock, toastServiceMock } = setup();

      component.startSetup();
      component.enableForm.setValue({ totpCode: '123456' });
      component.submitEnable();
      component.confirmBackupCodesSaved();

      expect(component.justEnabledBackupCodes()).toBeNull();
      expect(toastServiceMock.success).toHaveBeenCalled();
      expect(authServiceMock.getBackupCodesStatus).toHaveBeenCalled();
    });
  });

  describe('submitDisable', () => {
    it('does not submit an invalid form', () => {
      const { component, authServiceMock } = setup(buildUser({ mfaEnabled: true }));

      component.disableForm.setValue({ password: '', totpCode: '' });
      component.submitDisable();

      expect(authServiceMock.disableMfa).not.toHaveBeenCalled();
    });

    it('disables MFA on success', () => {
      const { component, authServiceMock, toastServiceMock } = setup(buildUser({ mfaEnabled: true }));

      component.disableForm.setValue({ password: 'secret', totpCode: '123456' });
      component.submitDisable();

      expect(authServiceMock.disableMfa).toHaveBeenCalledWith({
        password: 'secret',
        totpCode: '123456',
      });
      expect(component.mfaEnabled()).toBe(false);
      expect(component.showDisableForm()).toBe(false);
      expect(toastServiceMock.success).toHaveBeenCalled();
    });

    it('shows a humanized error on 401 (invalid password or code)', () => {
      const { component, authServiceMock } = setup(buildUser({ mfaEnabled: true }));
      authServiceMock.disableMfa.mockReturnValue(
        throwError(() => new ApiError('Invalid or expired credentials.', 401))
      );

      component.disableForm.setValue({ password: 'wrong', totpCode: '123456' });
      component.submitDisable();

      expect(component.disableError()).toContain('Invalid password or code');
      expect(component.mfaEnabled()).toBe(true);
    });
  });
});