import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditEvent, AuditEventType } from '../../../core/models/audit-event.model';

@Component({
  selector: 'app-incident-audit',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './incident-audit.html',
  styleUrl: './incident-audit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentAudit {

  @Input({ required: true }) events!: AuditEvent[];
  @Input() loading = false;

  getEventIcon(eventType: AuditEventType): string {
    const icons: Record<AuditEventType, string> = {
      'INCIDENT_CREATED':               '🆕',
      'INCIDENT_ACKNOWLEDGED':          '✅',
      'INCIDENT_RESOLVED':              '✔️',
      'INCIDENT_CLOSED':                '🔒',
      // Fixed: this type is published for the OPEN transition
      // specifically (see IncidentStatus.java — ACKNOWLEDGED/RESOLVED/
      // CLOSED each have their own dedicated type instead) — a
      // generic "status changed" icon, not reused from any of those
      // three specific ones.
      'INCIDENT_STATUS_CHANGED':        '🔄',
      'INCIDENT_ASSIGNED':              '👤',
      'INCIDENT_SEVERITY_UPDATED':      '⚠️',
      // Fixed: previously absent (backlog #7's assign-team UI) — 👥
      // distinguishes a team assignment from INCIDENT_ASSIGNED's own
      // 👤 (a single person).
      'INCIDENT_TEAM_ASSIGNED':         '👥',
      'INCIDENT_TEAM_UNASSIGNED':       '❎',
      'NOTIFICATION_SENT':              '📨',
      'NOTIFICATION_FAILED':            '❌',
      'ESCALATION_FIRED':               '🚨',
      'ESCALATION_SCHEDULED':           '⏰',
      'SLACK_ACK_MESSAGE_UPDATE_FAILED': '❌',
      'POSTMORTEM_GENERATED':           '📝',
      'POSTMORTEM_FAILED':              '❌',
      // Fixed: reuses PostmortemStatus's own 🛑 (incident-postmortem.ts,
      // backlog #4/#8) for the same "permanently failed, needs manual
      // review" meaning — same icon everywhere this state appears in
      // the app, not a different one invented for this view.
      'POSTMORTEM_PERMANENTLY_FAILED':  '🛑',
      'POSTMORTEM_UPDATED':             '✏️',
      // Fixed: reuses PostmortemStatus's own ✅ for REVIEWED — same
      // reasoning as PERMANENTLY_FAILED above.
      'POSTMORTEM_REVIEWED':            '✅'
    };
    return icons[eventType] ?? '📋';
  }

  getEventClass(eventType: AuditEventType): string {
    if (eventType.includes('FAILED')) return 'audit-event--error';
    if (eventType.includes('ESCALAT')) return 'audit-event--warning';
    // Fixed: REVIEWED added — same "positive conclusion" grouping as
    // RESOLVED/CLOSED, matching PostmortemStatus's own green for this
    // state (incident-postmortem.ts, backlog #4/#8).
    if (eventType.includes('RESOLVED') || eventType.includes('CLOSED') || eventType.includes('REVIEWED')) return 'audit-event--success';
    if (eventType.includes('ACKNOWLEDGED')) return 'audit-event--info';
    return 'audit-event--default';
  }

  formatActor(event: AuditEvent): string {
    return event.actorType === 'SYSTEM' ? '🤖 System' : `👤 ${event.actor}`;
  }
}