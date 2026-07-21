/**
 * Request body for POST /api/v1/auth/login.
 * Tenant is sent as X-Tenant-Id header by the auth interceptor,
 * not as a field in the request body.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Response from POST /api/v1/auth/login.
 *
 * Two scenarios:
 * 1. MFA not required — accessToken and refreshToken are populated,
 *    mfaRequired is false, mfaToken is null.
 * 2. MFA required — mfaRequired is true, mfaToken is populated,
 *    accessToken and refreshToken are null. Client must call
 *    POST /auth/mfa/verify with mfaToken + TOTP code.
 */
export interface LoginResponse {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  tenantId: string | null;
  email: string | null;
  roles: string[] | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  mfaRequired: boolean;
  mfaToken: string | null;
  mfaExpiresAt: string | null;
}

/**
 * Request body for POST /api/v1/auth/refresh.
 */
export interface RefreshRequest {
  refreshToken: string;
}

/**
 * Response from POST /api/v1/auth/refresh.
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

/**
 * Request body for POST /api/v1/auth/mfa/verify.
 */
export interface MfaVerifyRequest {
  mfaToken: string;
  totpCode: string;
}

/**
 * JWT access token payload decoded from the accessToken.
 *
 * Standard claims (iat, exp, jti) plus custom claims
 * added by auth-service JwtUtils.
 */
export interface JwtPayload {
  /** Subject — user UUID */
  sub: string;
  /** JWT token ID — used for revocation */
  jti: string;
  tenantId: string;
  email: string;
  roles: string[];
  /** Team UUIDs the user belongs to */
  teamIds: string[];
  iat: number;
  exp: number;
}

/**
 * Request body for POST /api/v1/auth/accept-invite.
 * tenantId is embedded server-side in the invite token — not sent here.
 */
export interface AcceptInviteRequest {
  token: string;
  password: string;
}