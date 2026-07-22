import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MfaSetupRequired } from './mfa-setup-required';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { ApiError } from '../../../core/errors/api-error';

function setup(state: Record<string, unknown> | null = { mfaSetupToken: 'raw-setup-token' }) {
  const authServiceMock = {
    setupMfaRequired: vi.fn().mockReturnValue(
      of({ qrUrl: 'otpauth://totp/test', secret: 'JBSWY3DPEHPK3PXP' })
    ),
    completeMfaSetupRequired: vi.fn().mockReturnValue(
      of({ backupCodes: ['aaaa1111', 'bbbb2222'], login: { accessToken: 't', refreshToken: 'r' } })
    ),
  };
  const idleServiceMock = {
    startWatching: vi.fn(),
  };
  const routerMock = {
    navigate: vi.fn(),
    getCurrentNavigation: vi.fn().mockReturnValue(null),
  };

  window.history.pushState(state ?? {}, '');

  TestBed.configureTestingModule({
    imports: [MfaSetupRequired],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: IdleService, useValue: idleServiceMock },
      { provide: Router, useValue: routerMock },
    ],
  });

  const fixture: ComponentFixture<MfaSetupRequired> = TestBed.createComponent(MfaSetupRequired);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock, idleServiceMock, routerMock };
}

describe('MfaSetupRequired', () => {
  describe('when router state is missing', () => {
    it('redirects to /login without calling setupMfaRequired', () => {
      const { routerMock, authServiceMock } = setup(null);

      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
      expect(authServiceMock.setupMfaRequired).not.toHaveBeenCalled();
    });
  });

  describe('when router state is present', () => {
    it('should create and immediately calls setupMfaRequired with the token', () => {
      const { component, authServiceMock } = setup();

      expect(component).toBeTruthy();
      expect(authServiceMock.setupMfaRequired).toHaveBeenCalledWith({
        mfaSetupToken: 'raw-setup-token',
      });
      expect(component.setupResponse()?.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('shows a humanized error when setup fails', () => {
      const { component, authServiceMock } = setup();
      authServiceMock.setupMfaRequired.mockReturnValue(
        throwError(() => new ApiError('Invalid or expired credentials.', 401))
      );

      component.ngOnInit();

      expect(component.error()).toContain('expired');
    });

    describe('submitEnable', () => {
      it('does not submit an invalid code', () => {
        const { component, authServiceMock } = setup();

        component.enableForm.setValue({ totpCode: '12' });
        component.submitEnable();

        expect(authServiceMock.completeMfaSetupRequired).not.toHaveBeenCalled();
      });

      it('calls completeMfaSetupRequired and shows one-time backup codes on success', () => {
        const { component, authServiceMock } = setup();

        component.enableForm.setValue({ totpCode: '123456' });
        component.submitEnable();

        expect(authServiceMock.completeMfaSetupRequired).toHaveBeenCalledWith({
          mfaSetupToken: 'raw-setup-token',
          totpCode: '123456',
        });
        expect(component.justEnabledBackupCodes()).toEqual(['aaaa1111', 'bbbb2222']);
      });

      it('shows a humanized error on 401 without setting backup codes', () => {
        const { component, authServiceMock } = setup();
        authServiceMock.completeMfaSetupRequired.mockReturnValue(
          throwError(() => new ApiError('Invalid or expired credentials.', 401))
        );

        component.enableForm.setValue({ totpCode: '123456' });
        component.submitEnable();

        expect(component.enableError()).toContain('Invalid code');
        expect(component.justEnabledBackupCodes()).toBeNull();
      });
    });

    describe('continueToApp', () => {
      it('starts idle watching and navigates to /incidents', () => {
        const { component, idleServiceMock, routerMock } = setup();

        component.continueToApp();

        expect(idleServiceMock.startWatching).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/incidents']);
      });
    });
  });
});