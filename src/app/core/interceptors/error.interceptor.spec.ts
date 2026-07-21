import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { HttpContext } from '@angular/common/http';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_AUTH_ENDPOINT } from '../http-context/public-endpoint.context';

// ─── constants ───────────────────────────────────────────────────────────────

const TEST_URL = 'http://localhost:8082/api/v1/test';

// ─── mocks ───────────────────────────────────────────────────────────────────

interface AuthServiceMock {
  logout: ReturnType<typeof vi.fn>;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: AuthServiceMock;
  let router: Router;

  beforeEach(() => {
    mockAuthService = {
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'forbidden', component: class DummyForbidden {} },
          { path: 'login', component: class DummyLogin {} },
        ]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 401 Unauthorized
  // ──────────────────────────────────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('calls authService.logout()', async () => {
      vi.useFakeTimers();

      let errorCaught: unknown;

      http.get(TEST_URL).subscribe({
        error: (e: unknown) => {
          errorCaught = e;
        },
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 401, statusText: 'Unauthorized' }
      );

      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      expect(errorCaught).toBeDefined();
    });

    it('emits user-friendly error message for 401', async () => {
      vi.useFakeTimers();

      let errorMessage = '';

      http.get(TEST_URL).subscribe({
        error: (e: { message: string }) => {
          errorMessage = e.message;
        },
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 401, statusText: 'Unauthorized' }
      );

      await vi.runAllTimersAsync();

      expect(errorMessage).toBe(
        'Your session has expired. Please log in again.'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 403 Forbidden
  // ──────────────────────────────────────────────────────────────────────────

  describe('403 Forbidden', () => {
    it('navigates to /forbidden', async () => {
      vi.useFakeTimers();

      const navigateSpy = vi.spyOn(router, 'navigate');

      http.get(TEST_URL).subscribe({
        error: () => undefined,
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 403, statusText: 'Forbidden' }
      );

      await vi.runAllTimersAsync();

      expect(navigateSpy).toHaveBeenCalledWith(['/forbidden']);
    });

    it('emits user-friendly error message for 403', async () => {
      vi.useFakeTimers();

      let errorMessage = '';

      http.get(TEST_URL).subscribe({
        error: (e: { message: string }) => {
          errorMessage = e.message;
        },
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 403, statusText: 'Forbidden' }
      );

      await vi.runAllTimersAsync();

      expect(errorMessage).toBe(
        'You do not have permission to perform this action.'
      );
    });

    it('does not call authService.logout() for 403', async () => {
      vi.useFakeTimers();

      http.get(TEST_URL).subscribe({
        error: () => undefined,
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 403, statusText: 'Forbidden' }
      );

      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 503 retry logic
  // ──────────────────────────────────────────────────────────────────────────

  describe('503 Service Unavailable — retry', () => {
    it('retries request before failing', async () => {
      vi.useFakeTimers();

      let errorCount = 0;

      http.get(TEST_URL).subscribe({
        error: () => {
          errorCount++;
        },
      });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush(
          {},
          { status: 503, statusText: 'Service Unavailable' }
        );

        await vi.runAllTimersAsync();
      }

      expect(errorCount).toBe(1);
    });

    it('succeeds on retry', async () => {
      vi.useFakeTimers();

      let successData: unknown;

      http.get(TEST_URL).subscribe({
        next: (data: unknown) => {
          successData = data;
        },
      });

      httpMock.expectOne(TEST_URL).flush(
        {},
        { status: 503, statusText: 'Service Unavailable' }
      );

      await vi.runAllTimersAsync();

      httpMock.expectOne(TEST_URL).flush({ id: 'incident-1' });

      await vi.runAllTimersAsync();

      expect(successData).toEqual({ id: 'incident-1' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 0 network error
  // ──────────────────────────────────────────────────────────────────────────

  describe('status 0 — network error', () => {
    it('retries network error', async () => {
      vi.useFakeTimers();

      let errorCount = 0;

      http.get(TEST_URL).subscribe({
        error: () => {
          errorCount++;
        },
      });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush(
          {},
          { status: 0, statusText: 'Unknown Error' }
        );

        await vi.runAllTimersAsync();
      }

      expect(errorCount).toBe(1);
    });

    it('emits connection error message', async () => {
      vi.useFakeTimers();

      let errorMessage = '';

      http.get(TEST_URL).subscribe({
        error: (e: { message: string }) => {
          errorMessage = e.message;
        },
      });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush(
          {},
          { status: 0, statusText: 'Unknown Error' }
        );

        await vi.runAllTimersAsync();
      }

      expect(errorMessage).toBe(
        'Unable to connect to the server. Please check your connection.'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // no retry cases
  // ──────────────────────────────────────────────────────────────────────────

  describe('non-retry errors', () => {
    const nonRetryStatuses: number[] = [400, 401, 403, 404, 429, 500];

    nonRetryStatuses.forEach((status) => {
      it(`does not retry HTTP ${status}`, async () => {
        vi.useFakeTimers();

        http.get(TEST_URL).subscribe({
          error: () => undefined,
        });

        httpMock.expectOne(TEST_URL).flush(
          {},
          { status, statusText: 'Error' }
        );

        await vi.runAllTimersAsync();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // user-friendly messages
  // ──────────────────────────────────────────────────────────────────────────

  describe('error messages', () => {
    const cases: [number, string][] = [
      [0, 'Unable to connect to the server. Please check your connection.'],
      [400, 'Invalid request. Please check your input.'],
      [401, 'Your session has expired. Please log in again.'],
      [403, 'You do not have permission to perform this action.'],
      [404, 'The requested resource was not found.'],
      [429, 'Too many requests. Please wait a moment and try again.'],
      [503, 'Service temporarily unavailable. Please try again later.'],
      [500, 'An unexpected error occurred. Please try again.'],
    ];

    cases.forEach(([status, expected]) => {
      it(`returns correct message for ${status}`, async () => {
        vi.useFakeTimers();

        let errorMessage = '';

        http.get(TEST_URL).subscribe({
          error: (e: { message: string }) => {
            errorMessage = e.message;
          },
        });

        const retry = status === 0 || status === 503;
        const count = retry ? 4 : 1;

        for (let i = 0; i < count; i++) {
          httpMock.expectOne(TEST_URL).flush(
            {},
            { status, statusText: 'Error' }
          );

          await vi.runAllTimersAsync();
        }

        expect(errorMessage).toBe(expected);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ApiError — status code preservation
  // ──────────────────────────────────────────────────────────────────────────

  describe('ApiError', () => {
    it('preserves the original HTTP status on the thrown error', async () => {
      vi.useFakeTimers();
      let caught: unknown;

      http.get(TEST_URL).subscribe({ error: (e: unknown) => { caught = e; } });

      httpMock.expectOne(TEST_URL).flush({}, { status: 409, statusText: 'Conflict' });
      await vi.runAllTimersAsync();

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(409);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // IS_PUBLIC_AUTH_ENDPOINT context — public auth endpoints (login,
  // accept-invite, ...) must not trigger the global session-expiry redirect.
  // ──────────────────────────────────────────────────────────────────────────

  describe('IS_PUBLIC_AUTH_ENDPOINT context', () => {
    it('does not call authService.logout() on 401 when marked public', async () => {
      vi.useFakeTimers();
      const context = new HttpContext().set(IS_PUBLIC_AUTH_ENDPOINT, true);

      http.post(TEST_URL, {}, { context }).subscribe({ error: () => undefined });

      httpMock.expectOne(TEST_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('still calls authService.logout() on 401 when not marked public', async () => {
      vi.useFakeTimers();

      http.post(TEST_URL, {}).subscribe({ error: () => undefined });

      httpMock.expectOne(TEST_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });
  });
});