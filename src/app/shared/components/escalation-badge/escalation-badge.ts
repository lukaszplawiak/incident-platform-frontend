import { Component, input, computed } from '@angular/core';

/**
 * Shows the current escalation level as an independent visual signal,
 * separate from the main IncidentStatus badge.
 *
 * Replaces the visual role previously played by `status === 'ESCALATED'`
 * (a red status-badge variant) — escalation is now `Incident.escalationLevel`,
 * an attribute independent of the lifecycle status, so it needs its own
 * indicator rather than competing for the status badge's single value.
 *
 * Renders nothing when escalationLevel is 0 (not escalated) — use
 * `@if (incident.escalationLevel > 0)` at the call site, or rely on this
 * component's own empty render via `hidden`.
 */
@Component({
  selector: 'app-escalation-badge',
  standalone: true,
  imports: [],
  templateUrl: './escalation-badge.html',
  styleUrl: './escalation-badge.scss'
})
export class EscalationBadge {

  readonly level = input.required<number>();

  readonly visible = computed((): boolean => this.level() > 0);

  readonly label = computed((): string => {
    switch (this.level()) {
      case 1:  return 'Escalated';
      case 2:  return 'Escalated to Manager';
      default: return `Escalated (L${this.level()})`;
    }
  });

  readonly cssClass = computed((): string =>
    `escalation-badge escalation-badge--level-${this.level()}`
  );
}