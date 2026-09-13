import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';

import { IncidentPostmortem } from './incident-postmortem';
import { Postmortem, PostmortemStatus } from '../../../core/models/postmortem.model';

/**
 * Covers the postmortem model fix — see postmortem.model.ts's own
 * comment for the full account of the backend/frontend field mismatch
 * this closes. The two things actually worth testing here, beyond
 * ordinary rendering: (1) the markdown-to-HTML conversion this
 * component now does, since it replaces seven @if branches the backend
 * never populated, and (2) that the sanitization step this component's
 * own Javadoc-equivalent comment describes as necessary actually runs —
 * without it, this would be a stored XSS vector for anything Gemini
 * echoes back from a prompt built partly from incident data that can
 * originate from an untrusted external alerting system.
 */
describe('IncidentPostmortem', () => {
  let component: IncidentPostmortem;
  let fixture: ComponentFixture<IncidentPostmortem>;

  const basePostmortem: Postmortem = {
    id: 'pm-1',
    incidentId: 'inc-1',
    tenantId: 'default',
    incidentTitle: 'Database outage',
    incidentSeverity: 'CRITICAL',
    incidentOpenedAt: '2026-01-01T00:00:00Z',
    incidentResolvedAt: '2026-01-01T01:00:00Z',
    durationMinutes: 60,
    status: 'DRAFT',
    createdAt: '2026-01-01T01:00:00Z',
    updatedAt: '2026-01-01T01:05:00Z',
    content: null,
    errorMessage: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentPostmortem],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentPostmortem);
    component = fixture.componentInstance;
  });

  function renderedHtml(): string {
    const sanitizer = TestBed.inject(DomSanitizer);
    return sanitizer.sanitize(SecurityContext.HTML, component.renderedContent) ?? '';
  }

  describe('renderedContent', () => {
    it('returns null when content is null (e.g. status GENERATING)', () => {
      component.postmortem = { ...basePostmortem, content: null };
      expect(component.renderedContent).toBeNull();
    });

    it('renders markdown content to HTML', () => {
      component.postmortem = {
        ...basePostmortem,
        content: '## Summary\n\nThe database went **down**.',
      };

      const html = renderedHtml();

      expect(html).toContain('<h2');
      expect(html).toContain('Summary');
      expect(html).toContain('<strong>down</strong>');
    });

    /**
     * The actual regression test for the security concern this
     * component's own comment raises: marked.parse() does not sanitize
     * its output. Without the DOMPurify step, this <script> tag would
     * pass straight through to bypassSecurityTrustHtml and execute in
     * whichever engineer's browser next opens this postmortem.
     */
    it('strips a <script> tag from content before rendering', () => {
      component.postmortem = {
        ...basePostmortem,
        content: 'Root cause identified. <script>alert("xss")</script> Fixed.',
      };

      const html = renderedHtml();

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(');
    });

    it('strips an onerror attribute from content before rendering', () => {
      component.postmortem = {
        ...basePostmortem,
        content: '<img src="x" onerror="alert(1)">',
      };

      const html = renderedHtml();

      expect(html).not.toContain('onerror');
    });
  });

  describe('getStatusLabel / getStatusClass', () => {
    const allStatuses: PostmortemStatus[] =
        ['GENERATING', 'DRAFT', 'REVIEWED', 'FAILED', 'PERMANENTLY_FAILED'];

    /**
     * The actual regression test for the missing-union-member bug:
     * PERMANENTLY_FAILED was previously absent from both the
     * PostmortemStatus union and these two Record maps, so
     * labels[status]/classes[status] returned undefined for it —
     * rendering a blank/"undefined" status badge for a postmortem that
     * had, in fact, permanently failed and needed manual attention.
     */
    it.each(allStatuses)('returns a real label and class for status %s', (status) => {
      expect(component.getStatusLabel(status)).toBeTruthy();
      expect(component.getStatusClass(status)).toBeTruthy();
    });

    it('gives PERMANENTLY_FAILED a distinct label from the retryable FAILED state', () => {
      expect(component.getStatusLabel('PERMANENTLY_FAILED'))
        .not.toEqual(component.getStatusLabel('FAILED'));
    });
  });
});