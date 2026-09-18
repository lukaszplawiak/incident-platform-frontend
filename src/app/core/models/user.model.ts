/**
 * Mirrors backend UserSummaryDto.
 * Never includes passwordHash — that field is internal to auth-service.
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
  teamIds: string[];
  active: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/v1/users — invite a new user.
 * Backend sends an invite email with a token.
 */
export interface CreateUserRequest {
  email: string;
  /** e.g. ["ROLE_ADMIN", "ROLE_RESPONDER"] */
  roles: string[];
}

/**
 * Response from POST /api/v1/users.
 *
 * Fixed: previously { userId, email, inviteToken, expiresAt } — the
 * pre-Outbox-Pattern shape. CreateUserResponse.java no longer sends
 * either inviteToken or expiresAt: the invite email (with its one-time
 * token) is sent directly to the invited user by InviteEmailScheduler,
 * never passing through the admin's HTTP client — see that DTO's own
 * Javadoc. Verified createUser()'s subscribe handler in users.ts
 * ignores the response body entirely today (next: () => {...}), so this
 * was a dormant type error rather than a live bug — but a real one, had
 * any future code read response.inviteToken expecting a real value.
 */
export interface CreateUserResponse {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  active: boolean;
  createdAt: string;
}

/**
 * PATCH /api/v1/users/{id}/roles — replace user roles atomically.
 */
export interface UpdateUserRolesRequest {
  roles: string[];
}

/**
 * PATCH /api/v1/users/{id}/status — activate or deactivate.
 */
export interface UpdateUserStatusRequest {
  active: boolean;
}

/**
 * PATCH /api/v1/users/me/password — mirrors backend
 * ChangePasswordRequest.java exactly. No role requirement on the
 * backend — every authenticated user can change their own password.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** All available roles in the system. */
export const USER_ROLES = ['ROLE_ADMIN', 'ROLE_RESPONDER'] as const;
export type UserRole = typeof USER_ROLES[number];