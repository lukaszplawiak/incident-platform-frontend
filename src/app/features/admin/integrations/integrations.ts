import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IntegrationService } from '../../../core/services/integration.service';
import { TeamService } from '../../../core/services/team.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';
import {
  ApiKey,
  Integration,
  ApiKeyCreatedResponse,
  IntegrationCreatedResponse,
  API_KEY_SCOPES,
  ApiKeyScope,
  INTEGRATION_SOURCES,
  IntegrationSource,
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
  readonly integrationSources = INTEGRATION_SOURCES;

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
    // Fixed: source is @NotBlank and pattern-restricted on the backend
    // (CreateIntegrationRequest.java) but was entirely absent from this
    // form — every submission was rejected with a validation error
    // before this fix, since the backend never received a field it
    // requires.
    source: ['', Validators.required],
    teamId: ['', Validators.required],
    // Fixed: ttlDays removed — CreateIntegrationRequest.java has never
    // accepted an expiry field for integrations (unlike personal API
    // keys). This field previously misled the user into thinking an
    // integration's key could be made to expire, when the backend has
    // no such concept for this key type.
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
    // Fixed: previously sent { type, ttl } — CreateApiKeyRequest.java's
    // own @NotNull field is `keyType`, not `type`, so every one of these
    // calls failed backend validation before this fix regardless of
    // what the form contained. `ttl` (a duration string like "P30D")
    // never matched the backend's own `expiresAt` (an ISO instant) —
    // converted here via daysFromNowIso, since the form itself still
    // collects a day count, which is friendlier for an admin to type
    // than a raw timestamp.
    this.integrationService.createApiKey({
      name,
      keyType: 'PERSONAL',
      scopes,
      expiresAt: this.daysFromNowIso(ttlDays),
    }).subscribe({
      next: (response: ApiKeyCreatedResponse) => {
        this.apiKeyLoading.set(false);
        this.showApiKeyForm.set(false);
        // Fixed: response.rawToken was always undefined — the backend
        // has always sent this field as `rawKey`. This is the one and
        // only time the raw key is ever returned, so this modal was
        // always showing the user an empty/undefined key to copy.
        this.showNewToken(response.name, response.rawKey, response.expiresAt);
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
    this.integrationForm.reset({ source: '' });
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
    const { name, source, teamId } = this.integrationForm.value as {
      name: string;
      source: IntegrationSource;
      teamId: string;
    };

    this.integrationLoading.set(true);
    // Fixed: previously sent { name, teamId, scopes, ttl } with no
    // `source` at all — CreateIntegrationRequest.java's own @NotBlank
    // field requires it, so every one of these calls was rejected with
    // a validation error before this fix. `scopes`/`ttl` removed —
    // CreateIntegrationRequest.java has never accepted either.
    this.integrationService.createIntegration({
      name,
      source,
      teamId,
    }).subscribe({
      next: (response: IntegrationCreatedResponse) => {
        this.integrationLoading.set(false);
        this.showIntegrationForm.set(false);
        // Fixed: response.rawToken was always undefined — the backend
        // has always sent this field as `apiKey`. This is the one and
        // only time the raw key is ever returned for an integration, so
        // this modal was always showing the user an empty/undefined key
        // to configure their monitoring system with.
        this.showNewToken(response.name, response.apiKey, null);
        this.loadAll();
      },
      error: (err: unknown) => {
        this.integrationLoading.set(false);
        this.toast.error(this.humanizeCreateIntegrationError(err));
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

  /**
   * Converts a day count from the API key form into the ISO instant
   * CreateApiKeyRequest.expiresAt actually expects. Returns null for a
   * non-expiring key, matching the backend's own "null = non-expiring"
   * contract.
   */
  private daysFromNowIso(days: number | null): string | null {
    if (!days) {
      return null;
    }
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry.toISOString();
  }

  /**
   * Fixed: this handler previously typed its error parameter as
   * { status?: number } — see teams.ts's own comment on this same fix
   * for the full reasoning. Matches mfa-settings.ts's own
   * humanize*Error pattern.
   */
  private humanizeCreateIntegrationError(err: unknown): string {
    if (err instanceof ApiError && err.status === 404) {
      return 'Team not found';
    }
    return 'Failed to create integration';
  }
}