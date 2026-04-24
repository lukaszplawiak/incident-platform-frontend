import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

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
          authService.logout();
          break;

        case 403:
          router.navigate(['/forbidden']);
          break;

        case 0:
          break;
      }

      const userMessage = getUserFriendlyMessage(error);

      return throwError(() => new Error(userMessage));
    })
  );
};

function shouldRetry(error: HttpErrorResponse): boolean {
  return error.status === 0 || error.status === 503;
}

function getUserFriendlyMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 0:
      return 'Unable to connect to the server. Please check your connection.';
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
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