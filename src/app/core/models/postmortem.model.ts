import { IncidentSeverity } from './incident.model';

/**
 * Mirrors backend PostmortemStatus.java exactly — verified against that
 * enum, not assumed. Fixed: previously missing PERMANENTLY_FAILED (the
 * status set once the retry scheduler exhausts all attempts) — with it
 * absent from this union, a postmortem in that state matched none of
 * the @if branches in incident-postmortem.html, rendering a blank page
 * with an undefined status label instead of any indication that manual
 * intervention was needed.
 */
export type PostmortemStatus =
  | 'GENERATING'
  | 'DRAFT'
  | 'FAILED'
  | 'PERMANENTLY_FAILED'
  | 'REVIEWED';

/**
 * Mirrors backend PostmortemDto.java exactly — field names, types, and
 * nullability were verified against that record and against
 * Postmortem.java's own @NotNull/nullable annotations, not assumed.
 *
 * Fixed: this interface previously declared seven separate content
 * fields (summary, timeline, rootCause, impact, resolution, actionItems,
 * lessonsLearned) that the backend has never sent — PostmortemDto has
 * always stored the AI-generated report as a single markdown block in
 * one field, `content`. None of those seven fields were ever populated,
 * so every @if in incident-postmortem.html that depended on one of them
 * was always false — the entire generated postmortem report was
 * invisible in the UI regardless of status. Also previously missing:
 * errorMessage (the real reason a generation attempt failed, distinct
 * from the generic static message the template showed instead) and
 * incidentTitle/incidentSeverity/incidentOpenedAt/incidentResolvedAt/
 * durationMinutes (context PostmortemDto has always included). Also
 * previously present but not real: generatedAt/reviewedAt, which
 * PostmortemDto has never had — createdAt/updatedAt are the only
 * timestamps this DTO actually carries.
 */
export interface Postmortem {
  id: string;
  incidentId: string;
  tenantId: string;

  // Always present — @NotNull/nullable = false on every one of these in
  // Postmortem.java.
  incidentTitle: string;
  incidentSeverity: IncidentSeverity;
  incidentOpenedAt: string;
  incidentResolvedAt: string;
  durationMinutes: number;
  status: PostmortemStatus;
  createdAt: string;
  updatedAt: string;

  // Genuinely nullable — no @NotNull, no nullable = false, in
  // Postmortem.java. content is null before generation completes;
  // errorMessage is null except when status is FAILED or
  // PERMANENTLY_FAILED.
  content: string | null;
  errorMessage: string | null;
}

/**
 * Mirrors backend UpdatePostmortemRequest.java exactly — a single
 * required content field, not the seven optional section fields (plus a
 * status field the backend request body has never accepted) this
 * interface previously declared.
 */
export interface UpdatePostmortemRequest {
  content: string;
}