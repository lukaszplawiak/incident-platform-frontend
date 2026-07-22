import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MfaVerify } from './mfa-verify';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { ApiError } from '../../../core/errors/api-error';

function setup(state: Record<string, unknown> | null = { mfaToken: 'mfa-token-abc', tenantId: 'acme-corp' }) {
  const authServiceMock = {
    verifyMfa: vi.fn().mockReturnValue(of({ accessToken: 't', refreshToken: 'r' })),
    verifyMfaBackup: vi.fn().mockReturnValue(of({ accessToken: 't', refreshToken: 'r' })),
  };
  const idleServiceMock = {
    startWatching: vi.fn(),
  };
  const routerMock = {
    navigate: vi.fn(),
    getCurrentNavigation: vi.fn().mockReturnValue(null),
  };

  if (state) {
    window.history.pushState(state, '');
  } else {
    window.history.pushState({}, '');
  }

  TestBed.configureTestingModule({
    imports: [MfaVerify],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
      { provide: IdleService, useValue: idleServiceMock },
      { provide: Router, useValue: routerMock },
      { provide: ActivatedRoute, useValue: {} },
    ],
  });

  const fixture: ComponentFixture<MfaVerify> = TestBed.createComponent(MfaVerify);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, authServiceMock, idleServiceMock, routerMock };
}

describe('MfaVerify', () => {
  describe('when router state is missing', () => {
    it('redirects to /login', () => {
      const { routerMock } = setup(null);

      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('when router state is present', () => {
    it('should create', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('defaults to the TOTP code form', () => {
      const { component } = setup();
      expect(component.usingBackupCode()).toBe(false);
    });

    it('toggleBackupCode switches to the backup code form and resets both forms', () => {
      const { component } = setup();

      component.mfaForm.setValue({ totpCode: '123456' });
      component.toggleBackupCode();

      expect(component.usingBackupCode()).toBe(true);
      expect(component.mfaForm.value.totpCode).toBeFalsy();
    });

    describe('TOTP submission', () => {
      it('does not submit an invalid code', () => {
        const { component, authServiceMock } = setup();

        component.mfaForm.setValue({ totpCode: '12' });
        component.onSubmit();

        expect(authServiceMock.verifyMfa).not.toHaveBeenCalled();
      });

      it('calls verifyMfa with mfaToken/tenantId from router state, then navigates on success', () => {
        const { component, authServiceMock, idleServiceMock, routerMock } = setup();

        component.mfaForm.setValue({ totpCode: '123456' });
        component.onSubmit();

        expect(authServiceMock.verifyMfa).toHaveBeenCalledWith(
          { mfaToken: 'mfa-token-abc', totpCode: '123456' },
          'acme-corp'
        );
        expect(idleServiceMock.startWatching).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/incidents']);
      });

      it('shows a humanized error on 401 without navigating', () => {
        const { component, routerMock, authServiceMock } = setup();
        authServiceMock.verifyMfa.mockReturnValue(
          throwError(() => new ApiError('Invalid or expired credentials.', 401))
        );

        component.mfaForm.setValue({ totpCode: '123456' });
        component.onSubmit();

        expect(component.error()).toContain('Invalid or expired code');
        expect(routerMock.navigate).not.toHaveBeenCalledWith(['/incidents']);
      });
    });

    describe('backup code submission', () => {
      it('does not submit an invalid backup code', () => {
        const { component, authServiceMock } = setup();

        component.toggleBackupCode();
        component.backupCodeForm.setValue({ backupCode: 'short' });
        component.onSubmit();

        expect(authServiceMock.verifyMfaBackup).not.toHaveBeenCalled();
      });

      it('calls verifyMfaBackup with mfaToken/tenantId, then navigates on success', () => {
        const { component, authServiceMock, routerMock } = setup();

        component.toggleBackupCode();
        component.backupCodeForm.setValue({ backupCode: 'a1b2c3d4' });
        component.onSubmit();

        expect(authServiceMock.verifyMfaBackup).toHaveBeenCalledWith(
          { mfaToken: 'mfa-token-abc', backupCode: 'a1b2c3d4' },
          'acme-corp'
        );
        expect(routerMock.navigate).toHaveBeenCalledWith(['/incidents']);
      });

      it('shows a humanized error on 401 without navigating', () => {
        const { component, routerMock, authServiceMock } = setup();
        authServiceMock.verifyMfaBackup.mockReturnValue(
          throwError(() => new ApiError('Invalid or expired credentials.', 401))
        );

        component.toggleBackupCode();
        component.backupCodeForm.setValue({ backupCode: 'a1b2c3d4' });
        component.onSubmit();

        expect(component.error()).toContain('Invalid or already-used backup code');
        expect(routerMock.navigate).not.toHaveBeenCalledWith(['/incidents']);
      });
    });
  });
});