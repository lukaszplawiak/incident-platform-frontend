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

// Mirrors backend ApiKeyType.java exactly.
export type ApiKeyType = 'TENANT' | 'PERSONAL';

// Mirrors backend CreateIntegrationRequest.java's own @Pattern constraint
// exactly — "source must be one of: prometheus, wazuh, generic".
export type IntegrationSource = 'prometheus' | 'wazuh' | 'generic';

export const INTEGRATION_SOURCES: IntegrationSource[] = [
  'prometheus',
  'wazuh',
  'generic',
];

/**
 * Mirrors backend ApiKeyDto.java exactly — verified field-by-field, not
 * assumed. Fixed:
 *  - `type` renamed to `keyType` (the field the backend actually sends).
 *  - Added `keyPrefix` (first 8 chars, for UI identification),
 *    `ownerEmail` (null for TENANT keys), and `active` — all present in
 *    ApiKeyDto and previously absent here entirely.
 *  - Removed `tenantId` — ApiKeyDto has never had this field; confirmed
 *    it was never actually read anywhere in this feature's own
 *    component or template.
 */
export interface ApiKey {
  id: string;
  name: string;
  keyType: ApiKeyType;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  ownerEmail: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  active: boolean;
}

/**
 * Mirrors backend ApiKeyCreatedResponse.java exactly. Fixed: the raw key
 * field was named `rawToken` here — the backend has always sent `rawKey`
 * — so integrations.ts's own response.rawToken read was always
 * undefined for this specific response, the one and only time the raw
 * key is ever returned. Also added `keyType`, `scopes`, and `message`,
 * all present in the backend response and previously absent here.
 */
export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  keyType: ApiKeyType;
  scopes: ApiKeyScope[];
  rawKey: string;
  expiresAt: string | null;
  createdAt: string;
  message: string;
}

/**
 * Mirrors backend CreateApiKeyRequest.java exactly. Fixed:
 *  - `type` renamed to `keyType` — the backend's @NotNull keyType field
 *    never matched a request body that only ever sent `type`, so
 *    integrations.ts's own createApiKey call always failed validation.
 *  - `ttl` (a duration string like "P30D", which the backend has never
 *    accepted) replaced with `expiresAt` (an ISO instant, or null for a
 *    non-expiring key) — the field CreateApiKeyRequest.java actually
 *    declares.
 */
export interface CreateApiKeyRequest {
  name: string;
  keyType: ApiKeyType;
  scopes: ApiKeyScope[];
  expiresAt: string | null;
}

/**
 * Mirrors backend IntegrationDto.java exactly. Fixed:
 *  - Added `source` (required by the backend on creation, but never
 *    represented on the read side either), `description`, and `active`
 *    — all present in IntegrationDto and previously absent here.
 *  - `apiKeyId` renamed to `apiKeyPrefix` — the backend sends a display
 *    prefix (e.g. "ipl_abc1"), not an id; the old name suggested a UUID
 *    that was never actually what this field contained.
 *  - `teamId`/`teamName` are nullable — IntegrationDto.from() sends null
 *    for both when an integration has no team, which this interface
 *    previously didn't allow for.
 *  - Removed `tenantId` — IntegrationDto has never had this field;
 *    confirmed never read anywhere in this feature's own component or
 *    template.
 */
export interface Integration {
  id: string;
  name: string;
  source: IntegrationSource;
  teamId: string | null;
  teamName: string | null;
  apiKeyPrefix: string | null;
  description: string | null;
  createdAt: string;
  active: boolean;
}

/**
 * Mirrors backend CreateIntegrationRequest.java exactly. Fixed:
 *  - Added `source` — @NotBlank and pattern-restricted on the backend,
 *    but entirely absent from this interface (and from the form that
 *    builds it) — every createIntegration call was rejected with a
 *    validation error before this fix, since the backend never received
 *    a field it requires.
 *  - Removed `scopes` and `ttl` — CreateIntegrationRequest.java has
 *    never accepted either; scopes for an integration's API key are
 *    fixed server-side, and integrations don't expire the way personal
 *    keys can.
 *  - Added optional `description`, present on the backend and
 *    previously absent here.
 *  - `teamId` stays required (string, not string | null) — the backend
 *    itself allows a null team ("escalation skips on-call routing"),
 *    but this app's own integration form has always required choosing
 *    one; that's a stricter UI rule, not a mismatch with the backend
 *    worth relaxing here.
 */
export interface CreateIntegrationRequest {
  name: string;
  source: IntegrationSource;
  teamId: string;
  description?: string;
}

/**
 * Mirrors backend IntegrationCreatedResponse.java exactly. Fixed:
 *  - `integrationId` renamed to `id` — the backend has always sent `id`.
 *  - `apiKeyId` + `rawToken` (two fields) replaced with the single
 *    `apiKey` field the backend actually sends — neither previous name
 *    matched, so the raw key (the one and only time it's returned for
 *    an integration) was always undefined.
 *  - Removed `expiresAt` — IntegrationCreatedResponse has never had
 *    this field; integrations don't expire.
 *  - Added `source`, `description`, and `message`, all present in the
 *    backend response and previously absent here.
 *  - `teamId`/`teamName` are nullable, matching Integration above.
 */
export interface IntegrationCreatedResponse {
  id: string;
  name: string;
  source: IntegrationSource;
  teamId: string | null;
  teamName: string | null;
  apiKey: string;
  description: string | null;
  createdAt: string;
  message: string;
}