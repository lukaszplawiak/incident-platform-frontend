import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';

import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';

// ─── Suite ────────────────────────────────────────────────────────────────────

const TEST_URL = 'http://localhost:8082/api/v1/test';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: { logout: ReturnType<typeof vi.fn> };
  let router: Router;

  function flushError(status: number, statusText = 'Error', times = 1): void {
    for (let i = 0; i < times; i++) {
      httpMock.expectOne(TEST_URL).flush(
        { message: statusText },
        { status, statusText }
      );
    }
  }

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
          { path: 'forbidden', component: class DummyForbidden {} as any },
          { path: 'login', component: class DummyLogin {} as any },
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
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 401 Unauthorized
  // ──────────────────────────────────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('calls authService.logout()', async () => {
      vi.useFakeTimers();
      let caughtError: Error | undefined;

      http.get(TEST_URL).subscribe({ error: (e: Error) => (caughtError = e) });

      httpMock.expectOne(TEST_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('emits user-friendly error message for 401', async () => {
      vi.useFakeTimers();
      let errorMessage = '';

      http.get(TEST_URL).subscribe({ error: (e: Error) => (errorMessage = e.message) });
      httpMock.expectOne(TEST_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
      await vi.runAllTimersAsync();

      expect(errorMessage).toBe('Your session has expired. Please log in again.');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 403 Forbidden
  // ──────────────────────────────────────────────────────────────────────────

  describe('403 Forbidden', () => {
    it('navigates to /forbidden', async () => {
      vi.useFakeTimers();
      const navigateSpy = vi.spyOn(router, 'navigate');

      http.get(TEST_URL).subscribe({ error: () => {} });
      httpMock.expectOne(TEST_URL).flush({}, { status: 403, statusText: 'Forbidden' });
      await vi.runAllTimersAsync();

      expect(navigateSpy).toHaveBeenCalledWith(['/forbidden']);
    });

    it('emits user-friendly error message for 403', async () => {
      vi.useFakeTimers();
      let errorMessage = '';

      http.get(TEST_URL).subscribe({ error: (e: Error) => (errorMessage = e.message) });
      httpMock.expectOne(TEST_URL).flush({}, { status: 403, statusText: 'Forbidden' });
      await vi.runAllTimersAsync();

      expect(errorMessage).toBe('You do not have permission to perform this action.');
    });

    it('does not call authService.logout() for 403', async () => {
      vi.useFakeTimers();

      http.get(TEST_URL).subscribe({ error: () => {} });
      httpMock.expectOne(TEST_URL).flush({}, { status: 403, statusText: 'Forbidden' });
      await vi.runAllTimersAsync();

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 503 — retry logic
  // ──────────────────────────────────────────────────────────────────────────

  describe('503 Service Unavailable — retry', () => {
    it('retries the request 3 times before failing', async () => {
      vi.useFakeTimers();
      let errorCount = 0;

      http.get(TEST_URL).subscribe({ error: () => errorCount++ });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush({}, { status: 503, statusText: 'Service Unavailable' });
        await vi.runAllTimersAsync();
      }

      expect(errorCount).toBe(1);
    });

    it('succeeds if the 2nd attempt returns 200', async () => {
      vi.useFakeTimers();
      let successData: unknown;

      http.get(TEST_URL).subscribe({ next: (data) => (successData = data) });

      httpMock.expectOne(TEST_URL).flush({}, { status: 503, statusText: 'Service Unavailable' });
      await vi.runAllTimersAsync();

      httpMock.expectOne(TEST_URL).flush({ id: 'incident-1' });
      await vi.runAllTimersAsync();

      expect(successData).toEqual({ id: 'incident-1' });
    });

    it('emits user-friendly message after all retries exhausted', async () => {
      vi.useFakeTimers();
      let errorMessage = '';

      http.get(TEST_URL).subscribe({ error: (e: Error) => (errorMessage = e.message) });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush({}, { status: 503, statusText: 'Service Unavailable' });
        await vi.runAllTimersAsync();
      }

      expect(errorMessage).toBe('Service temporarily unavailable. Please try again later.');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Status 0 — network error (retry)
  // ──────────────────────────────────────────────────────────────────────────

  describe('status 0 — network error', () => {
    it('retries on network error (status 0)', async () => {
      vi.useFakeTimers();
      let errorCount = 0;

      http.get(TEST_URL).subscribe({ error: () => errorCount++ });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush({}, { status: 0, statusText: 'Unknown Error' });
        await vi.runAllTimersAsync();
      }

      httpMock.verify();
      expect(errorCount).toBe(1);
    });

    it('emits connection error message for status 0', async () => {
      vi.useFakeTimers();
      let errorMessage = '';

      http.get(TEST_URL).subscribe({ error: (e: Error) => (errorMessage = e.message) });

      for (let i = 0; i < 4; i++) {
        httpMock.expectOne(TEST_URL).flush({}, { status: 0, statusText: 'Unknown Error' });
        await vi.runAllTimersAsync();
      }

      expect(errorMessage).toBe('Unable to connect to the server. Please check your connection.');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Errors that should NOT be retried
  // ──────────────────────────────────────────────────────────────────────────

  describe('errors that should not be retried', () => {
    const nonRetryStatuses = [400, 401, 403, 404, 429, 500];

    nonRetryStatuses.forEach((status) => {
      it(`does not retry on HTTP ${status}`, async () => {
        vi.useFakeTimers();

        http.get(TEST_URL).subscribe({ error: () => {} });

        httpMock.expectOne(TEST_URL).flush({}, { status, statusText: 'Error' });
        await vi.runAllTimersAsync();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // User-friendly messages
  // ──────────────────────────────────────────────────────────────────────────

  describe('user-friendly error messages', () => {
    const messageCases: Array<[number, string]> = [
      [0,   'Unable to connect to the server. Please check your connection.'],
      [400, 'Invalid request. Please check your input.'],
      [401, 'Your session has expired. Please log in again.'],
      [403, 'You do not have permission to perform this action.'],
      [404, 'The requested resource was not found.'],
      [429, 'Too many requests. Please wait a moment and try again.'],
      [503, 'Service temporarily unavailable. Please try again later.'],
      [500, 'An unexpected error occurred. Please try again.'],
    ];

    messageCases.forEach(([status, expectedMessage]) => {
      it(`returns "${expectedMessage}" for HTTP ${status}`, async () => {
        vi.useFakeTimers();
        let errorMessage = '';

        http.get(TEST_URL).subscribe({ error: (e: Error) => (errorMessage = e.message) });

        const isRetried = status === 0 || status === 503;
        const requestCount = isRetried ? 4 : 1;

        for (let i = 0; i < requestCount; i++) {
          httpMock.expectOne(TEST_URL).flush({}, { status, statusText: 'Error' });
          await vi.runAllTimersAsync();
        }

        expect(errorMessage).toBe(expectedMessage);
      });
    });
  });
});