import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  private readonly router = inject(Router);

  handleError(error: unknown): void {
    if (!environment.production) {
      console.error('[GlobalErrorHandler] Unhandled error:', error);
    } else {
      console.error('[GlobalErrorHandler] An unexpected error occurred.');
    }

    if (error instanceof Error && isCriticalError(error)) {
      this.router.navigate(['/error']);
    }
  }
}

function isCriticalError(error: Error): boolean {
  if (error.message.includes('Http failure')) return false;

  if (error.message.includes('NavigationError')) return false;

  return true;
}