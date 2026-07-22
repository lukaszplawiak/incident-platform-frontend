import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantSettings, UpdateTenantSettingsRequest } from '../models/tenant-settings.model';

/**
 * Per-tenant configuration — currently just mfaRequired. ADMIN only on the
 * backend (@PreAuthorize("hasRole('ADMIN')") on both GET and POST), so the
 * /admin/settings route uses adminGuard, unlike /oncall which is visible to
 * RESPONDER too.
 */
@Injectable({
  providedIn: 'root'
})
export class TenantSettingsService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.authApiUrl}/api/v1/tenants/settings`;

  getSettings(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(this.baseUrl);
  }

  updateSettings(request: UpdateTenantSettingsRequest): Observable<TenantSettings> {
    return this.http.post<TenantSettings>(this.baseUrl, request);
  }
}