import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(
      // Fixed: errorInterceptor must be declared BEFORE authInterceptor,
      // not after. Angular's HTTP interceptors process requests in
      // declaration order but unwind RESPONSES (including errors) in
      // reverse — confirmed directly against Angular's own documentation
      // ("Requests flow in provided order; responses unwind in reverse"),
      // not assumed. With the previous [authInterceptor, errorInterceptor]
      // order, errorInterceptor sat closer to the server in the response
      // chain and therefore saw every 401 FIRST — it would immediately log
      // the user out and redirect to /login before authInterceptor's own
      // refresh-and-retry logic ever got a chance to run. This made the
      // entire, correctly-written token-refresh flow (AuthService.refresh(),
      // backed by a 30-day refresh token) functionally dead: every
      // expiration of the short-lived 15-minute access token forced an
      // immediate logout instead of a silent refresh. Swapping the order
      // fixes this without touching either interceptor's own logic —
      // authInterceptor now sees the 401 first, attempts refresh, and only
      // lets a genuine failure fall through to errorInterceptor's final
      // logout-and-redirect handling.
      withInterceptors([errorInterceptor, authInterceptor])
    ),

    provideZoneChangeDetection({ eventCoalescing: true }),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    }
  ]
};