import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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
   * GET /api/v1/oncall/current
   * Returns the currently active on-call person for every role
   * (PRIMARY/SECONDARY/MANAGER), tenant-wide.
   *
   * ADMIN only — see CurrentOncall doc comment for why. Callers must
   * check authService.isAdmin() before invoking this; a RESPONDER calling
   * it will get a 403.
   *
   * Backend returns 204 No Content (empty body) when nothing is
   * configured, rather than an empty array with 200 — normalized here so
   * callers always get an array.
   */
  getAllCurrentOncall(): Observable<CurrentOncall[]> {
    return this.http.get<CurrentOncall[] | null>(`${this.baseUrl}/current`).pipe(
      map(response => response ?? [])
    );
  }
}