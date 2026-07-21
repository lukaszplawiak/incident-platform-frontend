import { Injectable, signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Observable, tap, interval, map, filter, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IS_PUBLIC_AUTH_ENDPOINT } from '../http-context/public-endpoint.context';
import {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  MfaVerifyRequest,
  AcceptInviteRequest,
  JwtPayload,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly WARNING_THRESHOLD_MS = 5 * 60 * 1000;

  private readonly accessTokenSignal = signal<string | null>(
    sessionStorage.getItem(environment.tokenKey)
  );

  // ── Public state ────────────────────────────────────────────────────────────

  readonly isAuthenticated = computed(() => {
    const token = this.accessTokenSignal();
    if (!token) return false;
    const payload = this.decodeToken(token);
    if (!payload) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  });

  readonly currentUser = computed(() => {
    const token = this.accessTokenSignal();
    if (!token) return null;
    return this.decodeToken(token);
  });

  readonly tenantId = computed(() => this.currentUser()?.tenantId ?? null);
  readonly userId = computed(() => this.currentUser()?.sub ?? null);
  readonly roles = computed(() => this.currentUser()?.roles ?? []);
  readonly teamIds = computed(() => this.currentUser()?.teamIds ?? []);

  readonly isAdmin = computed(() =>
    this.roles().includes('ROLE_ADMIN')
  );

  // ── Session countdown (same pattern as before — toSignal from interval) ─────

  readonly sessionRemainingMs = toSignal(
    interval(1000).pipe(
      filter(() => this.accessTokenSignal() !== null),
      map(() => {
        const token = this.accessTokenSignal();
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

  // ── Auto-logout timer (same dual-timer design as before) ────────────────────
  //
  // autoLogoutTimer — fires when Math.min(tokenExpiry, inactivityTimeout) is
  // reached. Reset on every authenticated HTTP request via resetAutoLogoutTimer().
  //
  // IdleService — fires after zero user interaction (mouse/keyboard/scroll).
  // Both call logout() — second call is a no-op (token already cleared).
  // ────────────────────────────────────────────────────────────────────────────
  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (this.accessTokenSignal()) {
      this.scheduleAutoLogout();
    }
  }

  // ── Auth API calls ──────────────────────────────────────────────────────────

  /**
   * POST /api/v1/auth/login
   *
   * Sends email + password in the body.
   * tenantId is passed as X-Tenant-Id header — auth-service reads it there
   * because the login endpoint is public (JwtAuthFilter skips it, so
   * TenantContext is never populated from a JWT on this endpoint).
   *
   * Two outcomes:
   * - mfaRequired=false → stores access+refresh tokens, ready to use
   * - mfaRequired=true  → returns response for caller to show MFA screen
   */
  login(request: LoginRequest, tenantId: string): Observable<LoginResponse> {
    const url = `${environment.authApiUrl}/api/v1/auth/login`;
    const headers = new HttpHeaders({ 'X-Tenant-Id': tenantId });
    const context = new HttpContext().set(IS_PUBLIC_AUTH_ENDPOINT, true);

    return this.http.post<LoginResponse>(url, request, { headers, context }).pipe(
      tap(response => {
        if (!response.mfaRequired && response.accessToken && response.refreshToken) {
          this.storeTokens(response.accessToken, response.refreshToken);
        }
        // If MFA is required — do NOT store tokens yet.
        // Caller (Login component) navigates to MFA verify screen,
        // which will call verifyMfa() and then store tokens.
      })
    );
  }

  /**
   * POST /api/v1/auth/mfa/verify
   *
   * Called after login when mfaRequired=true.
   * On success, stores access+refresh tokens.
   */
  verifyMfa(request: MfaVerifyRequest, tenantId: string): Observable<LoginResponse> {
    const url = `${environment.authApiUrl}/api/v1/auth/mfa/verify`;
    const headers = new HttpHeaders({ 'X-Tenant-Id': tenantId });
    const context = new HttpContext().set(IS_PUBLIC_AUTH_ENDPOINT, true);

    return this.http.post<LoginResponse>(url, request, { headers, context }).pipe(
      tap(response => {
        if (response.accessToken && response.refreshToken) {
          this.storeTokens(response.accessToken, response.refreshToken);
        }
      })
    );
  }

  /**
   * POST /api/v1/auth/accept-invite
   *
   * Called from the accept-invite screen reached via the invite email
   * link. Sets the invited user's password and consumes the single-use
   * invite token in one server-side transaction. Returns 204 No Content —
   * no tokens are issued here; the user logs in separately afterwards
   * with their new password.
   *
   * tenantId is embedded in the invite token server-side, so no
   * X-Tenant-Id header is needed (unlike login/verifyMfa).
   */
  acceptInvite(request: AcceptInviteRequest): Observable<void> {
    const url = `${environment.authApiUrl}/api/v1/auth/accept-invite`;
    const context = new HttpContext().set(IS_PUBLIC_AUTH_ENDPOINT, true);

    return this.http.post<void>(url, request, { context });
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Called automatically by auth interceptor when a 401 is received.
   * Returns new access+refresh tokens. Called without Authorization header
   * (the refresh token itself is the credential).
   *
   * Note: interceptor calls this — do not call manually from components.
   */
  refresh(): Observable<RefreshResponse> {
    const refreshToken = sessionStorage.getItem(environment.refreshTokenKey);
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const url = `${environment.authApiUrl}/api/v1/auth/refresh`;
    const body: RefreshRequest = { refreshToken };

    return this.http.post<RefreshResponse>(url, body).pipe(
      tap(response => {
        this.storeTokens(response.accessToken, response.refreshToken);
      }),
      catchError(err => {
        // Refresh failed (token expired or revoked) — force logout
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * POST /api/v1/auth/logout
   *
   * Revokes the access token on the server, then clears local state.
   */
  logout(): void {
    const token = this.accessTokenSignal();
    if (token) {
      // Fire-and-forget — revoke on server. No need to wait for response.
      this.http.post(`${environment.authApiUrl}/api/v1/auth/logout`, {}).subscribe({
        error: () => { /* silent — local logout proceeds regardless */ }
      });
    }
    this.clearTokens();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.accessTokenSignal();
  }

  resetAutoLogoutTimer(): void {
    if (this.isAuthenticated()) {
      this.scheduleAutoLogout();
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private storeTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(environment.tokenKey, accessToken);
    sessionStorage.setItem(environment.refreshTokenKey, refreshToken);
    this.accessTokenSignal.set(accessToken);
    this.scheduleAutoLogout();
  }

  private clearTokens(): void {
    sessionStorage.removeItem(environment.tokenKey);
    sessionStorage.removeItem(environment.refreshTokenKey);
    this.accessTokenSignal.set(null);
    this.cancelAutoLogout();
  }

  private scheduleAutoLogout(): void {
    this.cancelAutoLogout();
    const token = this.accessTokenSignal();
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