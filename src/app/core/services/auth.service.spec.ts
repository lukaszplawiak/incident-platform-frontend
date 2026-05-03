import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeJwt(payload: object): string {
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
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

function expiredToken(): string {
  return makeJwt({
    sub: 'user-abc',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
}

function tokenExpiringInSeconds(seconds: number): string {
  return makeJwt({
    sub: 'user-abc',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + seconds,
  });
}

function matchAuthUrl() {
  return (req: any) => req.url === `${environment.authApiUrl}/dev/token`;
}

// ─── Helper —────────────────────────────────────────────────────────────────── 

function createServiceWithToken(token: string): AuthService {
  sessionStorage.setItem(environment.tokenKey, token);
  return TestBed.inject(AuthService);
}

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
          { path: 'login', component: class DummyLogin {} as any },
          { path: 'forbidden', component: class DummyForbidden {} as any },
        ]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isAuthenticated
  // ──────────────────────────────────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('returns false when sessionStorage is empty on startup', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true after successful login with valid token', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns false after logout', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      service.logout();

      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns false for malformed token in sessionStorage', () => {
      sessionStorage.setItem(environment.tokenKey, 'not-a-jwt');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // currentUser
  // ──────────────────────────────────────────────────────────────────────────

  describe('currentUser', () => {
    it('returns null when not logged in', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('returns decoded JWT payload after login', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      const user = service.currentUser();
      expect(user).not.toBeNull();
      expect(user!.sub).toBe('user-abc');
      expect(user!.tenantId).toBe('acme-corp');
      expect(user!.roles).toContain('ROLE_ADMIN');
    });

    it('returns null after logout', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      service.logout();

      expect(service.currentUser()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // tenantId
  // ──────────────────────────────────────────────────────────────────────────

  describe('tenantId', () => {
    it('returns null when not logged in', () => {
      expect(service.tenantId()).toBeNull();
    });

    it('returns tenantId extracted from token after login', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      expect(service.tenantId()).toBe('acme-corp');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // userId
  // ──────────────────────────────────────────────────────────────────────────

  describe('userId', () => {
    it('returns null when not logged in', () => {
      expect(service.userId()).toBeNull();
    });

    it('returns sub field from token after login', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      expect(service.userId()).toBe('user-abc');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getToken
  // ──────────────────────────────────────────────────────────────────────────

  describe('getToken', () => {
    it('returns null when not logged in', () => {
      expect(service.getToken()).toBeNull();
    });

    it('returns the raw JWT string after login', () => {
      const token = validToken();
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token });

      expect(service.getToken()).toBe(token);
    });

    it('returns null after logout', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      service.logout();

      expect(service.getToken()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('sends GET request to /dev/token with correct query params', () => {
      service.login('user-abc', 'acme-corp').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === `${environment.authApiUrl}/dev/token` &&
          r.method === 'GET' &&
          r.params.get('userId') === 'user-abc' &&
          r.params.get('tenantId') === 'acme-corp'
      );

      req.flush({ token: validToken() });
    });

    it('stores token in sessionStorage on success', () => {
      const token = validToken();
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token });

      expect(sessionStorage.getItem(environment.tokenKey)).toBe(token);
    });

    it('updates isAuthenticated signal to true on success', () => {
      expect(service.isAuthenticated()).toBe(false);

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns an Observable that emits the AuthResponse', () => {
      const token = validToken();
      let received: any;

      service.login('user-abc', 'acme-corp').subscribe((res) => (received = res));
      httpMock.expectOne(matchAuthUrl()).flush({ token });

      expect(received).toEqual({ token });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    beforeEach(() => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });
    });

    it('removes token from sessionStorage', () => {
      service.logout();

      expect(sessionStorage.getItem(environment.tokenKey)).toBeNull();
    });

    it('sets isAuthenticated to false', () => {
      service.logout();

      expect(service.isAuthenticated()).toBe(false);
    });

    it('sets currentUser to null', () => {
      service.logout();

      expect(service.currentUser()).toBeNull();
    });

    it('sets getToken to null', () => {
      service.logout();

      expect(service.getToken()).toBeNull();
    });

    it('navigates to /login', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      service.logout();

      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sessionIsExpiringSoon
  // ──────────────────────────────────────────────────────────────────────────

  describe('sessionIsExpiringSoon', () => {
    it('returns false when not logged in', () => {
      expect(service.sessionIsExpiringSoon()).toBe(false);
    });

    it('returns false when token expires in more than 5 minutes', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: tokenExpiringInSeconds(600) });

      expect(service.sessionIsExpiringSoon()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // auto logout (Vitest fake timers)
  // ──────────────────────────────────────────────────────────────────────────

  describe('auto logout timer', () => {
    it('logs out automatically when autoLogoutMinutes elapses', () => {
      vi.useFakeTimers();

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: tokenExpiringInSeconds(3600) });

      expect(service.isAuthenticated()).toBe(true);

      const autoLogoutMs = environment.autoLogoutMinutes * 60 * 1000;
      vi.advanceTimersByTime(autoLogoutMs + 500);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('resets the timer on resetAutoLogoutTimer — user stays logged in', () => {
      vi.useFakeTimers();

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: tokenExpiringInSeconds(3600) });

      const autoLogoutMs = environment.autoLogoutMinutes * 60 * 1000;

      vi.advanceTimersByTime(autoLogoutMs - 1000);
      expect(service.isAuthenticated()).toBe(true);

      service.resetAutoLogoutTimer();

      vi.advanceTimersByTime(autoLogoutMs - 1000);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('does not throw when resetAutoLogoutTimer is called without active session', () => {
      expect(() => service.resetAutoLogoutTimer()).not.toThrow();
    });

    it('logs out when token is already expired at service construction', () => {
      vi.useFakeTimers();

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: tokenExpiringInSeconds(1) });

      expect(service.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(service.isAuthenticated()).toBe(false);
    });
  });
});