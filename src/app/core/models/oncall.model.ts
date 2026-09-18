/**
 * Mirrors backend OncallRole (oncall-service).
 */
export type OncallRole = 'PRIMARY' | 'SECONDARY' | 'MANAGER';

export const ONCALL_ROLES: OncallRole[] = ['PRIMARY', 'SECONDARY', 'MANAGER'];

/**
 * Mirrors backend OncallScheduleStatus.java exactly — three states, not
 * a boolean active/inactive: ACTIVE, SUPERSEDED (replaced by a newer
 * entry — backlog #43), and CANCELLED (soft-deleted — backlog #44).
 * Non-ACTIVE rows are kept indefinitely for history, not purged.
 */
export type OncallScheduleStatus = 'ACTIVE' | 'SUPERSEDED' | 'CANCELLED';

/**
 * Mirrors backend OncallScheduleDto.
 *
 * teamId is nullable — null means a tenant-wide schedule entry (not
 * scoped to a specific team). Requires the OncallScheduleDto backend
 * patch adding this field; without it, teamId is always undefined in
 * real responses even though the type says otherwise.
 *
 * Fixed: status/supersedesId were missing entirely, though
 * OncallScheduleDto has sent both since backlog #43. Without status,
 * the schedules table showed every row — ACTIVE, SUPERSEDED, and
 * CANCELLED — identically, with no way to tell a currently-effective
 * entry from historical noise, and a Delete button that could be
 * clicked on an already-removed/replaced row. supersedesId is null
 * unless this row itself replaced an older one.
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
  status: OncallScheduleStatus;
  supersedesId: string | null;
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