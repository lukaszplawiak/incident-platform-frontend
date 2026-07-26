import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/incident.model';
import {
  OncallSchedule,
  CreateOncallScheduleRequest,
  CurrentOncall,
} from '../models/oncall.model';

@Injectable({
  providedIn: 'root'
})
export class OncallService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.oncallApiUrl}/api/v1/oncall`;

  /**
   * GET /api/v1/oncall/schedules
   * Paginated list of schedule entries. ROLE_RESPONDER or ROLE_ADMIN.
   */
  listSchedules(page = 0, size = 20): Observable<PageResponse<OncallSchedule>> {
    return this.http.get<PageResponse<OncallSchedule>>(`${this.baseUrl}/schedules`, {
      params: { page: page.toString(), size: size.toString(), sort: 'startsAt' }
    });
  }

  /**
   * POST /api/v1/oncall/schedules
   * Creates a new on-call schedule entry. ADMIN only.
   * Backend returns 409 if the new entry overlaps an existing one for the
   * same role.
   */
  createSchedule(request: CreateOncallScheduleRequest): Observable<OncallSchedule> {
    return this.http.post<OncallSchedule>(`${this.baseUrl}/schedules`, request);
  }

  /**
   * DELETE /api/v1/oncall/schedules/{id}
   * ADMIN only.
   */
  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/schedules/${id}`);
  }

  /**
   * GET /api/v1/oncall/current/all?teamId={teamId}
   * Returns every current on-call person (all roles: PRIMARY/SECONDARY/
   * MANAGER) for one specific team.
   *
   * ROLE_RESPONDER or ROLE_ADMIN — any authenticated platform user can see
   * who's on call for a team, matching PagerDuty's own permission model
   * (viewing on-call is broadly available; only managing schedules is
   * restricted to admins). See oncall-service SecurityConfig.
   *
   * Deliberately NOT calling the tenant-wide GET /api/v1/oncall/current
   * (no teamId) — that endpoint aggregates every team at once and stays
   * ROLE_SERVICE/ROLE_ADMIN only at the backend; its own Javadoc documents
   * it as being for internal service-to-service calls (notification-
   * service, escalation-service), not end-user UI. This page previously
   * called it anyway (with the whole section gated behind isAdmin() to
   * paper over the mismatch) — using the correctly-scoped, correctly-
   * permissioned endpoint here removes the need for that.
   * Backend always returns 200 with a (possibly empty) array — unlike
   * GET /current, this endpoint never returns 204 No Content.
   */
  getAllCurrentOncallForTeam(teamId: string): Observable<CurrentOncall[]> {
    return this.http.get<CurrentOncall[]>(`${this.baseUrl}/current/all`, {
      params: { teamId }
    });
  }
}