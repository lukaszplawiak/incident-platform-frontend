import { Component, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { inject } from '@angular/core';
import { IncidentFilter as IncidentFilterModel, IncidentSeverity, IncidentStatus } from '../../../core/models/incident.model';

@Component({
  selector: 'app-incident-filter',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './incident-filter.html',
  styleUrl: './incident-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentFilter {

  private readonly fb = inject(FormBuilder);

  @Output() filterChange = new EventEmitter<IncidentFilterModel>();

  readonly severityOptions: { value: IncidentSeverity | ''; label: string }[] = [
    { value: '', label: 'All Severities' },
    { value: 'CRITICAL', label: '🔴 Critical' },
    { value: 'HIGH', label: '🟠 High' },
    { value: 'MEDIUM', label: '🟡 Medium' },
    { value: 'LOW', label: '🟢 Low' }
  ];

  readonly statusOptions: { value: IncidentStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
    { value: 'ESCALATED', label: 'Escalated' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  readonly filterForm: FormGroup = this.fb.group({
    severity: [''],
    status: ['']
  });

  onApply(): void {
    const { severity, status } = this.filterForm.value as {
      severity: IncidentSeverity | '';
      status: IncidentStatus | '';
    };

    const filter: IncidentFilterModel = {};
    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    this.filterChange.emit(filter);
  }

  onReset(): void {
    this.filterForm.reset({ severity: '', status: '' });
    this.filterChange.emit({});
  }
}