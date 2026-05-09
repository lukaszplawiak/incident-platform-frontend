import { Injectable, signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, interval, map, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, JwtPayload } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly WARNING_THRESHOLD_MS = 5 * 60 * 1000;

  private readonly tokenSignal = signal<string | null>(
    sessionStorage.getItem(environment.tokenKey)
  );

  readonly isAuthenticated = computed(() => {
    const token = this.tokenSignal();
    if (!token) return false;
    const payload = this.decodeToken(token);
    if (!payload) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  });

  readonly currentUser = computed(() => {
    const token = this.tokenSignal();
    if (!token) return null;
    return this.decodeToken(token);
  });

  readonly tenantId = computed(() => this.currentUser()?.tenantId ?? null);
  readonly userId = computed(() => this.currentUser()?.sub ?? null);

  // interval(1000) runs for the entire lifetime of the app because AuthService
  // is providedIn: 'root' and is never destroyed.
  // The filter() operator short-circuits each tick when no token is present —
  // no decoding, no arithmetic, no signal reads beyond the token check itself.
  // This avoids unnecessary work while the user is logged out or before login.
  readonly sessionRemainingMs = toSignal(
    interval(1000).pipe(
      filter(() => this.tokenSignal() !== null),
      map(() => {
        const token = this.tokenSignal();
        if (!token) return null;
        const payload = this.decodeToken(token);
        if (!payload) return null;
        const now = Math.floor(Date.now() / 1000);
        const remaining = (payload.exp - now) * 1000;
        return remaining > 0 ? remaining : null;
      })
    ),
    { initialValue: null }
  );

  readonly sessionIsExpiringSoon = computed(() => {
    const remaining = this.sessionRemainingMs();
    if (remaining === null) return false;
    return remaining <= this.WARNING_THRESHOLD_MS;
  });

  // ─── Dual logout timer design ───────────────────────────────────────────────
  //
  // The application uses two independent timers that can both trigger logout:
  //
  // 1. autoLogoutTimer (this service) — fires when Math.min(tokenExpiry, inactivityTimeout)
  //    is reached. It is set once on login and reset by resetAutoLogoutTimer() on every
  //    authenticated HTTP request (via authInterceptor). This ensures the session ends
  //    no later than the JWT expiry, regardless of user activity.
  //
  // 2. IdleService timer — fires after a period of zero user interaction
  //    (no mouse, keyboard, click, scroll or touch events). It is reset on every
  //    user activity event. This covers the case where the user walks away from
  //    the machine without making any HTTP requests.
  //
  // Why two timers instead of one:
  // - autoLogoutTimer handles absolute expiry (token-bound upper limit).
  // - IdleService handles inactivity (user-behaviour-bound limit).
  // - Either can fire first depending on which threshold is reached sooner.
  // - Both call authService.logout() — the second call is a no-op because
  //   logout() clears the token and navigates to /login, making isAuthenticated()
  //   return false on subsequent calls.
  //
  // This is intentional, not a bug.
  // ───────────────────────────────────────────────────────────────────────────
  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (this.tokenSignal()) {
      this.scheduleAutoLogout();
    }
  }

  login(userId: string, tenantId: string): Observable<AuthResponse> {
    const url = `${environment.authApiUrl}/dev/token`;
    return this.http.get<AuthResponse>(url, {
      params: { userId, tenantId }
    }).pipe(
      tap(response => this.storeToken(response.token))
    );
  }

  logout(): void {
    this.clearToken();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  resetAutoLogoutTimer(): void {
    if (this.isAuthenticated()) {
      this.scheduleAutoLogout();
    }
  }

  private storeToken(token: string): void {
    sessionStorage.setItem(environment.tokenKey, token);
    this.tokenSignal.set(token);
    this.scheduleAutoLogout();
  }

  private clearToken(): void {
    sessionStorage.removeItem(environment.tokenKey);
    this.tokenSignal.set(null);
    this.cancelAutoLogout();
  }

  private scheduleAutoLogout(): void {
    this.cancelAutoLogout();
    const token = this.tokenSignal();
    if (!token) return;
    const payload = this.decodeToken(token);
    if (!payload) return;
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresInMs = (payload.exp - now) * 1000;
    const inactivityMs = environment.autoLogoutMinutes * 60 * 1000;
    const logoutInMs = Math.min(tokenExpiresInMs, inactivityMs);
    if (logoutInMs <= 0) {
      this.logout();
      return;
    }
    this.autoLogoutTimer = setTimeout(() => this.logout(), logoutInMs);
  }

  private cancelAutoLogout(): void {
    if (this.autoLogoutTimer !== null) {
      clearTimeout(this.autoLogoutTimer);
      this.autoLogoutTimer = null;
    }
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = atob(
        parts[1].replace(/-/g, '+').replace(/_/g, '/')
      );
      return JSON.parse(payload) as JwtPayload;
    } catch {
      return null;
    }
  }
}