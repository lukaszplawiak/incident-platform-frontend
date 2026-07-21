import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiKey,
  ApiKeyCreatedResponse,
  CreateApiKeyRequest,
  Integration,
  CreateIntegrationRequest,
  IntegrationCreatedResponse,
} from '../models/integration.model';

@Injectable({ providedIn: 'root' })
export class IntegrationService {

  private readonly http = inject(HttpClient);
  private readonly apiKeysUrl = `${environment.authApiUrl}/api/v1/api-keys`;
  private readonly integrationsUrl = `${environment.authApiUrl}/api/v1/integrations`;

  // ── API Keys ────────────────────────────────────────────────────────────────

  listApiKeys(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(this.apiKeysUrl);
  }

  createApiKey(request: CreateApiKeyRequest): Observable<ApiKeyCreatedResponse> {
    return this.http.post<ApiKeyCreatedResponse>(this.apiKeysUrl, request);
  }

  revokeApiKey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiKeysUrl}/${id}`);
  }

  // ── Integrations ─────────────────────────────────────────────────────────────

  listIntegrations(): Observable<Integration[]> {
    return this.http.get<Integration[]>(this.integrationsUrl);
  }

  createIntegration(request: CreateIntegrationRequest): Observable<IntegrationCreatedResponse> {
    return this.http.post<IntegrationCreatedResponse>(this.integrationsUrl, request);
  }

  deleteIntegration(id: string): Observable<void> {
    return this.http.delete<void>(`${this.integrationsUrl}/${id}`);
  }
}