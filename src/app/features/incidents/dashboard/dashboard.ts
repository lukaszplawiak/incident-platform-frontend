import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { IncidentService } from '../../../core/services/incident.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { IncidentList } from '../incident-list/incident-list';
import { UpdateStatusRequest } from '../../../core/models/incident.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IncidentList],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {

  private readonly incidentService = inject(IncidentService);
  private readonly wsService = inject(WebSocketService);
  private readonly authService = inject(AuthService);
  private readonly logger = inject(LoggerService);

  readonly incidents = this.incidentService.incidents;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly totalElements = this.incidentService.totalElements;
  readonly criticalCount = this.incidentService.criticalCount;
  readonly openCount = this.incidentService.openCount;
  readonly wsState = this.wsService.connectionState;

  readonly pageTitle = computed(() => {
    const open = this.openCount();
    return open > 0 ? `(${open}) Incident Platform` : 'Incident Platform';
  });

  readonly userId = this.authService.userId;

  ngOnInit(): void {
    this.logger.info('Dashboard initialized — loading incidents and connecting WebSocket');
    this.incidentService.loadIncidents();
    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
    this.logger.info('Dashboard destroyed — WebSocket disconnected');
  }

  onAcknowledge(incidentId: string): void {
    this.logger.info('Acknowledging incident', { incidentId });
    const request: UpdateStatusRequest = { status: 'ACKNOWLEDGED' };
    this.incidentService.updateStatus(incidentId, request);
  }

  onResolve(incidentId: string): void {
    this.logger.info('Resolving incident', { incidentId });
    const request: UpdateStatusRequest = { status: 'RESOLVED' };
    this.incidentService.updateStatus(incidentId, request);
  }

  onRefresh(): void {
    this.logger.debug('Manual refresh triggered');
    this.incidentService.loadIncidents();
  }

  onLogout(): void {
    this.logger.info('User logout initiated');
    this.wsService.disconnect();
    this.authService.logout();
  }

  onDismissError(): void {
    this.incidentService.clearError();
  }
}