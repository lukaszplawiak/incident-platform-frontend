import { Component, OnInit, Input } from '@angular/core';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { IncidentService } from '../../../core/services/incident.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { UpdateStatusRequest, IncidentStatus } from '../../../core/models/incident.model';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [DatePipe, SeverityBadge, StatusBadge],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.scss'
})
export class IncidentDetail implements OnInit {

  @Input() id!: string;

  private readonly incidentService = inject(IncidentService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  readonly incident = this.incidentService.selectedIncident;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;

  ngOnInit(): void {
    if (!this.id) {
      this.logger.warn('IncidentDetail: no id provided — redirecting');
      this.router.navigate(['/incidents']);
      return;
    }
    this.logger.info('Loading incident detail', { id: this.id });
    this.incidentService.loadIncident(this.id);
  }

  onAcknowledge(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'ACKNOWLEDGED' };
    this.incidentService.updateStatus(this.id, request);
  }

  onResolve(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'RESOLVED' };
    this.incidentService.updateStatus(this.id, request);
  }

  onClose(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'CLOSED' };
    this.incidentService.updateStatus(this.id, request);
  }

  onBack(): void {
    this.router.navigate(['/incidents']);
  }

  get canAcknowledge(): boolean {
    const status = this.incident()?.status;
    return status === 'OPEN' || status === 'ESCALATED';
  }

  get canResolve(): boolean {
    const status = this.incident()?.status;
    return status === 'OPEN' ||
           status === 'ACKNOWLEDGED' ||
           status === 'ESCALATED';
  }

  get canClose(): boolean {
    return this.incident()?.status === 'RESOLVED';
  }

  get duration(): string {
    const inc = this.incident();
    if (!inc) return '-';

    const start = new Date(inc.openedAt);
    const end = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60_000);

    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  isValidStatus(value: string): value is IncidentStatus {
    return ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'CLOSED']
      .includes(value);
  }
}