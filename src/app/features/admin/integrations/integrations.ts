import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IntegrationService } from '../../../core/services/integration.service';
import { TeamService } from '../../../core/services/team.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import {
  ApiKey,
  Integration,
  ApiKeyCreatedResponse,
  IntegrationCreatedResponse,
  API_KEY_SCOPES,
  ApiKeyScope,
} from '../../../core/models/integration.model';
import { Team } from '../../../core/models/team.model';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './integrations.html',
  styleUrl: './integrations.scss'
})
export class Integrations implements OnInit {

  private readonly integrationService = inject(IntegrationService);
  private readonly teamService = inject(TeamService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly allScopes = API_KEY_SCOPES;

  // ── State ────────────────────────────────────────────────────────────────────

  readonly apiKeys = signal<ApiKey[]>([]);
  readonly integrations = signal<Integration[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly loading = signal(false);

  /** Shown once after creating a key — user must copy it */
  readonly newTokenModal = signal<{
    name: string;
    rawToken: string;
    expiresAt: string | null;
  } | null>(null);
  readonly tokenCopied = signal(false);

  readonly confirmingRevoke = signal<string | null>(null);
  readonly confirmingDeleteIntegration = signal<string | null>(null);

  readonly showApiKeyForm = signal(false);
  readonly showIntegrationForm = signal(false);
  readonly apiKeyLoading = signal(false);
  readonly integrationLoading = signal(false);

  readonly apiKeyForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    scopes: [['alerts:ingest'], Validators.required],
    ttlDays: [null],
  });

  readonly integrationForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    teamId: ['', Validators.required],
    ttlDays: [null],
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.integrationService.listApiKeys().subscribe({
      next: keys => this.apiKeys.set(keys),
      error: () => this.toast.error('Failed to load API keys')
    });
    this.integrationService.listIntegrations().subscribe({
      next: integrations => {
        this.integrations.set(integrations);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load integrations');
        this.loading.set(false);
      }
    });
    this.teamService.listTeams().subscribe({
      next: teams => this.teams.set(teams),
      error: () => { /* non-critical */ }
    });
  }

  // ── API Key form ─────────────────────────────────────────────────────────────

  openApiKeyForm(): void {
    this.apiKeyForm.reset({ scopes: ['alerts:ingest'], ttlDays: null });
    this.showApiKeyForm.set(true);
  }

  closeApiKeyForm(): void {
    this.showApiKeyForm.set(false);
  }

  toggleScope(scope: ApiKeyScope): void {
    const current: ApiKeyScope[] = this.apiKeyForm.get('scopes')?.value ?? [];
    const updated = current.includes(scope)
      ? current.filter(s => s !== scope)
      : [...current, scope];
    this.apiKeyForm.get('scopes')?.setValue(updated);
  }

  isScopeSelected(scope: ApiKeyScope): boolean {
    const current: ApiKeyScope[] = this.apiKeyForm.get('scopes')?.value ?? [];
    return current.includes(scope);
  }

  submitApiKey(): void {
    if (this.apiKeyForm.invalid) {
      this.apiKeyForm.markAllAsTouched();
      return;
    }
    const { name, scopes, ttlDays } = this.apiKeyForm.value as {
      name: string;
      scopes: ApiKeyScope[];
      ttlDays: number | null;
    };

    this.apiKeyLoading.set(true);
    this.integrationService.createApiKey({
      name,
      type: 'PERSONAL',
      scopes,
      ttl: ttlDays ? `P${ttlDays}D` : null,
    }).subscribe({
      next: (response: ApiKeyCreatedResponse) => {
        this.apiKeyLoading.set(false);
        this.showApiKeyForm.set(false);
        this.showNewToken(response.name, response.rawToken, response.expiresAt);
        this.loadAll();
      },
      error: () => {
        this.apiKeyLoading.set(false);
        this.toast.error('Failed to create API key');
      }
    });
  }

  hasApiKeyError(field: string, errorType: string): boolean {
    const control = this.apiKeyForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  // ── Integration form ─────────────────────────────────────────────────────────

  openIntegrationForm(): void {
    this.integrationForm.reset({ ttlDays: null });
    this.showIntegrationForm.set(true);
  }

  closeIntegrationForm(): void {
    this.showIntegrationForm.set(false);
  }

  submitIntegration(): void {
    if (this.integrationForm.invalid) {
      this.integrationForm.markAllAsTouched();
      return;
    }
    const { name, teamId, ttlDays } = this.integrationForm.value as {
      name: string;
      teamId: string;
      ttlDays: number | null;
    };

    this.integrationLoading.set(true);
    this.integrationService.createIntegration({
      name,
      teamId,
      scopes: ['alerts:ingest'],
      ttl: ttlDays ? `P${ttlDays}D` : null,
    }).subscribe({
      next: (response: IntegrationCreatedResponse) => {
        this.integrationLoading.set(false);
        this.showIntegrationForm.set(false);
        this.showNewToken(response.name, response.rawToken, response.expiresAt);
        this.loadAll();
      },
      error: (err: { status?: number }) => {
        this.integrationLoading.set(false);
        if (err.status === 404) {
          this.toast.error('Team not found');
        } else {
          this.toast.error('Failed to create integration');
        }
      }
    });
  }

  hasIntegrationError(field: string, errorType: string): boolean {
    const control = this.integrationForm.get(field);
    return !!(control?.touched && control?.hasError(errorType));
  }

  // ── Revoke API key ────────────────────────────────────────────────────────────

  confirmRevoke(id: string): void {
    this.confirmingRevoke.set(id);
  }

  cancelRevoke(): void {
    this.confirmingRevoke.set(null);
  }

  revokeApiKey(key: ApiKey): void {
    this.integrationService.revokeApiKey(key.id).subscribe({
      next: () => {
        this.confirmingRevoke.set(null);
        this.toast.success(`API key "${key.name}" revoked`);
        this.apiKeys.update(list => list.filter(k => k.id !== key.id));
      },
      error: () => {
        this.confirmingRevoke.set(null);
        this.toast.error('Failed to revoke API key');
      }
    });
  }

  // ── Delete integration ────────────────────────────────────────────────────────

  confirmDeleteIntegration(id: string): void {
    this.confirmingDeleteIntegration.set(id);
  }

  cancelDeleteIntegration(): void {
    this.confirmingDeleteIntegration.set(null);
  }

  deleteIntegration(integration: Integration): void {
    this.integrationService.deleteIntegration(integration.id).subscribe({
      next: () => {
        this.confirmingDeleteIntegration.set(null);
        this.toast.success(`Integration "${integration.name}" deleted`);
        this.integrations.update(list => list.filter(i => i.id !== integration.id));
      },
      error: () => {
        this.confirmingDeleteIntegration.set(null);
        this.toast.error('Failed to delete integration');
      }
    });
  }

  // ── New token modal ───────────────────────────────────────────────────────────

  private showNewToken(name: string, rawToken: string, expiresAt: string | null): void {
    this.tokenCopied.set(false);
    this.newTokenModal.set({ name, rawToken, expiresAt });
  }

  closeTokenModal(): void {
    this.newTokenModal.set(null);
  }

  copyToken(): void {
    const modal = this.newTokenModal();
    if (!modal) return;
    navigator.clipboard.writeText(modal.rawToken).then(() => {
      this.tokenCopied.set(true);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  trackByKeyId(_index: number, key: ApiKey): string { return key.id; }
  trackByIntegrationId(_index: number, i: Integration): string { return i.id; }
}