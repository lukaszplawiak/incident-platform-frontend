import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Integrations } from './integrations';
import { IntegrationService } from '../../../core/services/integration.service';
import { TeamService } from '../../../core/services/team.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ApiError } from '../../../core/errors/api-error';
import {
  ApiKey,
  ApiKeyCreatedResponse,
  CreateApiKeyRequest,
  CreateIntegrationRequest,
  Integration,
  IntegrationCreatedResponse,
} from '../../../core/models/integration.model';
import { Team } from '../../../core/models/team.model';

/**
 * Covers the fix in integration.model.ts/integrations.ts — see those
 * files' own comments for the full account of the backend/frontend
 * field mismatch this closes. The tests worth having here, beyond
 * ordinary form/component behavior, are the actual regression coverage
 * for the two previously-completely-non-functional flows: createApiKey
 * and createIntegration were sending request bodies the backend could
 * never accept, and reading response fields the backend never sent.
 */
describe('Integrations', () => {
  let component: Integrations;
  let fixture: ComponentFixture<Integrations>;

  let mockIntegrationService: {
    listApiKeys: ReturnType<typeof vi.fn<() => Observable<ApiKey[]>>>;
    createApiKey: ReturnType<typeof vi.fn<(req: CreateApiKeyRequest) => Observable<ApiKeyCreatedResponse>>>;
    revokeApiKey: ReturnType<typeof vi.fn<(id: string) => Observable<void>>>;
    listIntegrations: ReturnType<typeof vi.fn<() => Observable<Integration[]>>>;
    createIntegration: ReturnType<typeof vi.fn<(req: CreateIntegrationRequest) => Observable<IntegrationCreatedResponse>>>;
    deleteIntegration: ReturnType<typeof vi.fn<(id: string) => Observable<void>>>;
  };
  let mockTeamService: {
    listTeams: ReturnType<typeof vi.fn<() => Observable<Team[]>>>;
  };
  let mockToast: {
    success: ReturnType<typeof vi.fn<(message: string) => void>>;
    error: ReturnType<typeof vi.fn<(message: string) => void>>;
  };

  const TEAM: Team = {
    id: 'team-1',
    tenantId: 'default',
    name: 'Platform',
    description: null,
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockIntegrationService = {
      listApiKeys: vi.fn().mockReturnValue(of([])),
      createApiKey: vi.fn(),
      revokeApiKey: vi.fn(),
      listIntegrations: vi.fn().mockReturnValue(of([])),
      createIntegration: vi.fn(),
      deleteIntegration: vi.fn(),
    };
    mockTeamService = {
      listTeams: vi.fn().mockReturnValue(of([TEAM])),
    };
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Integrations],
      providers: [
        { provide: IntegrationService, useValue: mockIntegrationService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Integrations);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit -> loadAll()
  });

  describe('submitApiKey', () => {
    /**
     * The actual regression test for the fix in integration.model.ts:
     * this call previously sent { type, ttl } — a request body the
     * backend's own @NotNull keyType field never matched, so every
     * submission failed validation regardless of form content.
     */
    it('sends keyType and expiresAt, not the old type/ttl fields', () => {
      const created: ApiKeyCreatedResponse = {
        id: 'key-1', name: 'CI Key', keyType: 'PERSONAL',
        scopes: ['alerts:ingest'], rawKey: 'ipl_abc123',
        expiresAt: '2026-04-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z',
        message: 'Store this key securely.',
      };
      mockIntegrationService.createApiKey.mockReturnValue(of(created));

      component.apiKeyForm.setValue({
        name: 'CI Key', scopes: ['alerts:ingest'], ttlDays: 90,
      });
      component.submitApiKey();

      const sentRequest =
          mockIntegrationService.createApiKey.mock.calls[0][0] as CreateApiKeyRequest;
      expect(sentRequest.keyType).toBe('PERSONAL');
      expect(sentRequest).not.toHaveProperty('type');
      expect(sentRequest).not.toHaveProperty('ttl');
      expect(sentRequest.expiresAt).toBeTruthy();
      // A real future instant, not a duration string like "P90D".
      expect(new Date(sentRequest.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('sends null expiresAt when no expiry is chosen', () => {
      mockIntegrationService.createApiKey.mockReturnValue(of({
        id: 'key-1', name: 'CI Key', keyType: 'PERSONAL',
        scopes: ['alerts:ingest'], rawKey: 'ipl_abc123',
        expiresAt: null, createdAt: '2026-01-01T00:00:00Z', message: 'x',
      }));

      component.apiKeyForm.setValue({
        name: 'CI Key', scopes: ['alerts:ingest'], ttlDays: null,
      });
      component.submitApiKey();

      const sentRequest =
          mockIntegrationService.createApiKey.mock.calls[0][0] as CreateApiKeyRequest;
      expect(sentRequest.expiresAt).toBeNull();
    });

    /**
     * The actual regression test for the response-reading half of the
     * same fix: response.rawToken was always undefined (the backend has
     * always sent rawKey) — this modal was always showing an
     * empty/undefined key to copy.
     */
    it('shows the real raw key from response.rawKey in the copy modal', () => {
      mockIntegrationService.createApiKey.mockReturnValue(of({
        id: 'key-1', name: 'CI Key', keyType: 'PERSONAL',
        scopes: ['alerts:ingest'], rawKey: 'ipl_the_real_key',
        expiresAt: null, createdAt: '2026-01-01T00:00:00Z', message: 'x',
      }));

      component.apiKeyForm.setValue({
        name: 'CI Key', scopes: ['alerts:ingest'], ttlDays: null,
      });
      component.submitApiKey();

      expect(component.newTokenModal()?.rawToken).toBe('ipl_the_real_key');
    });
        it('does not submit an invalid form', () => {
      component.apiKeyForm.setValue({ name: '', scopes: [], ttlDays: null });
      component.submitApiKey();
      expect(mockIntegrationService.createApiKey).not.toHaveBeenCalled();
    });

    it('shows an error toast when creation fails', () => {
      mockIntegrationService.createApiKey.mockReturnValue(
        throwError(() => new Error('failed')));

      component.apiKeyForm.setValue({
        name: 'CI Key', scopes: ['alerts:ingest'], ttlDays: null,
      });
      component.submitApiKey();

      expect(mockToast.error).toHaveBeenCalledWith('Failed to create API key');
      expect(component.apiKeyLoading()).toBe(false);
    });
  });

  describe('submitIntegration', () => {
    /**
     * The actual regression test for the fix in integration.model.ts:
     * this call previously sent { name, teamId, scopes, ttl } with no
     * `source` at all — the backend's own @NotBlank source field was
     * never present, so every submission was rejected with a
     * validation error regardless of form content, and the form itself
     * had no field to collect it.
     */
    it('sends source, not the old scopes/ttl fields', () => {
      const created: IntegrationCreatedResponse = {
        id: 'int-1', name: 'Prometheus', source: 'prometheus',
        teamId: 'team-1', teamName: 'Platform', apiKey: 'ipl_xyz',
        description: null, createdAt: '2026-01-01T00:00:00Z', message: 'x',
      };
      mockIntegrationService.createIntegration.mockReturnValue(of(created));

      component.integrationForm.setValue({
        name: 'Prometheus', source: 'prometheus', teamId: 'team-1',
      });
      component.submitIntegration();

      const sentRequest =
          mockIntegrationService.createIntegration.mock.calls[0][0] as CreateIntegrationRequest;
      expect(sentRequest.source).toBe('prometheus');
      expect(sentRequest).not.toHaveProperty('scopes');
      expect(sentRequest).not.toHaveProperty('ttl');
    });

    it('does not submit without a source selected', () => {
      component.integrationForm.setValue({
        name: 'Prometheus', source: '', teamId: 'team-1',
      });
      component.submitIntegration();
      expect(mockIntegrationService.createIntegration).not.toHaveBeenCalled();
    });

    /**
     * The actual regression test for the response-reading half of the
     * same fix: response.rawToken was always undefined (the backend has
     * always sent apiKey) — this modal was always showing an
     * empty/undefined key to configure the monitoring system with.
     */
    it('shows the real raw key from response.apiKey in the copy modal', () => {
      mockIntegrationService.createIntegration.mockReturnValue(of({
        id: 'int-1', name: 'Prometheus', source: 'prometheus',
        teamId: 'team-1', teamName: 'Platform', apiKey: 'ipl_the_real_key',
        description: null, createdAt: '2026-01-01T00:00:00Z', message: 'x',
      }));

      component.integrationForm.setValue({
        name: 'Prometheus', source: 'prometheus', teamId: 'team-1',
      });
      component.submitIntegration();

      expect(component.newTokenModal()?.rawToken).toBe('ipl_the_real_key');
    });

    /**
     * The actual regression test for backlog #14: this must throw a
     * real ApiError, not a plain { status: 404 } object — the fixed
     * handler checks `err instanceof ApiError`, which a plain object
     * literal (however status-shaped) does not satisfy. Confirms the
     * fix's own new type guard actually recognizes the error
     * errorInterceptor genuinely throws.
     */
    it('shows "Team not found" on a 404', () => {
      mockIntegrationService.createIntegration.mockReturnValue(
        throwError(() => new ApiError('Not Found', 404)));

      component.integrationForm.setValue({
        name: 'Prometheus', source: 'prometheus', teamId: 'team-1',
      });
      component.submitIntegration();

      expect(mockToast.error).toHaveBeenCalledWith('Team not found');
    });

    it('shows a generic error toast on any other failure', () => {
      mockIntegrationService.createIntegration.mockReturnValue(
        throwError(() => new ApiError('Server Error', 500)));

      component.integrationForm.setValue({
        name: 'Prometheus', source: 'prometheus', teamId: 'team-1',
      });
      component.submitIntegration();

      expect(mockToast.error).toHaveBeenCalledWith('Failed to create integration');
    });
  });

  describe('scope selection', () => {
    it('toggles a scope on and off', () => {
      component.apiKeyForm.get('scopes')?.setValue(['alerts:ingest']);

      component.toggleScope('incidents:read');
      expect(component.isScopeSelected('incidents:read')).toBe(true);

      component.toggleScope('incidents:read');
      expect(component.isScopeSelected('incidents:read')).toBe(false);
    });
  });

  describe('revokeApiKey', () => {
    it('removes the key from the list on success', () => {
      const key: ApiKey = {
        id: 'key-1', name: 'CI Key', keyType: 'PERSONAL', keyPrefix: 'ipl_abcd',
        scopes: ['alerts:ingest'], ownerEmail: 'a@b.com', lastUsedAt: null,
        expiresAt: null, createdAt: '2026-01-01T00:00:00Z', active: true,
      };
      component.apiKeys.set([key]);
      mockIntegrationService.revokeApiKey.mockReturnValue(of(undefined));

      component.revokeApiKey(key);

      expect(component.apiKeys()).toEqual([]);
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  describe('deleteIntegration', () => {
    it('removes the integration from the list on success', () => {
      const integration: Integration = {
        id: 'int-1', name: 'Prometheus', source: 'prometheus',
        teamId: 'team-1', teamName: 'Platform', apiKeyPrefix: 'ipl_abcd',
        description: null, createdAt: '2026-01-01T00:00:00Z', active: true,
      };
      component.integrations.set([integration]);
      mockIntegrationService.deleteIntegration.mockReturnValue(of(undefined));

      component.deleteIntegration(integration);

      expect(component.integrations()).toEqual([]);
      expect(mockToast.success).toHaveBeenCalled();
    });
  });
});