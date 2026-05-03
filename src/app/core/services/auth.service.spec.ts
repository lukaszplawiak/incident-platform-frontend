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
import { environment } from '../../../environments/environment';

// ─── Test helpers ─────────────────────────────────────────────────────────────

type JwtPayload = Record<string, unknown>;

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
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_ADMIN'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
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
  return (req: { url: string }) =>
    req.url === `${environment.authApiUrl}/dev/token`;
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

    it('returns true after login', () => {
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

    it('returns false for invalid token', () => {
      sessionStorage.setItem(environment.tokenKey, 'invalid.jwt.token');

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

    it('returns decoded payload after login', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      const user = service.currentUser();

      expect(user).not.toBeNull();
      expect((user as any).sub).toBe('user-abc');
      expect((user as any).tenantId).toBe('acme-corp');
    });

    it('returns null after logout', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      service.logout();

      expect(service.currentUser()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // tenantId / userId
  // ──────────────────────────────────────────────────────────────────────────

  describe('tenantId', () => {
    it('returns null when not logged in', () => {
      expect(service.tenantId()).toBeNull();
    });

    it('returns tenantId after login', () => {
      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token: validToken() });

      expect(service.tenantId()).toBe('acme-corp');
    });
  });

  describe('userId', () => {
    it('returns null when not logged in', () => {
      expect(service.userId()).toBeNull();
    });

    it('returns user id after login', () => {
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

    it('returns token after login', () => {
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
    it('sends request with correct params', () => {
      service.login('user-abc', 'acme-corp').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === `${environment.authApiUrl}/dev/token` &&
          r.params.get('userId') === 'user-abc' &&
          r.params.get('tenantId') === 'acme-corp'
      );

      req.flush({ token: validToken() });
    });

    it('stores token', () => {
      const token = validToken();

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({ token });

      expect(sessionStorage.getItem(environment.tokenKey)).toBe(token);
    });

    it('returns response', () => {
      const token = validToken();

      let result: { token: string } | undefined;

      service.login('user-abc', 'acme-corp').subscribe((res) => {
        result = res;
      });

      httpMock.expectOne(matchAuthUrl()).flush({ token });

      expect(result).toEqual({ token });
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

    it('clears storage', () => {
      service.logout();
      expect(sessionStorage.getItem(environment.tokenKey)).toBeNull();
    });

    it('navigates to login', () => {
      const spy = vi.spyOn(router, 'navigate');

      service.logout();

      expect(spy).toHaveBeenCalledWith(['/login']);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // timers
  // ──────────────────────────────────────────────────────────────────────────

  describe('auto logout', () => {
    it('logs out after timeout', () => {
      vi.useFakeTimers();

      service.login('user-abc', 'acme-corp').subscribe();
      httpMock.expectOne(matchAuthUrl()).flush({
        token: tokenExpiringInSeconds(3600),
      });

      const ms = environment.autoLogoutMinutes * 60 * 1000;

      vi.advanceTimersByTime(ms + 500);

      expect(service.isAuthenticated()).toBe(false);
    });
  });
});