import { ComponentRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { SeverityBadge } from './severity-badge';
import { IncidentSeverity } from '../../../core/models/incident.model';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SeverityBadge', () => {
  let fixture: ComponentFixture<SeverityBadge>;
  let component: SeverityBadge;
  let componentRef: ComponentRef<SeverityBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeverityBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(SeverityBadge);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates the component', () => {
    componentRef.setInput('severity', 'CRITICAL');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // emoji computed signal
  // ──────────────────────────────────────────────────────────────────────────

  describe('emoji', () => {
    const cases: { severity: IncidentSeverity; expectedEmoji: string }[] = [
      { severity: 'CRITICAL', expectedEmoji: '🔴' },
      { severity: 'HIGH',     expectedEmoji: '🟠' },
      { severity: 'MEDIUM',   expectedEmoji: '🟡' },
      { severity: 'LOW',      expectedEmoji: '🟢' },
    ];

    cases.forEach(({ severity, expectedEmoji }) => {
      it(`returns ${expectedEmoji} for severity ${severity}`, () => {
        componentRef.setInput('severity', severity);

        expect(component.emoji()).toBe(expectedEmoji);
      });
    });

    it('covers all four IncidentSeverity values without fallback', () => {
      const allSeverities: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      allSeverities.forEach((severity) => {
        componentRef.setInput('severity', severity);
        expect(component.emoji()).not.toBe('⚪');
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // cssClass computed signal
  // ──────────────────────────────────────────────────────────────────────────

  describe('cssClass', () => {
    const cases: { severity: IncidentSeverity; expectedClass: string }[] = [
      { severity: 'CRITICAL', expectedClass: 'severity-badge severity-badge--critical' },
      { severity: 'HIGH',     expectedClass: 'severity-badge severity-badge--high' },
      { severity: 'MEDIUM',   expectedClass: 'severity-badge severity-badge--medium' },
      { severity: 'LOW',      expectedClass: 'severity-badge severity-badge--low' },
    ];

    cases.forEach(({ severity, expectedClass }) => {
      it(`returns "${expectedClass}" for severity ${severity}`, () => {
        componentRef.setInput('severity', severity);

        expect(component.cssClass()).toBe(expectedClass);
      });
    });

    it('always includes the base "severity-badge" class', () => {
      const allSeverities: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      allSeverities.forEach((severity) => {
        componentRef.setInput('severity', severity);
        expect(component.cssClass()).toContain('severity-badge');
      });
    });

    it('uses lowercase severity name in the modifier class', () => {
      componentRef.setInput('severity', 'CRITICAL');

      expect(component.cssClass()).toContain('critical');
      expect(component.cssClass()).not.toContain('CRITICAL');
    });
  });
});