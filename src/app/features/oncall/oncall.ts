import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { OncallService } from '../../core/services/oncall.service';
import { TeamService } from '../../core/services/team.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import {
  OncallSchedule,
  CurrentOncall,
  CreateOncallScheduleRequest,
  ONCALL_ROLES,
  OncallRole,
} from '../../core/models/oncall.model';
import { Team } from '../../core/models/team.model';
import { User } from '../../core/models/user.model';

/**
 * On-call panel — schedule management (any RESPONDER/ADMIN can view) plus
 * a team-scoped "currently on-call" snapshot (also RESPONDER/ADMIN — see
 * OncallService.getAllCurrentOncallForTeam for the permission reasoning).
 *
 * Route uses authGuard, not adminGuard: unlike /admin/users, /admin/teams
 * and /admin/integrations, this page is not admin-exclusive — the backend
 * lets any authenticated RESPONDER browse schedules and see who's on call.
 * Create/delete actions are gated in the template behind isAdmin(),
 * mirroring the backend's own @PreAuthorize("hasRole('ADMIN')") on
 * POST/DELETE — that part is genuinely admin-only and unchanged.
 */
@Component({
  selector: 'app-oncall',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './oncall.html',
  styleUrl: './oncall.scss',
})
export class Oncall implements OnInit {

  private readonly oncallService = inject(OncallService);
  private readonly teamService = inject(TeamService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly oncallRoles = ONCALL_ROLES;
  readonly isAdmin = this.authService.isAdmin;

  // ── Schedules list state ────────────────────────────────────────────────────

  readonly loading = signal(false);
  readonly schedules = signal<OncallSchedule[]>([]);
  readonly totalElements = signal(0);
  readonly currentPage = signal(0);
  readonly pageSize = 20;

  // ── Currently on-call (team-scoped, RESPONDER/ADMIN) ────────────────────────

  readonly currentOncallLoading = signal(false);
  readonly currentOncall = signal<CurrentOncall[]>([]);
  /** Team the "Currently on-call" section is showing. Null = no team picked yet. */
  readonly selectedTeamId = signal<string | null>(null);

  // ── Lookup data for the create form ─────────────────────────────────────────

  readonly allUsers = signal<User[]>([]);
  readonly allTeams = signal<Team[]>([]);

  // ── Create form ──────────────────────────────────────────────────────────────

  readonly showCreateForm = signal(false);
  readonly createLoading = signal(false);

  readonly createForm: FormGroup = this.fb.group(
    {
      userId: ['', Validators.required],
      userName: ['', [Validators.required, Validators.maxLength(200)]],
      teamId: [''],
      phone: [''],
      slackUserId: [''],
      role: ['PRIMARY' as OncallRole, Validators.required],
      startsAt: ['', Validators.required],
      endsAt: ['', Validators.required],
      notes: ['', Validators.maxLength(1000)],
    },
    { validators: [startBeforeEndValidator] }
  );

  // ── Delete confirmation ──────────────────────────────────────────────────────

  readonly confirmingDelete = signal<string | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSchedules();
    this.loadAllUsers();
    this.loadAllTeams();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  loadSchedules(): void {
    this.loading.set(true);
    this.oncallService.listSchedules(this.currentPage(), this.pageSize).subscribe({
      next: page => {
        this.schedules.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load on-call schedules');
        this.loading.set(false);
      }
    });
  }

  onTeamSelected(teamId: string): void {
    this.selectedTeamId.set(teamId);
    this.loadCurrentOncall(teamId);
  }

  loadCurrentOncall(teamId: string): void {
    this.currentOncallLoading.set(true);
    this.oncallService.getAllCurrentOncallForTeam(teamId).subscribe({
      next: current => {
        this.currentOncall.set(current);
        this.currentOncallLoading.set(false);
      },
      error: () => {
        // Non-critical — the schedules table still works without this.
        this.currentOncallLoading.set(false);
      }
    });
  }

  loadAllUsers(): void {
    this.userService.listUsers(0, 100).subscribe({
      next: page => this.allUsers.set(page.content),
      error: () => { /* non-critical — create form's user select will be empty */ }
    });
  }

  loadAllTeams(): void {
    this.teamService.listTeams().subscribe({
      next: teams => {
        this.allTeams.set(teams);
        // Default to the first team so the "Currently on-call" section
        // shows something useful immediately, rather than an empty
        // "pick a team" state on every page load.
        if (teams.length > 0 && this.selectedTeamId() === null) {
          this.onTeamSelected(teams[0].id);
        }
      },
      error: () => { /* non-critical — create form's team select will be empty */ }
    });
  }

  // ── Pagination ───────────────────────────────────────────────────────────────

  get totalPages(): number {
    return Math.ceil(this.totalElements() / this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage.set(page);
    this.loadSchedules();
  }

  // ── Create schedule ──────────────────────────────────────────────────────────

  openCreateForm(): void {
    this.createForm.reset({ role: 'PRIMARY' });
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }

  /**
   * Pre-fills the display-name field from the selected user's email
   * local-part — User has no separate display-name property. Only fills
   * when userName is still empty, so it never clobbers manual edits.
   */
  onUserChange(userId: string): void {
    const user = this.allUsers().find(u => u.id === userId);
    if (user && !this.createForm.get('userName')?.value) {
      const localPart = user.email.split('@')[0];
      this.createForm.patchValue({ userName: localPart });
    }
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const formValue = this.createForm.value as {
      userId: string;
      userName: string;
      teamId: string;
      phone: string;
      slackUserId: string;
      role: OncallRole;
      startsAt: string;
      endsAt: string;
      notes: string;
    };

    const selectedUser = this.allUsers().find(u => u.id === formValue.userId);
    if (!selectedUser) {
      this.toast.error('Selected user could not be found — please try again');
      return;
    }

    const request: CreateOncallScheduleRequest = {
      teamId: formValue.teamId || undefined,
      userId: selectedUser.id,
      userName: formValue.userName,
      email: selectedUser.email,
      phone: formValue.phone || undefined,
      slackUserId: formValue.slackUserId || undefined,
      role: formValue.role,
      startsAt: new Date(formValue.startsAt).toISOString(),
      endsAt: new Date(formValue.endsAt).toISOString(),
      notes: formValue.notes || undefined,
    };

    this.createLoading.set(true);
    this.oncallService.createSchedule(request).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.showCreateForm.set(false);
        this.toast.success(`On-call schedule created for ${selectedUser.email}`);
        this.loadSchedules();
        const teamId = this.selectedTeamId();
        if (teamId) {
          this.loadCurrentOncall(teamId);
        }
      },
      error: (err: { status?: number }) => {
        this.createLoading.set(false);
        if (err.status === 409) {
          this.toast.error('This overlaps an existing schedule for the same role and period');
        } else {
          this.toast.error('Failed to create on-call schedule');
        }
      }
    });
  }

  hasCreateError(field: string, errorType: string): boolean {
    const control = this.createForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  hasDateRangeError(): boolean {
    const endsAtControl = this.createForm.get('endsAt');
    return !!(endsAtControl?.touched && this.createForm.hasError('startNotBeforeEnd'));
  }

  // ── Delete schedule ──────────────────────────────────────────────────────────

  confirmDelete(scheduleId: string): void {
    this.confirmingDelete.set(scheduleId);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  deleteSchedule(schedule: OncallSchedule): void {
    this.oncallService.deleteSchedule(schedule.id).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        this.toast.success(`Schedule for ${schedule.email} deleted`);
        this.loadSchedules();
        const teamId = this.selectedTeamId();
        if (teamId) {
          this.loadCurrentOncall(teamId);
        }
      },
      error: () => {
        this.confirmingDelete.set(null);
        this.toast.error('Failed to delete schedule');
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  teamName(teamId: string | null): string {
    if (!teamId) return '—';
    return this.allTeams().find(t => t.id === teamId)?.name ?? '—';
  }

  trackByScheduleId(_index: number, schedule: OncallSchedule): string {
    return schedule.id;
  }

  trackByUserId(_index: number, current: CurrentOncall): string {
    return `${current.userId}-${current.role}`;
  }
}

function startBeforeEndValidator(control: AbstractControl): ValidationErrors | null {
  const startsAt = control.get('startsAt')?.value;
  const endsAt = control.get('endsAt')?.value;
  if (!startsAt || !endsAt) return null;
  return new Date(startsAt) < new Date(endsAt) ? null : { startNotBeforeEnd: true };
}