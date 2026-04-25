import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import {
  Incident,
  IncidentFilter,
  IncidentStatus,
  PageResponse,
  UpdateStatusRequest
} from '../models/incident.model';
import { AuditEvent } from '../models/audit-event.model';

@Injectable({
  providedIn: 'root'
})
export class IncidentService {

  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly apiUrl = `${environment.apiUrl}/api/v1/incidents`;

  private readonly _incidents = signal<Incident[]>([]);
  private readonly _selectedIncident = signal<Incident | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _totalElements = signal<number>(0);
  private readonly _currentPage = signal<number>(0);

  readonly incidents = this._incidents.asReadonly();
  readonly selectedIncident = this._selectedIncident.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();

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
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.severity) params = params.set('severity', filter.severity);
    if (filter?.page !== undefined) params = params.set('page', filter.page.toString());
    if (filter?.size !== undefined) params = params.set('size', filter.size.toString());

    this.http.get<PageResponse<Incident>>(this.apiUrl, { params }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this._incidents.set(response.content);
        this._totalElements.set(response.totalElements);
        this._currentPage.set(response.number);
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

    this.logger.info('Updating incident status', {
      id,
      newStatus: request.status
    });

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
        this.logger.info('Incident status updated', {
          id,
          status: updated.status
        });
      },
      error: (err: Error) => {
        this._incidents.set(previousIncidents);
        this._selectedIncident.set(previousSelected);
        this._error.set(err.message);
        this.logger.error('Failed to update incident status — rolling back', err, {
          id,
          attemptedStatus: request.status
        });
      }
    });
  }

  loadAuditLog(incidentId: string): void {
    this._loading.set(true);

    this.logger.debug('Loading audit log', { incidentId });

    this.http.get<AuditEvent[]>(
      `${this.apiUrl}/${incidentId}/audit`
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this._loading.set(false);
        this.logger.debug('Audit log loaded', { incidentId });
      },
      error: (err: Error) => {
        this._error.set(err.message);
        this._loading.set(false);
        this.logger.error('Failed to load audit log', err, { incidentId });
      }
    });
  }

  addIncident(incident: Incident): void {
    this._incidents.update(incidents => {
      const exists = incidents.some(i => i.id === incident.id);
      if (exists) return incidents;
      this.logger.debug('New incident added via WebSocket', {
        id: incident.id,
        severity: incident.severity
      });
      return [incident, ...incidents];
    });
    this._totalElements.update(count => count + 1);
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