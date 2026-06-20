import { Component, OnInit, input } from '@angular/core';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { IncidentService } from '../../../core/services/incident.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EscalationBadge } from '../../../shared/components/escalation-badge/escalation-badge';
import { UpdateStatusRequest } from '../../../core/models/incident.model';
import { IncidentAudit } from '../incident-audit/incident-audit';
import { IncidentPostmortem } from '../incident-postmortem/incident-postmortem';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [DatePipe, SeverityBadge, StatusBadge, EscalationBadge, IncidentAudit, IncidentPostmortem],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.scss'
})
export class IncidentDetail implements OnInit {

  readonly id = input.required<string>();

  private readonly incidentService = inject(IncidentService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  readonly incident = this.incidentService.selectedIncident;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly auditEvents = this.incidentService.auditEvents;
  readonly auditLoading = this.incidentService.auditLoading;
  readonly postmortem = this.incidentService.postmortem;
  readonly postmortemLoading = this.incidentService.postmortemLoading;

  ngOnInit(): void {
    const id = this.id();
    this.logger.info('Loading incident detail', { id });
    this.incidentService.loadIncident(id);
    this.incidentService.loadAuditLog(id);
    this.incidentService.loadPostmortem(id);
  }

  onAcknowledge(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'ACKNOWLEDGED' };
    this.incidentService.updateStatus(this.id(), request);
  }

  onResolve(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'RESOLVED' };
    this.incidentService.updateStatus(this.id(), request);
  }

  onClose(): void {
    if (!this.incident()) return;
    const request: UpdateStatusRequest = { status: 'CLOSED' };
    this.incidentService.updateStatus(this.id(), request);
  }

  onBack(): void {
    this.router.navigate(['/incidents']);
  }

  get canAcknowledge(): boolean {
    const inc = this.incident();
    if (!inc) return false;
    if (inc.allowedTransitions) {
      return inc.allowedTransitions.includes('ACKNOWLEDGED');
    }
    // Fallback only applies when the backend didn't send allowedTransitions.
    // escalationLevel no longer affects this — an escalated incident can be
    // ACKNOWLEDGED regardless of its level.
    return inc.status === 'OPEN';
  }

  get canResolve(): boolean {
    const inc = this.incident();
    if (!inc) return false;
    if (inc.allowedTransitions) {
      return inc.allowedTransitions.includes('RESOLVED');
    }
    return inc.status === 'ACKNOWLEDGED';
  }

  get canClose(): boolean {
    const inc = this.incident();
    if (!inc) return false;
    if (inc.allowedTransitions) {
      return inc.allowedTransitions.includes('CLOSED');
    }
    return inc.status === 'RESOLVED';
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
}