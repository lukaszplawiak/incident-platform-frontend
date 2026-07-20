import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Route guard — allows access only to users with ROLE_ADMIN.
 *
 * Redirects to /forbidden when the user is authenticated but lacks
 * the admin role. Redirects to /login when not authenticated at all.
 *
 * Usage: canActivate: [adminGuard]
 *
 * Why a separate guard instead of reusing authGuard:
 * authGuard only checks authentication (has a valid token).
 * adminGuard checks authorisation (has the correct role).
 * These are distinct concerns — separation makes routing intent explicit.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.isAdmin()) {
    return router.createUrlTree(['/forbidden']);
  }

  return true;
};