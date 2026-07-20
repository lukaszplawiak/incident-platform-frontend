import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TeamService } from '../../../core/services/team.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import {
  Team,
  TeamMember,
  CreateTeamRequest,
  AddTeamMemberRequest,
  TEAM_ROLES,
  TeamRole,
} from '../../../core/models/team.model';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './teams.html',
  styleUrl: './teams.scss'
})
export class Teams implements OnInit {

  private readonly teamService = inject(TeamService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly teamRoles = TEAM_ROLES;

  // ── State ────────────────────────────────────────────────────────────────────

  readonly loading = signal(false);
  readonly teams = signal<Team[]>([]);

  /** Currently expanded team for member management */
  readonly selectedTeamId = signal<string | null>(null);
  readonly membersLoading = signal(false);
  readonly members = signal<TeamMember[]>([]);

  /** All users in tenant — for add-member dropdown */
  readonly allUsers = signal<User[]>([]);

  /** Confirmation state */
  readonly confirmingArchive = signal<string | null>(null);
  readonly confirmingRemoveMember = signal<string | null>(null);

  /** Modal visibility */
  readonly showCreateForm = signal(false);
  readonly showAddMemberForm = signal(false);
  readonly createLoading = signal(false);
  readonly addMemberLoading = signal(false);

  readonly createForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
  });

  readonly addMemberForm: FormGroup = this.fb.group({
    userId: ['', Validators.required],
    teamRole: [TEAM_ROLES[1], Validators.required],  // default: RESPONDER
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadTeams();
    this.loadAllUsers();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  loadTeams(): void {
    this.loading.set(true);
    this.teamService.listTeams().subscribe({
      next: (teams: Team[]) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load teams');
        this.loading.set(false);
      }
    });
  }

  loadAllUsers(): void {
    this.userService.listUsers(0, 100).subscribe({
      next: page => this.allUsers.set(page.content),
      error: () => { /* non-critical — add member form will be empty */ }
    });
  }

  selectTeam(teamId: string): void {
    if (this.selectedTeamId() === teamId) {
      this.selectedTeamId.set(null);
      this.members.set([]);
      return;
    }
    this.selectedTeamId.set(teamId);
    this.loadMembers(teamId);
  }

  loadMembers(teamId: string): void {
    this.membersLoading.set(true);
    this.teamService.listMembers(teamId).subscribe({
      next: (members: TeamMember[]) => {
        this.members.set(members);
        this.membersLoading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load team members');
        this.membersLoading.set(false);
      }
    });
  }

  // ── Create team ──────────────────────────────────────────────────────────────

  openCreateForm(): void {
    this.createForm.reset();
    this.showCreateForm.set(true);
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, description } = this.createForm.value as { name: string; description: string };
    const request: CreateTeamRequest = { name, description: description || undefined };

    this.createLoading.set(true);
    this.teamService.createTeam(request).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.showCreateForm.set(false);
        this.toast.success(`Team "${name}" created`);
        this.loadTeams();
      },
      error: (err: { status?: number }) => {
        this.createLoading.set(false);
        if (err.status === 409) {
          this.toast.error('A team with this name already exists');
        } else {
          this.toast.error('Failed to create team');
        }
      }
    });
  }

  hasCreateError(field: string, errorType: string): boolean {
    const control = this.createForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  // ── Archive / Restore ────────────────────────────────────────────────────────

  confirmArchive(teamId: string): void {
    this.confirmingArchive.set(teamId);
  }

  cancelArchive(): void {
    this.confirmingArchive.set(null);
  }

  archiveTeam(team: Team): void {
    this.teamService.archiveTeam(team.id).subscribe({
      next: () => {
        this.confirmingArchive.set(null);
        if (this.selectedTeamId() === team.id) {
          this.selectedTeamId.set(null);
          this.members.set([]);
        }
        this.toast.success(`Team "${team.name}" archived`);
        this.loadTeams();
      },
      error: () => {
        this.confirmingArchive.set(null);
        this.toast.error('Failed to archive team');
      }
    });
  }

  // ── Add member ───────────────────────────────────────────────────────────────

  openAddMemberForm(): void {
    this.addMemberForm.reset({ teamRole: TEAM_ROLES[1] });
    this.showAddMemberForm.set(true);
  }

  closeAddMemberForm(): void {
    this.showAddMemberForm.set(false);
  }

  submitAddMember(): void {
    if (this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    const teamId = this.selectedTeamId();
    if (!teamId) return;

    const { userId, teamRole } = this.addMemberForm.value as {
      userId: string;
      teamRole: TeamRole;
    };
    const request: AddTeamMemberRequest = { userId, teamRole };

    this.addMemberLoading.set(true);
    this.teamService.addMember(teamId, request).subscribe({
      next: () => {
        this.addMemberLoading.set(false);
        this.showAddMemberForm.set(false);
        this.toast.success('Member added');
        this.loadMembers(teamId);
      },
      error: (err: { status?: number }) => {
        this.addMemberLoading.set(false);
        if (err.status === 409) {
          this.toast.error('User is already a member of this team');
        } else {
          this.toast.error('Failed to add member');
        }
      }
    });
  }

  hasAddMemberError(field: string, errorType: string): boolean {
    const control = this.addMemberForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  // ── Update member role ───────────────────────────────────────────────────────

  updateMemberRole(member: TeamMember, newRole: TeamRole): void {
    const teamId = this.selectedTeamId();
    if (!teamId) return;

    this.teamService.updateMemberRole(teamId, member.userId, newRole).subscribe({
      next: (updated: TeamMember) => {
        this.members.update(list =>
          list.map(m => m.userId === updated.userId ? updated : m)
        );
        this.toast.success(`${member.email} is now ${newRole}`);
      },
      error: () => this.toast.error('Failed to update role')
    });
  }

  // ── Remove member ────────────────────────────────────────────────────────────

  confirmRemoveMember(userId: string): void {
    this.confirmingRemoveMember.set(userId);
  }

  cancelRemoveMember(): void {
    this.confirmingRemoveMember.set(null);
  }

  removeMember(member: TeamMember): void {
    const teamId = this.selectedTeamId();
    if (!teamId) return;

    this.teamService.removeMember(teamId, member.userId).subscribe({
      next: () => {
        this.confirmingRemoveMember.set(null);
        this.members.update(list => list.filter(m => m.userId !== member.userId));
        this.toast.success(`${member.email} removed from team`);
      },
      error: () => {
        this.confirmingRemoveMember.set(null);
        this.toast.error('Failed to remove member');
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  selectedTeam(): Team | undefined {
    return this.teams().find(t => t.id === this.selectedTeamId());
  }

  /** Users not yet in the selected team — for add-member dropdown */
  availableUsers(): User[] {
    const memberIds = new Set(this.members().map(m => m.userId));
    return this.allUsers().filter(u => !memberIds.has(u.id));
  }

  trackByTeamId(_index: number, team: Team): string {
    return team.id;
  }

  trackByUserId(_index: number, member: TeamMember): string {
    return member.userId;
  }
}