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
 * inviteToken is a one-time token for the invited user to set their password.
 */
export interface CreateUserResponse {
  userId: string;
  email: string;
  inviteToken: string;
  expiresAt: string;
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

/** All available roles in the system. */
export const USER_ROLES = ['ROLE_ADMIN', 'ROLE_RESPONDER'] as const;
export type UserRole = typeof USER_ROLES[number];