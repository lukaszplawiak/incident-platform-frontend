import { Component, input, computed } from '@angular/core';
import { IncidentSeverity } from '../../../core/models/incident.model';

@Component({
  selector: 'app-severity-badge',
  standalone: true,
  imports: [],
  templateUrl: './severity-badge.html',
  styleUrl: './severity-badge.scss'
})
export class SeverityBadge {

  readonly severity = input.required<IncidentSeverity>();

  readonly emoji = computed((): string => {
    const emojis: Record<IncidentSeverity, string> = {
      'CRITICAL': '🔴',
      'HIGH':     '🟠',
      'MEDIUM':   '🟡',
      'LOW':      '🟢'
    };
    return emojis[this.severity()] ?? '⚪';
  });

  readonly cssClass = computed((): string =>
    `severity-badge severity-badge--${this.severity().toLowerCase()}`
  );
}