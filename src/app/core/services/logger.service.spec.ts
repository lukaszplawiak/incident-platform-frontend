import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';
import { vi } from 'vitest';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoggerService],
    });

    service = TestBed.inject(LoggerService);

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // log levels
  // ──────────────────────────────────────────────────────────────────────────

  describe('log levels', () => {
    it('logs DEBUG in non-production mode', () => {
      if (environment.production) return;

      service.debug('test');

      expect(console.debug).toHaveBeenCalled();
    });

    it('does NOT log DEBUG in production mode', () => {
      if (!environment.production) return;

      service.debug('test');

      expect(console.debug).not.toHaveBeenCalled();
    });

    it('logs WARN regardless of environment', () => {
      service.warn('warn');

      expect(console.warn).toHaveBeenCalled();
    });

    it('logs ERROR regardless of environment', () => {
      service.error('error');

      expect(console.error).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // context + error
  // ──────────────────────────────────────────────────────────────────────────

  describe('context and error', () => {
    it('passes context to console', () => {
      const context = { foo: 'bar' };

      service.info('msg', context);

      expect(console.info).toHaveBeenCalledWith(
        expect.any(String),
        'msg',
        context
      );
    });

    it('passes error object to console.error', () => {
      const error = new Error('boom');

      service.error('msg', error);

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        'msg',
        '',
        error
      );
    });
  });
});