import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token && isBackendRequest(req.url)) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    authService.resetAutoLogoutTimer();

    return next(authReq);
  }

  return next(req);
};

function isBackendRequest(url: string): boolean {
  const backendUrls = [
    environment.apiUrl,
    environment.authApiUrl,
    environment.oncallApiUrl,
  ];
  return backendUrls.some(base => url.startsWith(base));
}