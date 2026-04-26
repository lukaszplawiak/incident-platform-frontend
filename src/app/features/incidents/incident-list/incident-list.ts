import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Incident } from '../../../core/models/incident.model';
import { IncidentRow } from '../incident-row/incident-row';

@Component({
  selector: 'app-incident-list',
  standalone: true,
  imports: [CommonModule, IncidentRow],
  templateUrl: './incident-list.html',
  styleUrl: './incident-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentList {

  @Input({ required: true }) incidents!: Incident[];
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() acknowledge = new EventEmitter<string>();
  @Output() resolve = new EventEmitter<string>();

  get isEmpty(): boolean {
    return !this.loading && this.incidents.length === 0;
  }

  onAcknowledge(incidentId: string): void {
    this.acknowledge.emit(incidentId);
  }

  onResolve(incidentId: string): void {
    this.resolve.emit(incidentId);
  }

  trackByIncidentId(index: number, incident: Incident): string {
    return incident.id;
  }
}