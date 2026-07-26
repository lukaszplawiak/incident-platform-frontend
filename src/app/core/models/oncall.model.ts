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
 * Fetched via GET /api/v1/oncall/current/all?teamId={teamId} —
 * ROLE_RESPONDER or ROLE_ADMIN. Every authenticated user can see who is
 * currently on call for a given team; only managing schedules
 * (create/delete) requires ROLE_ADMIN. See OncallService and
 * oncall-service's SecurityConfig for the full reasoning.
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