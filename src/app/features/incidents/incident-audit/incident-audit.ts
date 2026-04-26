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
      'INCIDENT_CREATED':          '🆕',
      'INCIDENT_ACKNOWLEDGED':     '✅',
      'INCIDENT_ESCALATED':        '🔺',
      'INCIDENT_RESOLVED':         '✔️',
      'INCIDENT_CLOSED':           '🔒',
      'INCIDENT_ASSIGNED':         '👤',
      'INCIDENT_SEVERITY_UPDATED': '⚠️',
      'NOTIFICATION_SENT':         '📨',
      'NOTIFICATION_FAILED':       '❌',
      'ESCALATION_FIRED':          '🚨',
      'ESCALATION_SCHEDULED':      '⏰',
      'POSTMORTEM_GENERATED':      '📝',
      'POSTMORTEM_FAILED':         '❌',
      'POSTMORTEM_UPDATED':        '✏️'
    };
    return icons[eventType] ?? '📋';
  }

  getEventClass(eventType: AuditEventType): string {
    if (eventType.includes('FAILED')) return 'audit-event--error';
    if (eventType.includes('ESCALAT')) return 'audit-event--warning';
    if (eventType.includes('RESOLVED') || eventType.includes('CLOSED')) return 'audit-event--success';
    if (eventType.includes('ACKNOWLEDGED')) return 'audit-event--info';
    return 'audit-event--default';
  }

  formatActor(event: AuditEvent): string {
    return event.actorType === 'SYSTEM' ? '🤖 System' : `👤 ${event.actor}`;
  }
}