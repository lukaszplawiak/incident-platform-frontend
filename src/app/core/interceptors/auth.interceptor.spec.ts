import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

// ─── Suite ────────────────────────────────────────────────────────────────────

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

    it('adds Authorization header to incident-service requests (port 8082)', () => {
      http.get('http://localhost:8082/api/v1/incidents').subscribe();

      const req = httpMock.expectOne('http://localhost:8082/api/v1/incidents');
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('adds Authorization header to ingestion-service requests (port 8081)', () => {
      http.get('http://localhost:8081/api/v1/alerts').subscribe();

      const req = httpMock.expectOne('http://localhost:8081/api/v1/alerts');
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('adds Authorization header to oncall-service requests (port 8086)', () => {
      http.get('http://localhost:8086/api/v1/oncall').subscribe();

      const req = httpMock.expectOne('http://localhost:8086/api/v1/oncall');
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('calls resetAutoLogoutTimer on every authenticated request', () => {
      http.get('http://localhost:8082/api/v1/incidents').subscribe();
      httpMock.expectOne('http://localhost:8082/api/v1/incidents').flush([]);

      expect(mockAuthService.resetAutoLogoutTimer).toHaveBeenCalledTimes(1);
    });

    it('does not mutate the original request object', () => {
      http.get('http://localhost:8082/api/v1/incidents').subscribe();

      const req = httpMock.expectOne('http://localhost:8082/api/v1/incidents');
      expect(req.request.url).toBe('http://localhost:8082/api/v1/incidents');
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
      http.get('http://localhost:8082/api/v1/incidents').subscribe();

      const req = httpMock.expectOne('http://localhost:8082/api/v1/incidents');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush([]);
    });

    it('does not call resetAutoLogoutTimer', () => {
      http.get('http://localhost:8082/api/v1/incidents').subscribe();
      httpMock.expectOne('http://localhost:8082/api/v1/incidents').flush([]);

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

    it('does not add Authorization header to requests outside backend ports', () => {
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