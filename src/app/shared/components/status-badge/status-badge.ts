import { Component, input, computed } from '@angular/core';
import { IncidentStatus } from '../../../core/models/incident.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss'
})
export class StatusBadge {

  readonly status = input.required<IncidentStatus>();

  readonly label = computed((): string => {
    const labels: Record<IncidentStatus, string> = {
      'OPEN':         'Open',
      'ACKNOWLEDGED': 'Acknowledged',
      'RESOLVED':     'Resolved',
      'CLOSED':       'Closed'
    };
    return labels[this.status()] ?? this.status();
  });

  readonly cssClass = computed((): string =>
    `status-badge status-badge--${this.status().toLowerCase()}`
  );
}