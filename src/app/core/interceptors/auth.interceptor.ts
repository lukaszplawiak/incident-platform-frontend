import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Auth interceptor — two responsibilities:
 *
 * 1. Attach Bearer token to every backend request.
 *
 * 2. Auto-refresh on 401:
 *    When the server returns 401 (access token expired), call
 *    AuthService.refresh() to get a new access token, then
 *    retry the original request once with the new token.
 *    If refresh also fails — AuthService.refresh() calls logout().
 *
 * Why retry only once:
 *    Retrying more than once risks infinite loops. If the retry
 *    also gets a 401, the refresh token is invalid — logout is correct.
 *
 * Why not refresh proactively:
 *    Proactive refresh (before expiry) requires polling and adds
 *    complexity. Reactive refresh on 401 is simpler and sufficient —
 *    the 15-minute access token rarely expires mid-request in practice.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);

  // Skip non-backend requests
  if (!isBackendRequest(req.url)) {
    return next(req);
  }

  // Skip the refresh endpoint itself — attaching a token here would cause
  // an infinite loop (refresh fails → 401 → try to refresh again...)
  if (isRefreshRequest(req.url)) {
    return next(req);
  }

  const token = authService.getToken();
  const authReq = token ? addBearerToken(req, token) : req;

  // Only reset the auto-logout timer when the request carries a token.
  // Resetting without a token is meaningless and misleads tests.
  if (token) {
    authService.resetAutoLogoutTimer();
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        // Access token expired — attempt refresh once
        return authService.refresh().pipe(
          switchMap(refreshResponse => {
            const retryReq = addBearerToken(req, refreshResponse.accessToken);
            return next(retryReq);
          }),
          catchError(refreshError => {
            // Refresh failed — AuthService.refresh() already called logout()
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

function addBearerToken(
  req: HttpRequest<unknown>,
  token: string
): HttpRequest<unknown> {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });
}

function isBackendRequest(url: string): boolean {
  return [
    environment.apiUrl,
    environment.authApiUrl,
    environment.oncallApiUrl,
  ].some(base => url.startsWith(base));
}

function isRefreshRequest(url: string): boolean {
  return url.includes('/api/v1/auth/refresh');
}