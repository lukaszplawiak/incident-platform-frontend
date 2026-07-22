import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TenantSettingsService } from './tenant-settings.service';
import { environment } from '../../../environments/environment';

const BASE_URL = `${environment.authApiUrl}/api/v1/tenants/settings`;

describe('TenantSettingsService', () => {
  let service: TenantSettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TenantSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getSettings', () => {
    it('sends GET to /api/v1/tenants/settings', () => {
      service.getSettings().subscribe();

      const req = httpMock.expectOne(BASE_URL);
      expect(req.request.method).toBe('GET');
      req.flush({ tenantId: 'acme-corp', mfaRequired: false });
    });

    it('returns the settings', () => {
      let result: { tenantId: string; mfaRequired: boolean } | undefined;
      service.getSettings().subscribe(res => { result = res; });

      httpMock.expectOne(BASE_URL).flush({ tenantId: 'acme-corp', mfaRequired: true });

      expect(result?.mfaRequired).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('POSTs to /api/v1/tenants/settings with the request body', () => {
      service.updateSettings({ mfaRequired: true }).subscribe();

      const req = httpMock.expectOne(BASE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mfaRequired: true });
      req.flush({ tenantId: 'acme-corp', mfaRequired: true });
    });
  });
});