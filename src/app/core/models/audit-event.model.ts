export type AuditEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_ESCALATED'
  | 'INCIDENT_RESOLVED'
  | 'INCIDENT_CLOSED'
  | 'INCIDENT_ASSIGNED'
  | 'INCIDENT_SEVERITY_UPDATED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  | 'ESCALATION_FIRED'
  | 'ESCALATION_SCHEDULED'
  | 'POSTMORTEM_GENERATED'
  | 'POSTMORTEM_FAILED'
  | 'POSTMORTEM_UPDATED';

export type ActorType = 'USER' | 'SYSTEM';

export interface AuditEvent {
  id: string;
  incidentId: string;
  eventType: AuditEventType;
  actor: string;
  actorType: ActorType;
  sourceService: string;
  detail: string;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}