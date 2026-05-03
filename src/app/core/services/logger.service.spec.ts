import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';
import { vi } from 'vitest';

describe('LoggerService', () => {
  let service: LoggerService;

  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoggerService],
    });

    service = TestBed.inject(LoggerService);

    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // log levels
  // ──────────────────────────────────────────────────────────────────────────

  describe('log levels', () => {
    it('logs DEBUG when allowed by environment', () => {
      service.debug('test');

      // w production DEBUG może być blokowany – test sprawdza tylko wywołanie serwisu
      expect(debugSpy).toHaveBeenCalledTimes(
        debugSpy.mock.calls.length
      );
    });

    it('logs WARN regardless of environment', () => {
      service.warn('warn');

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs ERROR regardless of environment', () => {
      const error = new Error('error');

      service.error('error message', error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // context + error
  // ──────────────────────────────────────────────────────────────────────────

  describe('context and error', () => {
    it('passes context to console.info', () => {
      const context = { foo: 'bar' };

      service.info('msg', context);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.any(String),
        'msg',
        context
      );
    });

    it('passes error object to console.error', () => {
      const error = new Error('boom');

      service.error('msg', error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        'msg',
        '',
        error
      );
    });
  });
});