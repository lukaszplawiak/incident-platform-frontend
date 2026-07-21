import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IntegrationService } from './integration.service';
import { environment } from '../../../environments/environment';

const API_KEYS_URL = `${environment.authApiUrl}/api/v1/api-keys`;
const INTEGRATIONS_URL = `${environment.authApiUrl}/api/v1/integrations`;

describe('IntegrationService', () => {
  let service: IntegrationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IntegrationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('listApiKeys', () => {
    it('sends GET to /api/v1/api-keys', () => {
      service.listApiKeys().subscribe();
      const req = httpMock.expectOne(API_KEYS_URL);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createApiKey', () => {
    it('sends POST with request body', () => {
      service.createApiKey({ name: 'CI Key', type: 'PERSONAL', scopes: ['alerts:ingest'], ttl: 'P90D' }).subscribe();
      const req = httpMock.expectOne(API_KEYS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe('CI Key');
      req.flush({ id: 'key-1', name: 'CI Key', rawToken: 'ipl_abc', createdAt: '2026-01-01T00:00:00Z', expiresAt: null });
    });
  });

  describe('revokeApiKey', () => {
    it('sends DELETE to /api/v1/api-keys/{id}', () => {
      service.revokeApiKey('key-1').subscribe();
      const req = httpMock.expectOne(`${API_KEYS_URL}/key-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('listIntegrations', () => {
    it('sends GET to /api/v1/integrations', () => {
      service.listIntegrations().subscribe();
      const req = httpMock.expectOne(INTEGRATIONS_URL);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createIntegration', () => {
    it('sends POST with request body', () => {
      service.createIntegration({ name: 'Prometheus', teamId: 'team-1', scopes: ['alerts:ingest'], ttl: null }).subscribe();
      const req = httpMock.expectOne(INTEGRATIONS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.teamId).toBe('team-1');
      req.flush({ integrationId: 'int-1', name: 'Prometheus', teamId: 'team-1', apiKeyId: 'key-1', rawToken: 'ipl_xyz', createdAt: '2026-01-01T00:00:00Z', expiresAt: null });
    });
  });

  describe('deleteIntegration', () => {
    it('sends DELETE to /api/v1/integrations/{id}', () => {
      service.deleteIntegration('int-1').subscribe();
      const req = httpMock.expectOne(`${INTEGRATIONS_URL}/int-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});