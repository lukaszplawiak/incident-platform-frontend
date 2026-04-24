export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'ESCALATED'
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

  version: number;
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
  eventType: 'CREATED' | 'UPDATED' | 'STATUS_CHANGED';
  incident: Incident;
  previousStatus?: IncidentStatus;
}