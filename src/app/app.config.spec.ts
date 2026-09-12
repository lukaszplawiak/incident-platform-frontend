import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';
import { RefreshResponse } from './core/models/auth.model';
import { environment } from '../environments/environment';

/**
 * The actual regression coverage for the interceptor-order fix in
 * app.config.ts. Both authInterceptor and errorInterceptor already have
 * their own, fully-isolated spec files (each composed alone via
 * withInterceptors([thatOneInterceptor])) — neither of those can catch
 * an ordering bug between the two, since there's only ever one
 * interceptor present in either test. This file composes both real
 * interceptors together in the exact order app.config.ts uses
 * (withInterceptors([errorInterceptor, authInterceptor])) and asserts on
 * the actual observable behavior a wrong order breaks: whether a 401
 * gives authInterceptor's refresh-and-retry a chance to run before
 * errorInterceptor's own logout-and-redirect fires.
 *
 * Deliberately not asserting against appConfig's internal provider array
 * structure (e.g. inspecting the object withInterceptors() returns) —
 * that's an Angular implementation detail that could change between
 * versions and says nothing about actual behavior. Testing the
 * composed, real request/response flow is a more durable guard: it
 * would fail exactly the same way a real regression would surface, by
 * observing logout() firing when it shouldn't.
 */
describe('interceptor order (authInterceptor + errorInterceptor, as composed in app.config.ts)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    getToken: ReturnType<typeof vi.fn<() => string | null>>;
    resetAutoLogoutTimer: ReturnType<typeof vi.fn<() => void>>;
    refresh: ReturnType<typeof vi.fn<() => Observable<RefreshResponse>>>;
    logout: ReturnType<typeof vi.fn<() => void>>;
  };

  const REQUEST_URL = `${environment.apiUrl}/api/v1/incidents`;

  const REFRESH_RESPONSE: RefreshResponse = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    accessExpiresAt: '2026-01-01T00:15:00Z',
    refreshExpiresAt: '2026-01-31T00:00:00Z',
  };

  beforeEach(() => {
    mockAuthService = {
      getToken: vi.fn().mockReturnValue('expired-access-token'),
      resetAutoLogoutTimer: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        // Same order as app.config.ts — this is the exact thing under test.
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
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

  it('gives authInterceptor a chance to refresh and retry on 401, ' +
      'without errorInterceptor logging out first', () => {
    mockAuthService.refresh.mockReturnValue(of(REFRESH_RESPONSE));

    let result: unknown;
    let succeeded = false;
    http.get(REQUEST_URL).subscribe({
      next: value => { result = value; succeeded = true; },
      error: err => { result = err; },
    });

    // First attempt — server rejects the expired token.
    const firstReq = httpMock.expectOne(REQUEST_URL);
    expect(firstReq.request.headers.get('Authorization'))
      .toBe('Bearer expired-access-token');
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // authInterceptor should have called refresh() and retried with the
    // new token — a second request, not a thrown error.
    expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);

    const retryReq = httpMock.expectOne(REQUEST_URL);
    expect(retryReq.request.headers.get('Authorization'))
      .toBe('Bearer new-access-token');
    retryReq.flush({ id: 'incident-1' });

    expect(succeeded).toBe(true);
    expect(result).toEqual({ id: 'incident-1' });

    // The actual regression this test exists for: if errorInterceptor
    // had seen the 401 first (the old, broken order), it would have
    // called logout() immediately and none of the above would have had
    // a chance to happen.
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });

  it('still falls through to a logout when refresh itself fails', () => {
    // Mirrors AuthService.refresh()'s own real behavior (it calls
    // logout() internally on failure, then rethrows) — simulated here
    // since AuthService itself is fully mocked in this test.
    mockAuthService.refresh.mockImplementation(() => {
      mockAuthService.logout();
      return throwError(() => new Error('refresh token expired'));
    });

    let caughtError: unknown;
    http.get(REQUEST_URL).subscribe({
      next: () => { throw new Error('expected this request to fail'); },
      error: err => { caughtError = err; },
    });

    const firstReq = httpMock.expectOne(REQUEST_URL);
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);
    expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    expect(caughtError).toBeDefined();
  });
});