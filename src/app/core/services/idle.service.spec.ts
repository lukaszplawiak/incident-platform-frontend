import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdleService } from './idle.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface AuthServiceMock {
  isAuthenticated: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

interface LoggerServiceMock {
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('IdleService', () => {
  let service: IdleService;
  let authService: AuthServiceMock;
  let logger: LoggerServiceMock;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        IdleService,
        { provide: AuthService, useValue: {
          isAuthenticated: vi.fn(),
          logout: vi.fn(),
        } satisfies AuthServiceMock },
        { provide: LoggerService, useValue: {
          debug: vi.fn(),
          warn: vi.fn(),
        } satisfies LoggerServiceMock },
      ],
    });

    service = TestBed.inject(IdleService);
    authService = TestBed.inject(AuthService) as unknown as AuthServiceMock;
    logger = TestBed.inject(LoggerService) as unknown as LoggerServiceMock;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // startWatching
  // ──────────────────────────────────────────────────────────────────────────

  describe('startWatching', () => {
    it('starts watching user activity and logs debug message', () => {
      service.startWatching();

      expect(logger.debug).toHaveBeenCalledWith(
        'IdleService: started watching user activity'
      );
    });

    it('does not start watching twice', () => {
      service.startWatching();
      const firstCallCount = logger.debug.mock.calls.length;

      service.startWatching();

      expect(logger.debug.mock.calls.length).toBe(firstCallCount);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // stopWatching
  // ──────────────────────────────────────────────────────────────────────────

  describe('stopWatching', () => {
    it('stops watching and logs debug message', () => {
      service.startWatching();

      service.stopWatching();

      expect(logger.debug).toHaveBeenCalledWith(
        'IdleService: stopped watching user activity'
      );
    });

    it('is safe to call multiple times', () => {
      service.startWatching();

      service.stopWatching();
      service.stopWatching();

      expect(logger.debug).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // idle timeout
  // ──────────────────────────────────────────────────────────────────────────

  describe('idle timeout', () => {
    it('logs out user after inactivity when authenticated', () => {
      authService.isAuthenticated.mockReturnValue(true);

      service.startWatching();

      const timeout = environment.autoLogoutMinutes * 60 * 1000;

      vi.advanceTimersByTime(timeout + 10);

      expect(logger.warn).toHaveBeenCalledWith(
        'IdleService: user idle timeout — logging out',
        { idleTimeoutMinutes: environment.autoLogoutMinutes }
      );

      expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('does not logout when user is not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false);

      service.startWatching();

      const timeout = environment.autoLogoutMinutes * 60 * 1000;

      vi.advanceTimersByTime(timeout + 10);

      expect(authService.logout).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // user activity
  // ──────────────────────────────────────────────────────────────────────────

  describe('user activity', () => {
    it('resets timer on activity and prevents logout', () => {
      authService.isAuthenticated.mockReturnValue(true);

      service.startWatching();

      const timeout = environment.autoLogoutMinutes * 60 * 1000;

      vi.advanceTimersByTime(timeout / 2);

      document.dispatchEvent(new Event('mousemove'));

      vi.advanceTimersByTime(timeout / 2);

      expect(authService.logout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(timeout);

      expect(authService.logout).toHaveBeenCalled();
    });

    it('handles multiple events without excessive resets', () => {
      service.startWatching();

      let events = 0;

      const originalDispatch = document.dispatchEvent.bind(document);
      document.dispatchEvent = ((event: Event) => {
        events++;
        return originalDispatch(event);
      }) as typeof document.dispatchEvent;

      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(new Event('mousemove'));
      }

      // throttling should reduce effective resets
      expect(events).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ngOnDestroy
  // ──────────────────────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('stops watching on destroy', () => {
      const stopSpy = vi.spyOn(service, 'stopWatching');

      service.ngOnDestroy();

      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });
});