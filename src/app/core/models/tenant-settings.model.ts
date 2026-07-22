/**
 * Mirrors backend TenantSettingsDto.
 *
 * mfaRequired: when true, every user in the tenant must have MFA
 * configured to log in. Users without it get LoginResponse.mfaSetupRequired
 * instead of a normal 401/success — see AuthService (frontend) and
 * MfaService.setupMfaWithSetupToken/enableMfaWithSetupToken (backend).
 */
export interface TenantSettings {
  tenantId: string;
  mfaRequired: boolean;
}

/** Request body for POST /api/v1/tenants/settings. */
export interface UpdateTenantSettingsRequest {
  mfaRequired: boolean;
}