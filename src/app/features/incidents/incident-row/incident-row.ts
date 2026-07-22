import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Incident, IncidentStatus } from '../../../core/models/incident.model';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EscalationBadge } from '../../../shared/components/escalation-badge/escalation-badge';
import { formatDurationMinutes } from '../../../shared/utils/format-duration';

@Component({
  selector: 'app-incident-row',
  standalone: true,
  imports: [CommonModule, RouterModule, SeverityBadge, StatusBadge, EscalationBadge],
  templateUrl: './incident-row.html',
  styleUrl: './incident-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentRow {

  @Input({ required: true }) incident!: Incident;

  @Output() acknowledge = new EventEmitter<string>();
  @Output() resolve = new EventEmitter<string>();

  get age(): string {
    const createdAt = new Date(this.incident.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / 60_000;

    return formatDurationMinutes(diffMinutes);
  }

  get canAcknowledge(): boolean {
    return this.incident.allowedTransitions.includes('ACKNOWLEDGED');
  }

  get canResolve(): boolean {
    return this.incident.allowedTransitions.includes('RESOLVED');
  }

  canTransitionTo(status: IncidentStatus): boolean {
    return this.incident.allowedTransitions.includes(status);
  }

  onAcknowledge(): void {
    this.acknowledge.emit(this.incident.id);
  }

  onResolve(): void {
    this.resolve.emit(this.incident.id);
  }
}