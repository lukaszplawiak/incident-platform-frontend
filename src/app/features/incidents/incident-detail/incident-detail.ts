import { Component, OnInit, input } from '@angular/core';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { IncidentService } from '../../../core/services/incident.service';
import { TeamService } from '../../../core/services/team.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EscalationBadge } from '../../../shared/components/escalation-badge/escalation-badge';
import { UpdateStatusRequest } from '../../../core/models/incident.model';
import { Team } from '../../../core/models/team.model';
import { formatDurationMinutes } from '../../../shared/utils/format-duration';
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
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  readonly incident = this.incidentService.selectedIncident;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly auditEvents = this.incidentService.auditEvents;
  readonly auditLoading = this.incidentService.auditLoading;
  readonly postmortem = this.incidentService.postmortem;
  readonly postmortemLoading = this.incidentService.postmortemLoading;

  /** For resolving incident.teamId to a display name — see teamName(). */
  private allTeams: Team[] = [];

  ngOnInit(): void {
    const id = this.id();
    this.logger.info('Loading incident detail', { id });
    this.incidentService.loadIncident(id);
    this.incidentService.loadAuditLog(id);
    this.incidentService.loadPostmortem(id);
    this.teamService.listTeams().subscribe({
      next: teams => { this.allTeams = teams; },
      error: () => { /* non-critical — team name falls back to "—" */ }
    });
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
    return inc.allowedTransitions.includes('ACKNOWLEDGED');
  }

  get canResolve(): boolean {
    const inc = this.incident();
    if (!inc) return false;
    return inc.allowedTransitions.includes('RESOLVED');
  }

  get canClose(): boolean {
    const inc = this.incident();
    if (!inc) return false;
    return inc.allowedTransitions.includes('CLOSED');
  }

  get duration(): string {
    const inc = this.incident();
    if (!inc) return '-';

    const start = new Date(inc.createdAt);
    const end = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
    const diffMinutes = (end.getTime() - start.getTime()) / 60_000;

    return formatDurationMinutes(diffMinutes);
  }

  /** MTTA/MTTR arrive from the backend already in minutes — just format. */
  formatMinutes(minutes: number): string {
    return formatDurationMinutes(minutes);
  }

  teamName(teamId: string | null): string {
    if (!teamId) return '—';
    return this.allTeams.find(t => t.id === teamId)?.name ?? '—';
  }
}