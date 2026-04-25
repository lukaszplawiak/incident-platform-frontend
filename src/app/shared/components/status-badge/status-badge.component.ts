import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncidentStatus } from '../../../core/models/incident.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss'
})
export class StatusBadgeComponent {

  @Input({ required: true }) status!: IncidentStatus;

  get label(): string {
    const labels: Record<IncidentStatus, string> = {
      'OPEN':         'Open',
      'ACKNOWLEDGED': 'Acknowledged',
      'ESCALATED':    'Escalated',
      'RESOLVED':     'Resolved',
      'CLOSED':       'Closed'
    };
    return labels[this.status] ?? this.status;
  }

  get cssClass(): string {
    return `status-badge status-badge--${this.status.toLowerCase()}`;
  }
}