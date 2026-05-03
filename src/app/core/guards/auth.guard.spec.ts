import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('authGuard', () => {
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
  };

  let router: Router;

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      authGuard(
        {} as unknown as import('@angular/router').ActivatedRouteSnapshot,
        {} as unknown as import('@angular/router').RouterStateSnapshot
      )
    ) as boolean | UrlTree;
  }

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        provideRouter([
          { path: 'login', component: class DummyLogin {} },
          { path: 'incidents', component: class DummyIncidents {} },
        ]),
      ],
    });

    router = TestBed.inject(Router);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Authenticated user
  // ──────────────────────────────────────────────────────────────────────────

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockReturnValue(true);
    });

    it('returns true to allow navigation', () => {
      const result = runGuard();

      expect(result).toBe(true);
    });

    it('does not redirect to /login', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      runGuard();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Unauthenticated user
  // ──────────────────────────────────────────────────────────────────────────

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
    });

    it('returns a UrlTree (not boolean true)', () => {
      const result = runGuard();

      expect(result).not.toBe(true);
      expect(result).toBeInstanceOf(UrlTree);
    });

    it('returns UrlTree pointing to /login', () => {
      const result = runGuard() as UrlTree;

      expect(result.toString()).toBe('/login');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AuthService is called
  // ──────────────────────────────────────────────────────────────────────────

  it('checks isAuthenticated exactly once per guard activation', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    runGuard();

    expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(1);
  });
});