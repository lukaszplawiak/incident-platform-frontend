import { Component, OnInit, input } from '@angular/core';
import { inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { IncidentService } from '../../../core/services/incident.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EscalationBadge } from '../../../shared/components/escalation-badge/escalation-badge';
import { UpdateStatusRequest } from '../../../core/models/incident.model';
import { Team, TeamMember } from '../../../core/models/team.model';
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

  readonly authService = inject(AuthService);
  readonly canManageIncidents = this.authService.canManageIncidents;

  readonly incident = this.incidentService.selectedIncident;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly auditEvents = this.incidentService.auditEvents;
  readonly auditLoading = this.incidentService.auditLoading;
  readonly postmortem = this.incidentService.postmortem;
  readonly postmortemLoading = this.incidentService.postmortemLoading;

  /**
   * Backs both teamName() below and the assign-team select in the
   * template — was previously a private, non-reactive field used only
   * for teamName(); made a public signal so the same data can also
   * populate the new assign-team dropdown, rather than fetching or
   * storing the team list twice.
   */
  readonly teams = signal<Team[]>([]);

  /**
   * Candidate list for the assign-user select. Deliberately the
   * incident's own team's members (GET /teams/{teamId}/members) rather
   * than a global GET /users call: that endpoint requires ROLE_ADMIN on
   * the backend, but assigning an incident only requires
   * RESPONDER-or-ADMIN — a plain responder would have gotten a silent
   * 403 building this list, leaving the dropdown empty with no
   * indication why. Team membership also has no page-size limit to
   * silently truncate against, unlike a tenant-wide user list would.
   * See incidentTeamId below for how this reacts to the incident's team
   * changing.
   */
  readonly teamMembers = signal<TeamMember[]>([]);

  /** Bound to the two select elements in the template. */
  readonly selectedAssigneeId = signal<string>('');
  readonly selectedTeamId = signal<string>('');

  /**
   * Isolates just the team id from the incident signal, so the effect
   * below only re-fetches team members when the team actually changes —
   * not on every incident update (status change, WebSocket refresh,
   * etc.), which would happen if the effect read incident() directly,
   * since _selectedIncident.set(...) always sets a new object reference
   * even when teamId itself is unchanged.
   */
  private readonly incidentTeamId = computed(() => this.incident()?.teamId ?? null);

  constructor() {
    effect(() => {
      const teamId = this.incidentTeamId();
      if (!teamId) {
        this.teamMembers.set([]);
        return;
      }
      this.teamService.listMembers(teamId).subscribe({
        next: members => { this.teamMembers.set(members); },
        error: () => { this.teamMembers.set([]); }
      });
    });
  }

  ngOnInit(): void {
    const id = this.id();
    this.logger.info('Loading incident detail', { id });
    this.incidentService.loadIncident(id);
    this.incidentService.loadAuditLog(id);
    this.incidentService.loadPostmortem(id);
    this.teamService.listTeams().subscribe({
      next: teams => { this.teams.set(teams); },
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

  onAssign(): void {
    const userId = this.selectedAssigneeId();
    if (!this.incident() || !userId) return;
    this.incidentService.assignIncident(this.id(), { userId });
    this.selectedAssigneeId.set('');
  }

  onAssignTeam(): void {
    const teamId = this.selectedTeamId();
    if (!this.incident() || !teamId) return;
    this.incidentService.assignTeam(this.id(), { teamId });
    this.selectedTeamId.set('');
  }

  onUnassignTeam(): void {
    if (!this.incident()) return;
    this.incidentService.unassignTeam(this.id());
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
    return this.teams().find(t => t.id === teamId)?.name ?? '—';
  }

  /**
   * incident.assignedTo is a bare userId — resolves it to an email via
   * the current team's member list. Known limitation: if the assignee
   * was set before the incident's team changed (or was later removed
   * from the team), they won't be in teamMembers() anymore and this
   * falls back to "—" even though assignedTo itself still has a value —
   * accepted here rather than fetching a second, separate data source
   * just to cover that edge case.
   */
  assigneeName(userId: string | null): string {
    if (!userId) return '—';
    return this.teamMembers().find(m => m.userId === userId)?.email ?? '—';
  }
}