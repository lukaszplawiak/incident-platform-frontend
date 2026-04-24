import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, JwtPayload } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

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

  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (this.tokenSignal()) {
      this.scheduleAutoLogout();
    }
  }

  login(userId: string, tenantId: string): Observable<AuthResponse> {
    const url = `${environment.apiUrl.replace('8082', '8081')}/dev/token`;

    return this.http.get<AuthResponse>(url, {
      params: { userId, tenantId }
    }).pipe(
      tap(response => {
        this.storeToken(response.token);
      })
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

    this.autoLogoutTimer = setTimeout(() => {
      this.logout();
    }, logoutInMs);
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