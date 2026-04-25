import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  handleError(error: unknown): void {
    const message = error instanceof Error
      ? error.message
      : 'Unknown error occurred';

    this.logger.error('Unhandled application error', error, { message });

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