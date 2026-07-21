import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_AUTH_ENDPOINT } from '../http-context/public-endpoint.context';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isPublicAuthEndpoint = req.context.get(IS_PUBLIC_AUTH_ENDPOINT);

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        if (shouldRetry(error)) {
          return timer(retryCount * 1000);
        }
        throw error;
      }
    }),

    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          // A 401 from a public auth endpoint (login, mfa/verify,
          // accept-invite, ...) means "these credentials/this token are
          // invalid" — not "your session expired". There is no session
          // yet, so forcing a logout + redirect would only interrupt the
          // user mid-flow and show them a misleading message. The calling
          // component handles the error locally instead (see ApiError).
          if (!isPublicAuthEndpoint) {
            authService.logout();
          }
          break;

        case 403:
          router.navigate(['/forbidden']);
          break;

        case 0:
          break;
      }

      const userMessage = getUserFriendlyMessage(error, isPublicAuthEndpoint);

      // Preserve the real status code on the thrown error — see ApiError
      // for why this matters. Components can now do
      // `err instanceof ApiError && err.status === 409` reliably, instead
      // of matching substrings against this translated message.
      return throwError(() => new ApiError(userMessage, error.status));
    })
  );
};

function shouldRetry(error: HttpErrorResponse): boolean {
  return error.status === 0 || error.status === 503;
}

function getUserFriendlyMessage(
  error: HttpErrorResponse,
  isPublicAuthEndpoint: boolean
): string {
  switch (error.status) {
    case 0:
      return 'Unable to connect to the server. Please check your connection.';
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      // Generic fallback only — components on public auth endpoints
      // override this with endpoint-specific copy (see AcceptInvite,
      // Login) using err.status. This default just covers any call site
      // that doesn't bother to customize it.
      return isPublicAuthEndpoint
        ? 'Invalid or expired credentials.'
        : 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}