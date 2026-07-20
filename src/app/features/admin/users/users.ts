import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { User, CreateUserRequest, USER_ROLES } from '../../../core/models/user.model';
import { PageResponse } from '../../../core/models/incident.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users implements OnInit {

  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly availableRoles = USER_ROLES;

  // ── State ───────────────────────────────────────────────────────────────────

  readonly loading = signal(false);
  readonly users = signal<User[]>([]);
  readonly totalElements = signal(0);
  readonly currentPage = signal(0);
  readonly pageSize = 20;

  /** User UUID pending archive/restore/anonymize confirmation */
  readonly confirmingArchive = signal<string | null>(null);
  readonly confirmingAnonymize = signal<string | null>(null);

  /** Whether the invite form modal is visible */
  readonly showInviteForm = signal(false);
  readonly inviteLoading = signal(false);

  readonly inviteForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: [USER_ROLES[1], Validators.required],  // default: ROLE_RESPONDER
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadUsers();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  loadUsers(): void {
    this.loading.set(true);
    this.userService.listUsers(this.currentPage(), this.pageSize).subscribe({
      next: (page: PageResponse<User>) => {
        this.users.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load users');
        this.loading.set(false);
      }
    });
  }

  // ── Pagination ───────────────────────────────────────────────────────────────

  get totalPages(): number {
    return Math.ceil(this.totalElements() / this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage.set(page);
    this.loadUsers();
  }

  // ── Invite user ──────────────────────────────────────────────────────────────

  openInviteForm(): void {
    this.inviteForm.reset({ role: USER_ROLES[1] });
    this.showInviteForm.set(true);
  }

  closeInviteForm(): void {
    this.showInviteForm.set(false);
  }

  submitInvite(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const { email, role } = this.inviteForm.value as { email: string; role: string };
    const request: CreateUserRequest = { email, roles: [role] };

    this.inviteLoading.set(true);
    this.userService.createUser(request).subscribe({
      next: () => {
        this.inviteLoading.set(false);
        this.showInviteForm.set(false);
        this.toast.success(`Invite sent to ${email}`);
        this.loadUsers();
      },
      error: (err: { status?: number }) => {
        this.inviteLoading.set(false);
        if (err.status === 409) {
          this.toast.error('A user with this email already exists in this organisation');
        } else {
          this.toast.error('Failed to send invite');
        }
      }
    });
  }

  hasInviteError(field: string, errorType: string): boolean {
    const control = this.inviteForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  // ── Role management ──────────────────────────────────────────────────────────

  toggleAdmin(user: User): void {
    const hasAdmin = user.roles.includes('ROLE_ADMIN');
    const newRoles = hasAdmin
      ? user.roles.filter(r => r !== 'ROLE_ADMIN')
      : [...user.roles, 'ROLE_ADMIN'];

    this.userService.updateRoles(user.id, { roles: newRoles }).subscribe({
      next: (updated: User) => {
        this.patchUser(updated);
        this.toast.success(`Roles updated for ${user.email}`);
      },
      error: () => this.toast.error('Failed to update roles')
    });
  }

  // ── Status management ────────────────────────────────────────────────────────

  toggleStatus(user: User): void {
    this.userService.updateStatus(user.id, { active: !user.active }).subscribe({
      next: (updated: User) => {
        this.patchUser(updated);
        this.toast.success(
          updated.active ? `${user.email} activated` : `${user.email} deactivated`
        );
      },
      error: () => this.toast.error('Failed to update status')
    });
  }

  // ── Resend invite ────────────────────────────────────────────────────────────

  resendInvite(user: User): void {
    this.userService.resendInvite(user.id).subscribe({
      next: () => this.toast.success(`Invite resent to ${user.email}`),
      error: (err: { status?: number }) => {
        if (err.status === 409) {
          this.toast.error('Invite already accepted or dispatch pending — try again in 30 seconds');
        } else {
          this.toast.error('Failed to resend invite');
        }
      }
    });
  }

  // ── Archive / Restore ────────────────────────────────────────────────────────

  confirmArchive(userId: string): void {
    this.confirmingArchive.set(userId);
  }

  cancelArchive(): void {
    this.confirmingArchive.set(null);
  }

  archiveUser(user: User): void {
    this.userService.archiveUser(user.id).subscribe({
      next: () => {
        this.confirmingArchive.set(null);
        this.toast.success(`${user.email} archived`);
        this.loadUsers();
      },
      error: (err: { status?: number }) => {
        this.confirmingArchive.set(null);
        if (err.status === 403) {
          this.toast.error('You cannot archive your own account');
        } else {
          this.toast.error('Failed to archive user');
        }
      }
    });
  }

  restoreUser(user: User): void {
    this.userService.restoreUser(user.id).subscribe({
      next: () => {
        this.toast.success(`${user.email} restored`);
        this.loadUsers();
      },
      error: () => this.toast.error('Failed to restore user')
    });
  }

  // ── Anonymize (GDPR) ─────────────────────────────────────────────────────────

  confirmAnonymize(userId: string): void {
    this.confirmingAnonymize.set(userId);
  }

  cancelAnonymize(): void {
    this.confirmingAnonymize.set(null);
  }

  anonymizeUser(user: User): void {
    this.userService.anonymizeUser(user.id).subscribe({
      next: () => {
        this.confirmingAnonymize.set(null);
        this.toast.success(`${user.email} anonymized (GDPR erasure)`);
        this.loadUsers();
      },
      error: (err: { status?: number }) => {
        this.confirmingAnonymize.set(null);
        if (err.status === 409) {
          this.toast.error('User must be archived before anonymization');
        } else {
          this.toast.error('Failed to anonymize user');
        }
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Replaces a single user in the list signal without full reload. */
  private patchUser(updated: User): void {
    this.users.update(list =>
      list.map(u => u.id === updated.id ? updated : u)
    );
  }

  isAdmin(user: User): boolean {
    return user.roles.includes('ROLE_ADMIN');
  }

  hasPassword(user: User): boolean {
    // Users without password haven't accepted invite yet
    // Backend doesn't expose this directly — we infer from updatedAt vs createdAt
    // A cleaner solution would be a separate `inviteAccepted: boolean` field in UserSummaryDto
    // For now: if active and has roles, assume invite was accepted
    return user.active;
  }

  trackByUserId(_index: number, user: User): string {
    return user.id;
  }
}