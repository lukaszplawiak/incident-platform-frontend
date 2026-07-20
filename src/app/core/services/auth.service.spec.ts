import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { JwtPayload, LoginResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeJwt(payload: JwtPayload): string {
  const header = btoa(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));

  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${body}.fake-signature`;
}

function validToken(): string {
  return makeJwt({
    sub: 'user-abc',
    jti: 'jti-test-123',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    teamIds: ['team-1'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

function tokenExpiringInSeconds(seconds: number): string {
  return makeJwt({
    sub: 'user-abc',
    jti: 'jti-test-456',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    teamIds: [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + seconds,
  });
}

/**
 * Builds a successful LoginResponse (no MFA).
 * Mirrors LoginResponse.success() from auth-service.
 */
function successLoginResponse(accessToken: string): LoginResponse {
  return {
    accessToken,
    refreshToken: 'fake-refresh-token',
    userId: 'user-abc',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    mfaRequired: false,
    mfaToken: null,
    mfaExpiresAt: null,
  };
}

/**
 * Builds an MFA-required LoginResponse.
 * Mirrors LoginResponse.mfaRequired() from auth-service.
 */
function mfaRequiredLoginResponse(): LoginResponse {
  return {
    accessToken: null,
    refreshToken: null,
    userId: null,
    tenantId: null,
    email: null,
    roles: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    mfaRequired: true,
    mfaToken: 'fake-mfa-session-token',
    mfaExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

const LOGIN_URL = `${environment.authApiUrl}/api/v1/auth/login`;
const REFRESH_URL = `${environment.authApiUrl}/api/v1/auth/refresh`;
const LOGOUT_URL = `${environment.authApiUrl}/api/v1/auth/logout`;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: class DummyLogin {} },
          { path: 'forbidden', component: class DummyForbidden {} },
        ]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    // Flush any pending logout requests (fire-and-forget in AuthService)
    httpMock.match(LOGOUT_URL).forEach(req => req.flush(null));
    httpMock.verify();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isAuthenticated
  // ──────────────────────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('returns false when sessionStorage is empty', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true after successful login', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns false after logout', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns false when sessionStorage contains malformed token on startup', () => {
      sessionStorage.setItem(environment.tokenKey, 'not.a.real.jwt');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      });

      const freshService = TestBed.inject(AuthService);

      expect(freshService.isAuthenticated()).toBe(false);
    });

    it('does NOT store tokens when mfaRequired=true', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(mfaRequiredLoginResponse());

      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(environment.tokenKey)).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // currentUser
  // ──────────────────────────────────────────────────────────────────────────

  describe('currentUser', () => {
    it('returns null when not logged in', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('returns decoded payload after login', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      const user = service.currentUser() as JwtPayload;

      expect(user).not.toBeNull();
      expect(user.sub).toBe('user-abc');
      expect(user.tenantId).toBe('acme-corp');
      expect(user.teamIds).toEqual(['team-1']);
    });

    it('returns null after logout', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(service.currentUser()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // tenantId / userId / roles / isAdmin
  // ──────────────────────────────────────────────────────────────────────────

  describe('tenantId', () => {
    it('returns null when not logged in', () => {
      expect(service.tenantId()).toBeNull();
    });

    it('returns tenantId after login', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      expect(service.tenantId()).toBe('acme-corp');
    });
  });

  describe('userId', () => {
    it('returns null when not logged in', () => {
      expect(service.userId()).toBeNull();
    });

    it('returns user id after login', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      expect(service.userId()).toBe('user-abc');
    });
  });

  describe('isAdmin', () => {
    it('returns false when not logged in', () => {
      expect(service.isAdmin()).toBe(false);
    });

    it('returns true when user has ROLE_ADMIN', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      expect(service.isAdmin()).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getToken
  // ──────────────────────────────────────────────────────────────────────────

  describe('getToken', () => {
    it('returns null when not logged in', () => {
      expect(service.getToken()).toBeNull();
    });

    it('returns access token after login', () => {
      const token = validToken();

      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(token));

      expect(service.getToken()).toBe(token);
    });

    it('returns null after logout', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));

      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(service.getToken()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('sends POST to correct URL with X-Tenant-Id header', () => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();

      const req = httpMock.expectOne(LOGIN_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('X-Tenant-Id')).toBe('acme-corp');
      expect(req.request.body).toEqual({
        email: 'user@acme.com',
        password: 'secret',
      });

      req.flush(successLoginResponse(validToken()));
    });

    it('stores access token and refresh token in sessionStorage', () => {
      const token = validToken();

      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(token));

      expect(sessionStorage.getItem(environment.tokenKey)).toBe(token);
      expect(sessionStorage.getItem(environment.refreshTokenKey)).toBe('fake-refresh-token');
    });

    it('returns the LoginResponse', () => {
      const token = validToken();
      const response = successLoginResponse(token);
      let result: LoginResponse | undefined;

      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp')
        .subscribe(res => { result = res; });

      httpMock.expectOne(LOGIN_URL).flush(response);

      expect(result).toEqual(response);
    });

    it('returns mfaRequired response without storing tokens', () => {
      const mfaResponse = mfaRequiredLoginResponse();
      let result: LoginResponse | undefined;

      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp')
        .subscribe(res => { result = res; });

      httpMock.expectOne(LOGIN_URL).flush(mfaResponse);

      expect(result?.mfaRequired).toBe(true);
      expect(result?.mfaToken).toBe('fake-mfa-session-token');
      expect(sessionStorage.getItem(environment.tokenKey)).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    beforeEach(() => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));
    });

    it('clears access token from storage', () => {
      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(sessionStorage.getItem(environment.tokenKey)).toBeNull();
    });

    it('clears refresh token from storage', () => {
      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(sessionStorage.getItem(environment.refreshTokenKey)).toBeNull();
    });

    it('navigates to login', () => {
      const spy = vi.spyOn(router, 'navigate');

      service.logout();
      httpMock.expectOne(LOGOUT_URL).flush(null);

      expect(spy).toHaveBeenCalledWith(['/login']);
    });

    it('calls POST /auth/logout to revoke token server-side', () => {
      service.logout();

      const req = httpMock.expectOne(LOGOUT_URL);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // refresh
  // ──────────────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    beforeEach(() => {
      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(validToken()));
    });

    it('sends POST to refresh URL with refreshToken in body', () => {
      service.refresh().subscribe();

      const req = httpMock.expectOne(REFRESH_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'fake-refresh-token' });
      req.flush({
        accessToken: validToken(),
        refreshToken: 'new-refresh-token',
        accessExpiresAt: new Date().toISOString(),
        refreshExpiresAt: new Date().toISOString(),
      });
    });

    it('stores new tokens after successful refresh', () => {
      const newToken = validToken();

      service.refresh().subscribe();
      httpMock.expectOne(REFRESH_URL).flush({
        accessToken: newToken,
        refreshToken: 'new-refresh-token',
        accessExpiresAt: new Date().toISOString(),
        refreshExpiresAt: new Date().toISOString(),
      });

      expect(sessionStorage.getItem(environment.tokenKey)).toBe(newToken);
      expect(sessionStorage.getItem(environment.refreshTokenKey)).toBe('new-refresh-token');
    });

    it('calls logout when refresh fails', () => {
      const spy = vi.spyOn(router, 'navigate');

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      service.refresh().subscribe({ error: () => { /* expected — refresh token expired, logout triggered */ } });
      httpMock.expectOne(REFRESH_URL).flush(
        { message: 'Refresh token expired' },
        { status: 401, statusText: 'Unauthorized' }
      );

      // logout fires POST /auth/logout then navigates
      httpMock.match(LOGOUT_URL).forEach(req => req.flush(null));
      expect(spy).toHaveBeenCalledWith(['/login']);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // auto logout timer
  // ──────────────────────────────────────────────────────────────────────────

  describe('auto logout', () => {
    it('logs out after inactivity timeout elapses', () => {
      vi.useFakeTimers();

      service.login({ email: 'user@acme.com', password: 'secret' }, 'acme-corp').subscribe();
      httpMock.expectOne(LOGIN_URL).flush(successLoginResponse(
        tokenExpiringInSeconds(3600)
      ));

      const ms = environment.autoLogoutMinutes * 60 * 1000;
      vi.advanceTimersByTime(ms + 500);

      // Flush the logout HTTP call triggered by the timer
      httpMock.match(LOGOUT_URL).forEach(req => req.flush(null));

      expect(service.isAuthenticated()).toBe(false);
    });
  });
});