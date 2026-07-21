export type ApiKeyScope =
  | 'alerts:ingest'
  | 'incidents:read'
  | 'incidents:write'
  | 'oncall:read';

export const API_KEY_SCOPES: ApiKeyScope[] = [
  'alerts:ingest',
  'incidents:read',
  'incidents:write',
  'oncall:read',
];

export type ApiKeyType = 'INTEGRATION' | 'PERSONAL';

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  type: ApiKeyType;
  scopes: ApiKeyScope[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  rawToken: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CreateApiKeyRequest {
  name: string;
  type: ApiKeyType;
  scopes: ApiKeyScope[];
  ttl: string | null;
}

export interface Integration {
  id: string;
  tenantId: string;
  name: string;
  teamId: string;
  teamName: string;
  apiKeyId: string;
  createdAt: string;
}

export interface CreateIntegrationRequest {
  name: string;
  teamId: string;
  scopes: ApiKeyScope[];
  ttl: string | null;
}

export interface IntegrationCreatedResponse {
  integrationId: string;
  name: string;
  teamId: string;
  apiKeyId: string;
  rawToken: string;
  createdAt: string;
  expiresAt: string | null;
}