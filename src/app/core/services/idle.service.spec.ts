import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdleService } from './idle.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';

// ─── Mocks ────────────────────────────────────────────────────────────────────

class AuthServiceMock {
  isAuthenticated = vi.fn();
  logout = vi.fn();
}

class LoggerServiceMock {
  debug = vi.fn();
  warn = vi.fn();
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
        { provide: AuthService, useClass: AuthServiceMock },
        { provide: LoggerService, useClass: LoggerServiceMock },
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
      const calls = logger.debug.mock.calls.length;

      service.startWatching();

      expect(logger.debug.mock.calls.length).toBe(calls);
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

    it('clears internal subscription', () => {
      service.startWatching();

      service.stopWatching();

      expect(() => service.stopWatching()).not.toThrow();
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

      expect(authService.logout).toHaveBeenCalled();
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
  // activity handling
  // ──────────────────────────────────────────────────────────────────────────

  describe('user activity', () => {
    it('resets timer on user activity', () => {
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

    it('handles multiple activity events with throttling', () => {
      const resetSpy = vi.spyOn<any, any>(service as any, 'resetTimer');

      service.startWatching();

      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(new Event('mousemove'));
      }

      expect(resetSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ngOnDestroy
  // ──────────────────────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('calls stopWatching on destroy', () => {
      const stopSpy = vi.spyOn(service, 'stopWatching');

      service.ngOnDestroy();

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});