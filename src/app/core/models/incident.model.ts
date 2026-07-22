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

/**
 * Mirrors backend IncidentDto exactly — field names, nullability, and
 * presence were verified against IncidentDto.java, not assumed. Fixed
 * several drifted fields found doing that check (see git history on this
 * interface for the fuller explanation):
 *
 * - `fingerprint` removed — IncidentDto deliberately never sends it
 *   ("Exposing internal identifiers through a public API surface is poor
 *   design", per the backend's own Javadoc). It was always undefined here.
 * - `openedAt` removed — no such field exists on IncidentDto. Replaced
 *   with the two real fields backend actually has: `alertFiredAt` (when
 *   the underlying alert fired) and `createdAt` (when the incident record
 *   was created — used as the "age"/"duration" anchor, matching the
 *   backend's own default sort field).
 * - `mttaSeconds`/`mttrSeconds` renamed to `mttaMinutes`/`mttrMinutes` —
 *   backend sends minutes under those names, not seconds under these.
 * - `version` removed — exists on the JPA entity for optimistic locking
 *   but IncidentDto never returns it; there was no real value behind it.
 * - `teamId` added — was missing despite the backend having sent it since
 *   before this fix.
 * - `allowedTransitions` changed from optional to required — IncidentFsm.
 *   getAllowedTransitions() always returns a Set, backend always sends it.
 */
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  tenantId: string;
  source: string;
  sourceType: string;
  alertId: string;
  assignedTo: string | null;
  teamId: string | null;
  /** When the underlying alert fired — may predate `createdAt` if ingestion lagged. Nullable: not every incident has a linked alert. */
  alertFiredAt: string | null;
  /** When this incident record was created. Anchor for age/duration display — matches the backend's default sort field. */
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  /** Mean time to acknowledge, in minutes. Null until the incident is acknowledged. */
  mttaMinutes: number | null;
  /** Mean time to resolve, in minutes. Null until the incident is resolved. */
  mttrMinutes: number | null;
  /**
   * How urgently this incident needs attention — independent of `status`.
   * 0 = not escalated, 1 = escalated to secondary on-call, 2 = escalated
   * to manager. Backed by `Incident.escalationLevel` in incident-service.
   *
   * Previously this was the 'ESCALATED' value of IncidentStatus — removed
   * because it duplicated state already owned by escalation-service and was
   * never reliably synchronized for automatic escalations.
   */
  escalationLevel: number;

  allowedTransitions: IncidentStatus[];
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
  /**
   * Zero-based current page index.
   *
   * Named "page" to match shared.dto.PagedResponse's actual wire field —
   * backend serializes this as "page", not "number" (Spring Data's Page<T>
   * would serialize as "number" if returned directly, but every controller
   * here wraps it in PagedResponse.of(page) specifically to avoid leaking
   * that Spring Data-specific shape). Previously named "number" here,
   * which never matched any real response and left currentPage always
   * undefined — see incident.service.ts history for the fix.
   */
  page: number;
  first: boolean;
  last: boolean;
}

export interface IncidentWebSocketEvent {
  eventType:
    | 'CREATED' | 'INCIDENT_CREATED'
    | 'UPDATED' | 'STATUS_CHANGED' | 'INCIDENT_STATUS_CHANGED'
    | 'INCIDENT_UPDATED';
  incident: Incident;
  previousStatus?: IncidentStatus;
}

export type SortColumn = 'severity' | 'status' | 'createdAt' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}