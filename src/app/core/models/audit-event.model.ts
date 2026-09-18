/**
 * Mirrors the subset of backend AuditEventTypes.java that
 * GET /incidents/{id}/audit can actually return — not every constant in
 * that class. Verified directly: AuditQueryService.getAuditLog() queries
 * findByTenantIdAndIncidentIdOrderByOccurredAtAsc, filtered to a specific
 * incidentId — confirmed by grepping every production (non-test) call
 * site of AuditEventTypes across the whole backend for which constants
 * are ever published with an incidentId as the resourceId. Types like
 * USER_LOGIN, TEAM_CREATED, MFA_ENABLED, API_KEY_CREATED etc. are
 * published with a userId/teamId/apiKeyId as resourceId instead, so they
 * can never appear in this endpoint's response and were deliberately
 * left out rather than copied in "just in case".
 *
 * Fixed:
 *  - Removed INCIDENT_ESCALATED — declared in AuditEventTypes.java but
 *    never actually published anywhere in production code (confirmed:
 *    zero matches across the whole backend, including tests). A type
 *    the backend can never send has no place here regardless of how
 *    plausible the name sounds.
 *  - Added the six types genuinely reachable but previously missing:
 *    INCIDENT_STATUS_CHANGED (published for the OPEN transition
 *    specifically — see IncidentStatus.java, whose ACKNOWLEDGED/
 *    RESOLVED/CLOSED transitions each have their own dedicated type
 *    instead), INCIDENT_TEAM_ASSIGNED/INCIDENT_TEAM_UNASSIGNED (backlog
 *    #7), POSTMORTEM_PERMANENTLY_FAILED/POSTMORTEM_REVIEWED (backlog
 *    #4/#8), and SLACK_ACK_MESSAGE_UPDATE_FAILED.
 */
export type AuditEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_RESOLVED'
  | 'INCIDENT_CLOSED'
  | 'INCIDENT_STATUS_CHANGED'
  | 'INCIDENT_ASSIGNED'
  | 'INCIDENT_SEVERITY_UPDATED'
  | 'INCIDENT_TEAM_ASSIGNED'
  | 'INCIDENT_TEAM_UNASSIGNED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  | 'ESCALATION_FIRED'
  | 'ESCALATION_SCHEDULED'
  | 'SLACK_ACK_MESSAGE_UPDATE_FAILED'
  | 'POSTMORTEM_GENERATED'
  | 'POSTMORTEM_FAILED'
  | 'POSTMORTEM_PERMANENTLY_FAILED'
  | 'POSTMORTEM_UPDATED'
  | 'POSTMORTEM_REVIEWED';

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