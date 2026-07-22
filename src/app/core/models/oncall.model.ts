/**
 * Mirrors backend OncallRole (oncall-service).
 */
export type OncallRole = 'PRIMARY' | 'SECONDARY' | 'MANAGER';

export const ONCALL_ROLES: OncallRole[] = ['PRIMARY', 'SECONDARY', 'MANAGER'];

/**
 * Mirrors backend OncallScheduleDto.
 *
 * teamId is nullable — null means a tenant-wide schedule entry (not
 * scoped to a specific team). Requires the OncallScheduleDto backend
 * patch adding this field; without it, teamId is always undefined in
 * real responses even though the type says otherwise.
 */
export interface OncallSchedule {
  id: string;
  tenantId: string;
  teamId: string | null;
  userId: string;
  userName: string;
  email: string;
  phone: string | null;
  slackUserId: string | null;
  role: OncallRole;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
}

/**
 * POST /api/v1/oncall/schedules
 * teamId omitted/undefined means a tenant-wide schedule.
 */
export interface CreateOncallScheduleRequest {
  teamId?: string;
  userId: string;
  userName: string;
  email: string;
  phone?: string;
  slackUserId?: string;
  role: OncallRole;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

/**
 * Mirrors backend CurrentOncallResponse.
 *
 * GET /api/v1/oncall/current is restricted at the URL-security level to
 * ROLE_SERVICE and ROLE_ADMIN (see oncall-service SecurityConfig) — a
 * human user must have ROLE_ADMIN to call this. ROLE_RESPONDER can browse
 * the full schedule list (GET /schedules) but cannot see this "who's on
 * call right now" snapshot. OncallPanel gates the section that calls this
 * behind authService.isAdmin() accordingly.
 */
export interface CurrentOncall {
  userId: string;
  userName: string;
  email: string;
  teamId: string | null;
  phone: string | null;
  slackUserId: string | null;
  role: OncallRole;
  shiftEndsAt: string;
}