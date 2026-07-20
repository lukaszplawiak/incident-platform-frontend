/**
 * Mirrors backend TeamDto.
 */
export interface Team {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/**
 * Mirrors backend TeamMemberDto.
 * teamRole is a team-level role — separate from tenant-level ROLE_ADMIN/ROLE_RESPONDER.
 */
export interface TeamMember {
  userId: string;
  email: string;
  teamRole: TeamRole;
  joinedAt: string;
}

/**
 * POST /api/v1/teams
 */
export interface CreateTeamRequest {
  name: string;
  description?: string;
}

/**
 * POST /api/v1/teams/{teamId}/members
 */
export interface AddTeamMemberRequest {
  userId: string;
  teamRole: TeamRole;
}

/**
 * Team-level role — controls team-specific permissions.
 * MANAGER: can manage membership and on-call schedules for this team.
 * RESPONDER: receives and responds to incidents routed to this team.
 *
 * Separate from tenant-level roles (ROLE_ADMIN / ROLE_RESPONDER).
 * Mirrors PagerDuty's Team Manager / Responder model.
 */
export type TeamRole = 'MANAGER' | 'RESPONDER';

export const TEAM_ROLES: TeamRole[] = ['MANAGER', 'RESPONDER'];