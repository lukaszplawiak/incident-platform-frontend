import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Team,
  TeamMember,
  CreateTeamRequest,
  AddTeamMemberRequest,
  TeamRole,
} from '../models/team.model';

@Injectable({
  providedIn: 'root'
})
export class TeamService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.authApiUrl}/api/v1/teams`;

  /** GET /api/v1/teams — list all active teams in tenant */
  listTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(this.baseUrl);
  }

  /** GET /api/v1/teams/{teamId} */
  getTeam(teamId: string): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/${teamId}`);
  }

  /** POST /api/v1/teams — create a team. ADMIN only. */
  createTeam(request: CreateTeamRequest): Observable<Team> {
    return this.http.post<Team>(this.baseUrl, request);
  }

  /** DELETE /api/v1/teams/{teamId} — archive. ADMIN only. */
  archiveTeam(teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${teamId}`);
  }

  /** POST /api/v1/teams/{teamId}/restore — restore archived team. ADMIN only. */
  restoreTeam(teamId: string): Observable<Team> {
    return this.http.post<Team>(`${this.baseUrl}/${teamId}/restore`, {});
  }

  /** GET /api/v1/teams/{teamId}/members */
  listMembers(teamId: string): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.baseUrl}/${teamId}/members`);
  }

  /** POST /api/v1/teams/{teamId}/members — add member. ADMIN only. */
  addMember(teamId: string, request: AddTeamMemberRequest): Observable<TeamMember> {
    return this.http.post<TeamMember>(`${this.baseUrl}/${teamId}/members`, request);
  }

  /**
   * PATCH /api/v1/teams/{teamId}/members/{userId}/role
   * Backend accepts teamRole as a query param, not in body.
   */
  updateMemberRole(teamId: string, userId: string, teamRole: TeamRole): Observable<TeamMember> {
    return this.http.patch<TeamMember>(
      `${this.baseUrl}/${teamId}/members/${userId}/role`,
      null,
      { params: { teamRole } }
    );
  }

  /** DELETE /api/v1/teams/{teamId}/members/{userId} — remove member. ADMIN only. */
  removeMember(teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${teamId}/members/${userId}`);
  }
}