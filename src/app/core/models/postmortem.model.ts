export type PostmortemStatus = 'GENERATING' | 'DRAFT' | 'REVIEWED' | 'FAILED';

export interface Postmortem {
  id: string;
  incidentId: string;
  tenantId: string;
  status: PostmortemStatus;

  summary: string | null;
  timeline: string | null;
  rootCause: string | null;
  impact: string | null;
  resolution: string | null;
  actionItems: string | null;
  lessonsLearned: string | null;

  generatedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePostmortemRequest {
  summary?: string;
  timeline?: string;
  rootCause?: string;
  impact?: string;
  resolution?: string;
  actionItems?: string;
  lessonsLearned?: string;
  status?: PostmortemStatus;
}