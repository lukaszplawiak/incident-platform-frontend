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
  mfaSetupRequired: boolean;
  mfaSetupToken: string | null;
  mfaSetupExpiresAt: string | null;
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

/**
 * Request body for POST /api/v1/auth/forgot-password.
 * tenantId is sent separately as X-Tenant-Id header — see AuthService.
 * ForgotPasswordService looks the user up by email *and* tenantId, since
 * the same email can exist in more than one tenant.
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Request body for POST /api/v1/auth/reset-password.
 *
 * Deliberately no tenantId field: PasswordService.resetPassword() accepts
 * a tenantId parameter but never reads it — the reset token alone
 * identifies the user (confirmed by reading the service implementation,
 * not just the controller signature).
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Response from POST /api/v1/auth/mfa/setup.
 * qrUrl is an otpauth:// URI — render it as a QR code client-side only
 * (see mfa-settings.ts). It embeds the raw TOTP secret, so it must never
 * be sent to any third party (e.g. a public "QR code generator" API) —
 * doing so would leak the secret to that service.
 */
export interface MfaSetupResponse {
  qrUrl: string;
  /** Base32 secret for manual entry when the QR can't be scanned. Shown once. */
  secret: string;
}

/** Request body for POST /api/v1/auth/mfa/enable. */
export interface MfaEnableRequest {
  totpCode: string;
}

/**
 * Response from POST /api/v1/auth/mfa/enable.
 * backupCodes are shown exactly once — the backend never returns them
 * again after this call. The UI must make the user explicitly confirm
 * they've saved them before moving on.
 */
export interface MfaEnableResponse {
  backupCodes: string[];
  message: string;
}

/**
 * Request body for POST /api/v1/auth/mfa/disable.
 * Requires both password and a current TOTP code — a stolen session
 * token alone cannot turn MFA off.
 */
export interface MfaDisableRequest {
  password: string;
  totpCode: string;
}

/**
 * Request body for POST /api/v1/auth/mfa/verify-backup — login recovery
 * when the authenticator app is unavailable. Sibling to MfaVerifyRequest;
 * used from the same mfa-verify screen via a "use a backup code instead"
 * toggle.
 */
export interface MfaVerifyBackupRequest {
  mfaToken: string;
  backupCode: string;
}

/** Response from GET /api/v1/auth/mfa/backup-codes. */
export interface MfaBackupCodesStatus {
  remainingCodes: number;
  mfaEnabledAt: string;
}
/**
 * Request body for POST /api/v1/auth/mfa/setup-required.
 *
 * Tenant-required-MFA login flow: the user has no access token (login was
 * blocked pending MFA setup — see LoginResponse.mfaSetupRequired), so the
 * mfaSetupToken from that response identifies them instead of a Bearer
 * token. Public endpoint like verifyMfa/verifyMfaBackup.
 */
export interface MfaSetupRequiredRequest {
  mfaSetupToken: string;
}

/**
 * Request body for POST /api/v1/auth/mfa/enable-required.
 * Same mfaSetupToken as MfaSetupRequiredRequest, plus the confirmation code.
 */
export interface MfaEnableRequiredRequest {
  mfaSetupToken: string;
  totpCode: string;
}

/**
 * Response from POST /api/v1/auth/mfa/enable-required.
 *
 * Bundles the same one-time backup codes as MfaEnableResponse with a
 * completed LoginResponse — this call both enables MFA *and* finishes the
 * login that was blocked pending setup.
 */
export interface MfaEnableWithLoginResponse {
  backupCodes: string[];
  login: LoginResponse;
}