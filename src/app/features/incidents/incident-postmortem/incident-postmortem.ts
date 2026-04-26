import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Postmortem, PostmortemStatus } from '../../../core/models/postmortem.model';

@Component({
  selector: 'app-incident-postmortem',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './incident-postmortem.html',
  styleUrl: './incident-postmortem.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentPostmortem {

  @Input({ required: true }) postmortem!: Postmortem;
  @Input() loading = false;

  getStatusLabel(status: PostmortemStatus): string {
    const labels: Record<PostmortemStatus, string> = {
      'GENERATING': '⏳ Generating...',
      'DRAFT':      '📝 Draft',
      'REVIEWED':   '✅ Reviewed',
      'FAILED':     '❌ Failed'
    };
    return labels[status];
  }

  getStatusClass(status: PostmortemStatus): string {
    const classes: Record<PostmortemStatus, string> = {
      'GENERATING': 'postmortem__status--generating',
      'DRAFT':      'postmortem__status--draft',
      'REVIEWED':   'postmortem__status--reviewed',
      'FAILED':     'postmortem__status--failed'
    };
    return classes[status];
  }
}