import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';

import { SeverityBadge } from './severity-badge';
import { IncidentSeverity } from '../../../core/models/incident.model';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SeverityBadge', () => {
  let fixture: ComponentFixture<SeverityBadge>;
  let component: SeverityBadge;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeverityBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(SeverityBadge);
    component = fixture.componentInstance;
  });

  it('creates the component', () => {
    component.severity = 'CRITICAL';
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // emoji getter
  // ──────────────────────────────────────────────────────────────────────────

  describe('emoji', () => {
    const cases: Array<{ severity: IncidentSeverity; expectedEmoji: string }> = [
      { severity: 'CRITICAL', expectedEmoji: '🔴' },
      { severity: 'HIGH',     expectedEmoji: '🟠' },
      { severity: 'MEDIUM',   expectedEmoji: '🟡' },
      { severity: 'LOW',      expectedEmoji: '🟢' },
    ];

    cases.forEach(({ severity, expectedEmoji }) => {
      it(`returns ${expectedEmoji} for severity ${severity}`, () => {
        component.severity = severity;

        expect(component.emoji).toBe(expectedEmoji);
      });
    });

    it('covers all four IncidentSeverity values without fallback', () => {
      const allSeverities: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      allSeverities.forEach((severity) => {
        component.severity = severity;
        expect(component.emoji).not.toBe('⚪');
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // cssClass getter
  // ──────────────────────────────────────────────────────────────────────────

  describe('cssClass', () => {
    const cases: Array<{ severity: IncidentSeverity; expectedClass: string }> = [
      { severity: 'CRITICAL', expectedClass: 'severity-badge severity-badge--critical' },
      { severity: 'HIGH',     expectedClass: 'severity-badge severity-badge--high' },
      { severity: 'MEDIUM',   expectedClass: 'severity-badge severity-badge--medium' },
      { severity: 'LOW',      expectedClass: 'severity-badge severity-badge--low' },
    ];

    cases.forEach(({ severity, expectedClass }) => {
      it(`returns "${expectedClass}" for severity ${severity}`, () => {
        component.severity = severity;

        expect(component.cssClass).toBe(expectedClass);
      });
    });

    it('always includes the base "severity-badge" class', () => {
      const allSeverities: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      allSeverities.forEach((severity) => {
        component.severity = severity;
        expect(component.cssClass).toContain('severity-badge');
      });
    });

    it('uses lowercase severity name in the modifier class', () => {
      component.severity = 'CRITICAL';

      expect(component.cssClass).toContain('critical');
      expect(component.cssClass).not.toContain('CRITICAL');
    });
  });
});