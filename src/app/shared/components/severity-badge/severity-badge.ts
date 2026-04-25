import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncidentSeverity } from '../../../core/models/incident.model';

@Component({
  selector: 'app-severity-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './severity-badge.html',
  styleUrl: './severity-badge.scss'
})
export class SeverityBadge {

  @Input({ required: true }) severity!: IncidentSeverity;

  get emoji(): string {
    const emojis: Record<IncidentSeverity, string> = {
      'CRITICAL': '🔴',
      'HIGH':     '🟠',
      'MEDIUM':   '🟡',
      'LOW':      '🟢'
    };
    return emojis[this.severity] ?? '⚪';
  }

  get cssClass(): string {
    return `severity-badge severity-badge--${this.severity.toLowerCase()}`;
  }
}