import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    getToken: ReturnType<typeof vi.fn>;
    resetAutoLogoutTimer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      getToken: vi.fn(),
      resetAutoLogoutTimer: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Backend requests — token present
  // ──────────────────────────────────────────────────────────────────────────

  describe('when token is present and request targets backend', () => {
    beforeEach(() => {
      mockAuthService.getToken.mockReturnValue('my-jwt-token');
    });

    it('adds Authorization header to apiUrl requests (incident-service)', () => {
      const url = `${environment.apiUrl}/api/v1/incidents`;
      http.get(url).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('adds Authorization header to authApiUrl requests (ingestion-service)', () => {
      const url = `${environment.authApiUrl}/api/v1/alerts`;
      http.get(url).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('adds Authorization header to oncallApiUrl requests', () => {
      const url = `${environment.oncallApiUrl}/api/v1/oncall`;
      http.get(url).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('calls resetAutoLogoutTimer on every authenticated request', () => {
      const url = `${environment.apiUrl}/api/v1/incidents`;
      http.get(url).subscribe();
      httpMock.expectOne(url).flush([]);

      expect(mockAuthService.resetAutoLogoutTimer).toHaveBeenCalledTimes(1);
    });

    it('does not mutate the original request object', () => {
      const url = `${environment.apiUrl}/api/v1/incidents`;
      http.get(url).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.url).toBe(url);
      req.flush([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Backend requests — no token
  // ──────────────────────────────────────────────────────────────────────────

  describe('when no token is present', () => {
    beforeEach(() => {
      mockAuthService.getToken.mockReturnValue(null);
    });

    it('does not add Authorization header to backend requests', () => {
      const url = `${environment.apiUrl}/api/v1/incidents`;
      http.get(url).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush([]);
    });

    it('does not call resetAutoLogoutTimer', () => {
      const url = `${environment.apiUrl}/api/v1/incidents`;
      http.get(url).subscribe();
      httpMock.expectOne(url).flush([]);

      expect(mockAuthService.resetAutoLogoutTimer).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // External requests — token should NOT be attached
  // ──────────────────────────────────────────────────────────────────────────

  describe('when request targets an external URL', () => {
    beforeEach(() => {
      mockAuthService.getToken.mockReturnValue('my-jwt-token');
    });

    it('does not add Authorization header to external requests', () => {
      http.get('https://api.external-service.com/data').subscribe();

      const req = httpMock.expectOne('https://api.external-service.com/data');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('does not call resetAutoLogoutTimer for external requests', () => {
      http.get('https://api.external-service.com/data').subscribe();
      httpMock.expectOne('https://api.external-service.com/data').flush({});

      expect(mockAuthService.resetAutoLogoutTimer).not.toHaveBeenCalled();
    });
  });
});