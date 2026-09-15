import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import {
  Incident,
  IncidentFilter,
  IncidentStatus,
  PageResponse,
  UpdateStatusRequest,
  AssignIncidentRequest,
  AssignTeamRequest,
  SortColumn,
  SortDirection,
  SortState
} from '../models/incident.model';
import { AuditEvent } from '../models/audit-event.model';
import { Postmortem } from '../models/postmortem.model';

@Injectable({
  providedIn: 'root'
})
export class IncidentService {

  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);

  private readonly apiUrl = `${environment.apiUrl}/api/v1/incidents`;

  private readonly _incidents = signal<Incident[]>([]);
  private readonly _selectedIncident = signal<Incident | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _totalElements = signal<number>(0);
  private readonly _totalPages = signal<number>(0);
  private readonly _currentPage = signal<number>(0);
  private readonly _auditEvents = signal<AuditEvent[]>([]);
  private readonly _auditLoading = signal<boolean>(false);
  private readonly _postmortem = signal<Postmortem | null>(null);
  private readonly _postmortemLoading = signal<boolean>(false);
  private readonly _sortState = signal<SortState | null>(null);

  readonly incidents = this._incidents.asReadonly();
  readonly selectedIncident = this._selectedIncident.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly auditEvents = this._auditEvents.asReadonly();
  readonly auditLoading = this._auditLoading.asReadonly();
  readonly postmortem = this._postmortem.asReadonly();
  readonly postmortemLoading = this._postmortemLoading.asReadonly();
  readonly sortState = this._sortState.asReadonly();

  readonly criticalCount = computed(() =>
    this._incidents().filter(i => i.severity === 'CRITICAL').length
  );
  readonly openCount = computed(() =>
    this._incidents().filter(i => i.status === 'OPEN').length
  );
  readonly hasError = computed(() => this._error() !== null);

  loadIncidents(filter?: IncidentFilter): void {
    this._loading.set(true);
    this._error.set(null);

    this.logger.debug('Loading incidents', { filter });

    let params = new HttpParams();
    if (filter?.status)    params = params.set('status', filter.status);
    if (filter?.severity)  params = params.set('severity', filter.severity);
    if (filter?.page !== undefined) params = params.set('page', filter.page.toString());
    if (filter?.size !== undefined) params = params.set('size', filter.size.toString());
    if (filter?.sort)      params = params.set('sort', filter.sort);
    if (filter?.direction) params = params.set('direction', filter.direction);

    this.http.get<PageResponse<Incident>>(this.apiUrl, { params }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this._incidents.set(response.content);
        this._totalElements.set(response.totalElements);
        this._totalPages.set(response.totalPages);
        this._currentPage.set(response.page);
        this._loading.set(false);
        this.logger.debug('Incidents loaded', {
          count: response.content.length,
          total: response.totalElements
        });
      },
      error: (err: Error) => {
        this._error.set(err.message);
        this._loading.set(false);
        this.logger.error('Failed to load incidents', err);
      }
    });
  }

  loadIncident(id: string): void {
    this._loading.set(true);
    this._error.set(null);

    this.logger.debug('Loading incident', { id });

    this.http.get<Incident>(`${this.apiUrl}/${id}`).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (incident) => {
        this._selectedIncident.set(incident);
        this._loading.set(false);
        this.logger.debug('Incident loaded', { id });
      },
      error: (err: Error) => {
        this._error.set(err.message);
        this._loading.set(false);
        this.logger.error('Failed to load incident', err, { id });
      }
    });
  }

  updateStatus(id: string, request: UpdateStatusRequest): void {
    const previousIncidents = this._incidents();
    const previousSelected = this._selectedIncident();

    this.applyOptimisticUpdate(id, request.status);

    this.logger.info('Updating incident status', { id, newStatus: request.status });

    this.http.patch<Incident>(
      `${this.apiUrl}/${id}/status`,
      request
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this._incidents.update(incidents =>
          incidents.map(i => i.id === updated.id ? updated : i)
        );
        if (this._selectedIncident()?.id === updated.id) {
          this._selectedIncident.set(updated);
        }
        this.toastService.success(`Status updated to ${updated.status}`);
        this.logger.info('Incident status updated', { id, status: updated.status });
      },
      error: (err: Error) => {
        this._incidents.set(previousIncidents);
        this._selectedIncident.set(previousSelected);
        this._error.set(err.message);
        this.toastService.error(err.message);
        this.logger.error('Failed to update incident status — rolling back', err, {
          id,
          attemptedStatus: request.status
        });
      }
    });
  }

  /**
   * PATCH /{id}/assignee — assigns the incident to a user. Backend
   * accepts any userId (ROLE_RESPONDER/ROLE_ADMIN only) — this service
   * doesn't further restrict which users can be chosen; the calling
   * component decides where its candidate list comes from.
   *
   * No optimistic update, unlike updateStatus — there's no single
   * "obviously correct" value to show immediately (the display name for
   * a bare userId isn't available client-side), so this simply waits
   * for the real response.
   */
  assignIncident(id: string, request: AssignIncidentRequest): void {
    this.logger.info('Assigning incident', { id, userId: request.userId });

    this.http.patch<Incident>(
      `${this.apiUrl}/${id}/assignee`,
      request
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this._incidents.update(incidents =>
          incidents.map(i => i.id === updated.id ? updated : i)
        );
        if (this._selectedIncident()?.id === updated.id) {
          this._selectedIncident.set(updated);
        }
        this.toastService.success('Incident assigned');
        this.logger.info('Incident assigned', { id, userId: request.userId });
      },
      error: (err: Error) => {
        this.toastService.error(err.message);
        this.logger.error('Failed to assign incident', err, {
          id, userId: request.userId
        });
      }
    });
  }

  /**
   * PATCH /{id}/team — assigns a team to the incident. Backend requires
   * the caller be a member of the target team unless ROLE_ADMIN,
   * returning 403 otherwise — surfaced here the same way any other
   * error is, via the toast in the error branch below.
   */
  assignTeam(id: string, request: AssignTeamRequest): void {
    this.logger.info('Assigning team to incident', { id, teamId: request.teamId });

    this.http.patch<Incident>(
      `${this.apiUrl}/${id}/team`,
      request
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this._incidents.update(incidents =>
          incidents.map(i => i.id === updated.id ? updated : i)
        );
        if (this._selectedIncident()?.id === updated.id) {
          this._selectedIncident.set(updated);
        }
        this.toastService.success('Team assigned');
        this.logger.info('Team assigned to incident', { id, teamId: request.teamId });
      },
      error: (err: Error) => {
        this.toastService.error(err.message);
        this.logger.error('Failed to assign team', err, {
          id, teamId: request.teamId
        });
      }
    });
  }

  /**
   * DELETE /{id}/team — removes the incident's team assignment. Same
   * membership restriction as assignTeam, applied to the incident's
   * current team.
   */
  unassignTeam(id: string): void {
    this.logger.info('Unassigning team from incident', { id });

    this.http.delete<Incident>(
      `${this.apiUrl}/${id}/team`
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this._incidents.update(incidents =>
          incidents.map(i => i.id === updated.id ? updated : i)
        );
        if (this._selectedIncident()?.id === updated.id) {
          this._selectedIncident.set(updated);
        }
        this.toastService.success('Team unassigned');
        this.logger.info('Team unassigned from incident', { id });
      },
      error: (err: Error) => {
        this.toastService.error(err.message);
        this.logger.error('Failed to unassign team', err, { id });
      }
    });
  }

  loadAuditLog(incidentId: string): void {
    this._auditLoading.set(true);

    this.logger.debug('Loading audit log', { incidentId });

    this.http.get<AuditEvent[]>(
      `${this.apiUrl}/${incidentId}/audit`
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (events) => {
        this._auditEvents.set(events);
        this._auditLoading.set(false);
        this.logger.debug('Audit log loaded', { incidentId, count: events.length });
      },
      error: (err: Error) => {
        this._error.set(err.message);
        this._auditLoading.set(false);
        this.logger.error('Failed to load audit log', err, { incidentId });
      }
    });
  }

  loadPostmortem(incidentId: string): void {
    this._postmortemLoading.set(true);
    this.logger.debug('Loading postmortem', { incidentId });

    this.http.get<Postmortem>(
      `${environment.apiUrl}/api/v1/postmortems/incident/${incidentId}`
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (postmortem) => {
        this._postmortem.set(postmortem);
        this._postmortemLoading.set(false);
        this.logger.debug('Postmortem loaded', { incidentId });
      },
      error: () => {
        this._postmortemLoading.set(false);
        this.logger.debug('Postmortem not available', { incidentId });
      }
    });
  }

  getSortParams(column: SortColumn): { sort: SortColumn; direction: SortDirection } {
    const current = this._sortState();

    const direction: SortDirection =
      current?.column === column && current.direction === 'asc'
        ? 'desc'
        : 'asc';

    this._sortState.set({ column, direction });

    this.logger.debug('Sort params updated', { column, direction });

    return { sort: column, direction };
  }

  addIncident(incident: Incident): void {
    const exists = this._incidents().some(i => i.id === incident.id);
    if (exists) return;

    this._incidents.update(incidents => [incident, ...incidents]);
    this._totalElements.update(count => count + 1);
    this.logger.debug('New incident added via WebSocket', {
      id: incident.id,
      severity: incident.severity
    });
  }

  updateIncident(incident: Incident): void {
    this._incidents.update(incidents =>
      incidents.map(i => i.id === incident.id ? incident : i)
    );
    if (this._selectedIncident()?.id === incident.id) {
      this._selectedIncident.set(incident);
    }
    this.logger.debug('Incident updated via WebSocket', {
      id: incident.id,
      status: incident.status
    });
  }

  clearError(): void {
    this._error.set(null);
  }

  private applyOptimisticUpdate(id: string, newStatus: IncidentStatus): void {
    this._incidents.update(incidents =>
      incidents.map(i => i.id === id ? { ...i, status: newStatus } : i)
    );
    const selected = this._selectedIncident();
    if (selected?.id === id) {
      this._selectedIncident.set({ ...selected, status: newStatus });
    }
  }
}