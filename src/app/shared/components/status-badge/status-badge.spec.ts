import { ComponentRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { StatusBadge } from './status-badge';
import { IncidentStatus } from '../../../core/models/incident.model';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('StatusBadge', () => {
  let fixture: ComponentFixture<StatusBadge>;
  let component: StatusBadge;
  let componentRef: ComponentRef<StatusBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadge);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates the component', () => {
    componentRef.setInput('status', 'OPEN');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // label computed signal
  // ──────────────────────────────────────────────────────────────────────────

  describe('label', () => {
    const cases: { status: IncidentStatus; expectedLabel: string }[] = [
      { status: 'OPEN',         expectedLabel: 'Open' },
      { status: 'ACKNOWLEDGED', expectedLabel: 'Acknowledged' },
      { status: 'ESCALATED',    expectedLabel: 'Escalated' },
      { status: 'RESOLVED',     expectedLabel: 'Resolved' },
      { status: 'CLOSED',       expectedLabel: 'Closed' },
    ];

    cases.forEach(({ status, expectedLabel }) => {
      it(`returns "${expectedLabel}" for status ${status}`, () => {
        componentRef.setInput('status', status);

        expect(component.label()).toBe(expectedLabel);
      });
    });

    it('covers all five IncidentStatus values', () => {
      const allStatuses: IncidentStatus[] = [
        'OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'CLOSED',
      ];

      allStatuses.forEach((status) => {
        componentRef.setInput('status', status);
        expect(component.label()).not.toBe(status);
      });
    });

    it('returns human-readable label (title case, not uppercase enum)', () => {
      componentRef.setInput('status', 'ACKNOWLEDGED');

      expect(component.label()).toBe('Acknowledged');
      expect(component.label()).not.toBe('ACKNOWLEDGED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // cssClass computed signal
  // ──────────────────────────────────────────────────────────────────────────

  describe('cssClass', () => {
    const cases: { status: IncidentStatus; expectedClass: string }[] = [
      { status: 'OPEN',         expectedClass: 'status-badge status-badge--open' },
      { status: 'ACKNOWLEDGED', expectedClass: 'status-badge status-badge--acknowledged' },
      { status: 'ESCALATED',    expectedClass: 'status-badge status-badge--escalated' },
      { status: 'RESOLVED',     expectedClass: 'status-badge status-badge--resolved' },
      { status: 'CLOSED',       expectedClass: 'status-badge status-badge--closed' },
    ];

    cases.forEach(({ status, expectedClass }) => {
      it(`returns "${expectedClass}" for status ${status}`, () => {
        componentRef.setInput('status', status);

        expect(component.cssClass()).toBe(expectedClass);
      });
    });

    it('always includes the base "status-badge" class', () => {
      const allStatuses: IncidentStatus[] = [
        'OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'CLOSED',
      ];

      allStatuses.forEach((status) => {
        componentRef.setInput('status', status);
        expect(component.cssClass()).toContain('status-badge');
      });
    });

    it('uses lowercase status name in the BEM modifier class', () => {
      componentRef.setInput('status', 'ACKNOWLEDGED');

      expect(component.cssClass()).toContain('acknowledged');
      expect(component.cssClass()).not.toContain('ACKNOWLEDGED');
    });
  });
});