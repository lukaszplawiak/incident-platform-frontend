import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Incident } from '../../../core/models/incident.model';
import { SeverityBadge } from '../../../shared/components/severity-badge/severity-badge';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-incident-row',
  standalone: true,
  imports: [CommonModule, RouterModule, SeverityBadge, StatusBadge],
  templateUrl: './incident-row.html',
  styleUrl: './incident-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentRow {

  @Input({ required: true }) incident!: Incident;

  @Output() acknowledge = new EventEmitter<string>();
  @Output() resolve = new EventEmitter<string>();

  get age(): string {
    const openedAt = new Date(this.incident.openedAt);
    const now = new Date();
    const diffMs = now.getTime() - openedAt.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    if (diffMinutes < 1) return '< 1m';
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  get canAcknowledge(): boolean {
    return this.incident.status === 'OPEN' ||
           this.incident.status === 'ESCALATED';
  }

  get canResolve(): boolean {
    return this.incident.status === 'OPEN' ||
           this.incident.status === 'ACKNOWLEDGED' ||
           this.incident.status === 'ESCALATED';
  }

  onAcknowledge(): void {
    this.acknowledge.emit(this.incident.id);
  }

  onResolve(): void {
    this.resolve.emit(this.incident.id);
  }
}