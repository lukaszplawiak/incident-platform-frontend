export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'CLOSED';

export type IncidentSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  tenantId: string;
  source: string;
  sourceType: string;
  fingerprint: string;
  alertId: string;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  mttaSeconds: number | null;
  mttrSeconds: number | null;
  assignedTo: string | null;
  /**
   * How urgently this incident needs attention — independent of `status`.
   * 0 = not escalated, 1 = escalated to secondary on-call, 2 = escalated
   * to manager. Backed by `Incident.escalationLevel` in incident-service,
   * kept in sync with escalation-service's automatic timeout-driven
   * escalations via IncidentEscalationEventConsumer.
   *
   * Previously this was the 'ESCALATED' value of IncidentStatus — removed
   * because it duplicated state already owned by escalation-service and was
   * never reliably synchronized for automatic escalations.
   */
  escalationLevel: number;
  version: number;
  allowedTransitions?: IncidentStatus[];
}

export interface UpdateStatusRequest {
  status: IncidentStatus;
  comment?: string;
}

export interface IncidentFilter {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  page?: number;
  size?: number;
  sort?: SortColumn;
  direction?: SortDirection;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface IncidentWebSocketEvent {
  eventType: 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'INCIDENT_CREATED' | 'INCIDENT_STATUS_CHANGED';
  incident: Incident;
  previousStatus?: IncidentStatus;
}

export type SortColumn = 'severity' | 'status' | 'openedAt' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}