import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { IncidentService } from './incident.service';
import { LoggerService } from './logger.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Incident, IncidentFilter, PageResponse } from '../models/incident.model';
import { environment } from '../../../environments/environment';

// ─── Test data factories ──────────────────────────────────────────────────────

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'incident-1',
    title: 'High CPU usage',
    description: 'CPU exceeded threshold',
    severity: 'CRITICAL',
    status: 'OPEN',
    tenantId: 'acme-corp',
    source: 'prometheus',
    sourceType: 'OPS',
    fingerprint: 'fp-001',
    alertId: 'alert-001',
    openedAt: '2026-01-01T00:00:00Z',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
    mttaSeconds: null,
    mttrSeconds: null,
    assignedTo: null,
    escalationLevel: 0,
    version: 1,
    ...overrides,
  };
}

function buildPage(
  incidents: Incident[],
  overrides: Partial<PageResponse<Incident>> = {}
): PageResponse<Incident> {
  return {
    content: incidents,
    totalElements: incidents.length,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
    ...overrides,
  };
}

const API_URL = `${environment.apiUrl}/api/v1/incidents`;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('IncidentService', () => {
  let service: IncidentService;
  let httpMock: HttpTestingController;
  let mockLogger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let mockToast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        IncidentService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: mockLogger },
        { provide: ToastService, useValue: mockToast },
      ],
    });

    service = TestBed.inject(IncidentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has empty incidents list', () => {
      expect(service.incidents()).toEqual([]);
    });

    it('has loading set to false', () => {
      expect(service.loading()).toBe(false);
    });

    it('has no selected incident', () => {
      expect(service.selectedIncident()).toBeNull();
    });

    it('has no error', () => {
      expect(service.error()).toBeNull();
    });

    it('has criticalCount of zero', () => {
      expect(service.criticalCount()).toBe(0);
    });

    it('has openCount of zero', () => {
      expect(service.openCount()).toBe(0);
    });

    it('has hasError set to false', () => {
      expect(service.hasError()).toBe(false);
    });

    it('has totalElements of zero', () => {
      expect(service.totalElements()).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // loadIncidents
  // ──────────────────────────────────────────────────────────────────────────

  describe('loadIncidents', () => {
    it('sets loading to true before HTTP response arrives', () => {
      service.loadIncidents();

      expect(service.loading()).toBe(true);

      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage([]));
    });

    it('sets loading to false after successful response', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage([]));

      expect(service.loading()).toBe(false);
    });

    it('populates incidents signal with response content', () => {
      const incidents = [
        buildIncident({ id: '1', title: 'Incident A' }),
        buildIncident({ id: '2', title: 'Incident B' }),
      ];

      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage(incidents));

      expect(service.incidents()).toEqual(incidents);
    });

    it('updates totalElements from page metadata', () => {
      const incidents = [buildIncident({ id: '1' }), buildIncident({ id: '2' })];

      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage(incidents, { totalElements: 42 }));

      expect(service.totalElements()).toBe(42);
    });

    it('updates totalPages from page metadata', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage([], { totalPages: 5 }));

      expect(service.totalPages()).toBe(5);
    });

    it('updates currentPage from page metadata', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage([], { number: 2 }));

      expect(service.currentPage()).toBe(2);
    });

    it('clears error before fetching', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        {},
        { status: 500, statusText: 'Server Error' }
      );
      expect(service.hasError()).toBe(true);

      service.loadIncidents();
      expect(service.error()).toBeNull();

      httpMock.expectOne((r) => r.url === API_URL).flush(buildPage([]));
    });

    it('sets error signal when HTTP request fails', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        {},
        { status: 500, statusText: 'Server Error' }
      );

      expect(service.hasError()).toBe(true);
      expect(service.error()).not.toBeNull();
    });

    it('sets loading to false even when HTTP request fails', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        {},
        { status: 500, statusText: 'Server Error' }
      );

      expect(service.loading()).toBe(false);
    });

    // ─── Filter params ────────────────────────────────────────────────────

    describe('filter params', () => {
      it('sends status filter as query param', () => {
        service.loadIncidents({ status: 'OPEN' });

        const req = httpMock.expectOne(
          (r) => r.url === API_URL && r.params.get('status') === 'OPEN'
        );
        req.flush(buildPage([]));
      });

      it('sends severity filter as query param', () => {
        service.loadIncidents({ severity: 'CRITICAL' });

        const req = httpMock.expectOne(
          (r) => r.url === API_URL && r.params.get('severity') === 'CRITICAL'
        );
        req.flush(buildPage([]));
      });

      it('sends page and size as query params', () => {
        service.loadIncidents({ page: 2, size: 10 });

        const req = httpMock.expectOne(
          (r) =>
            r.url === API_URL &&
            r.params.get('page') === '2' &&
            r.params.get('size') === '10'
        );
        req.flush(buildPage([]));
      });

      it('does not send undefined filter params', () => {
        service.loadIncidents({});

        const req = httpMock.expectOne((r) => r.url === API_URL);
        expect(req.request.params.has('status')).toBe(false);
        expect(req.request.params.has('severity')).toBe(false);
        req.flush(buildPage([]));
      });

      it('sends all filters combined', () => {
        const filter: IncidentFilter = {
          status: 'OPEN',
          severity: 'HIGH',
          page: 1,
          size: 5,
        };

        service.loadIncidents(filter);

        const req = httpMock.expectOne(
          (r) =>
            r.url === API_URL &&
            r.params.get('status') === 'OPEN' &&
            r.params.get('severity') === 'HIGH' &&
            r.params.get('page') === '1' &&
            r.params.get('size') === '5'
        );
        req.flush(buildPage([]));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // addIncident (WebSocket CREATED events)
  // ──────────────────────────────────────────────────────────────────────────

  describe('addIncident', () => {
    it('prepends new incident to the top of the list', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        buildPage([buildIncident({ id: 'existing-1' })])
      );

      const newIncident = buildIncident({ id: 'new-1', title: 'Brand new incident' });
      service.addIncident(newIncident);

      expect(service.incidents()[0].id).toBe('new-1');
      expect(service.incidents()[1].id).toBe('existing-1');
    });

    it('increments totalElements by 1', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        buildPage([buildIncident()], { totalElements: 5 })
      );

      service.addIncident(buildIncident({ id: 'new-1' }));

      expect(service.totalElements()).toBe(6);
    });

    it('does not add duplicate incident when same id arrives twice', () => {
      const incident = buildIncident({ id: 'dup-1' });

      service.addIncident(incident);
      service.addIncident(incident);

      const count = service.incidents().filter((i) => i.id === 'dup-1').length;
      expect(count).toBe(1);
    });

    it('does not increment totalElements for duplicate', () => {
      const incident = buildIncident({ id: 'dup-1' });

      service.addIncident(incident);
      const afterFirst = service.totalElements();

      service.addIncident(incident);

      expect(service.totalElements()).toBe(afterFirst);
    });

    it('updates criticalCount when CRITICAL incident is added', () => {
      expect(service.criticalCount()).toBe(0);

      service.addIncident(buildIncident({ id: '1', severity: 'CRITICAL' }));

      expect(service.criticalCount()).toBe(1);
    });

    it('updates openCount when OPEN incident is added', () => {
      expect(service.openCount()).toBe(0);

      service.addIncident(buildIncident({ id: '1', status: 'OPEN' }));

      expect(service.openCount()).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // updateIncident (WebSocket UPDATED events)
  // ──────────────────────────────────────────────────────────────────────────

  describe('updateIncident', () => {
    beforeEach(() => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        buildPage([
          buildIncident({ id: 'i-1', status: 'OPEN', severity: 'CRITICAL' }),
          buildIncident({ id: 'i-2', status: 'OPEN', severity: 'HIGH' }),
        ])
      );
    });

    it('updates matching incident in place', () => {
      const updated = buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' });

      service.updateIncident(updated);

      expect(service.incidents().find((i) => i.id === 'i-1')?.status).toBe('ACKNOWLEDGED');
    });

    it('does not change the length of the incidents list', () => {
      const updated = buildIncident({ id: 'i-1', status: 'RESOLVED' });

      service.updateIncident(updated);

      expect(service.incidents().length).toBe(2);
    });

    it('does not modify other incidents in the list', () => {
      const updated = buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' });

      service.updateIncident(updated);

      expect(service.incidents().find((i) => i.id === 'i-2')?.status).toBe('OPEN');
    });

    it('updates selectedIncident if it matches the updated id', () => {
      service.loadIncident('i-1');
      httpMock.expectOne(`${API_URL}/i-1`).flush(
        buildIncident({ id: 'i-1', status: 'OPEN' })
      );

      const updated = buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' });
      service.updateIncident(updated);

      expect(service.selectedIncident()?.status).toBe('ACKNOWLEDGED');
    });

    it('does not update selectedIncident when ids differ', () => {
      service.loadIncident('i-2');
      httpMock.expectOne(`${API_URL}/i-2`).flush(
        buildIncident({ id: 'i-2', status: 'OPEN' })
      );

      const updated = buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' });
      service.updateIncident(updated);

      expect(service.selectedIncident()?.id).toBe('i-2');
      expect(service.selectedIncident()?.status).toBe('OPEN');
    });

    it('updates criticalCount when severity changes', () => {
      expect(service.criticalCount()).toBe(1);

      service.updateIncident(buildIncident({ id: 'i-1', severity: 'LOW', status: 'OPEN' }));

      expect(service.criticalCount()).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // updateStatus (optimistic update + PATCH)
  // ──────────────────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    beforeEach(() => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        buildPage([buildIncident({ id: 'i-1', status: 'OPEN' })])
      );
    });

    it('sends PATCH request to /incidents/{id}/status', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });

      const req = httpMock.expectOne(`${API_URL}/i-1/status`);
      expect(req.request.method).toBe('PATCH');
      req.flush(buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' }));
    });

    it('sends correct request body with new status', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });

      const req = httpMock.expectOne(`${API_URL}/i-1/status`);
      expect(req.request.body).toEqual({ status: 'ACKNOWLEDGED' });
      req.flush(buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' }));
    });

    it('applies optimistic update immediately before server responds', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });

      expect(service.incidents().find((i) => i.id === 'i-1')?.status).toBe('ACKNOWLEDGED');

      httpMock.expectOne(`${API_URL}/i-1/status`).flush(
        buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' })
      );
    });

    it('updates incident list with server response after success', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });

      const serverResponse = buildIncident({
        id: 'i-1',
        status: 'ACKNOWLEDGED',
        acknowledgedAt: '2026-01-01T01:00:00Z',
        version: 2,
      });
      httpMock.expectOne(`${API_URL}/i-1/status`).flush(serverResponse);

      expect(service.incidents().find((i) => i.id === 'i-1')?.acknowledgedAt).toBe(
        '2026-01-01T01:00:00Z'
      );
    });

    it('shows success toast after status update', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });
      httpMock.expectOne(`${API_URL}/i-1/status`).flush(
        buildIncident({ id: 'i-1', status: 'ACKNOWLEDGED' })
      );

      expect(mockToast.success).toHaveBeenCalled();
    });

    it('rolls back optimistic update when server returns error', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });

      expect(service.incidents().find((i) => i.id === 'i-1')?.status).toBe('ACKNOWLEDGED');

      httpMock.expectOne(`${API_URL}/i-1/status`).flush(
        {},
        { status: 409, statusText: 'Conflict' }
      );

      expect(service.incidents().find((i) => i.id === 'i-1')?.status).toBe('OPEN');
    });

    it('shows error toast when server returns error', () => {
      service.updateStatus('i-1', { status: 'ACKNOWLEDGED' });
      httpMock.expectOne(`${API_URL}/i-1/status`).flush(
        {},
        { status: 409, statusText: 'Conflict' }
      );

      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────────
  // getSortParams
  // ──────────────────────────────────────────────────────────────────────────
  // Sorting is now server-side. getSortParams() updates the sortState signal
  // (used by the UI for arrow icons) and returns { sort, direction } params
  // that the caller merges into IncidentFilter before calling loadIncidents().
  // Tests verify: correct params returned, sortState updated, toggle logic.
  // Tests do NOT verify array order — that is the backend responsibility.

  describe("getSortParams", () => {
    it("returns asc direction on first call for a column", () => {
      const params = service.getSortParams("severity");

      expect(params).toEqual({ sort: "severity", direction: "asc" });
    });

    it("returns desc direction on second call for the same column", () => {
      service.getSortParams("severity");
      const params = service.getSortParams("severity");

      expect(params).toEqual({ sort: "severity", direction: "desc" });
    });

    it("returns asc direction when switching to a different column", () => {
      service.getSortParams("severity");
      service.getSortParams("severity"); // now desc
      const params = service.getSortParams("title"); // switching column resets to asc

      expect(params).toEqual({ sort: "title", direction: "asc" });
    });

    it("sets sortState signal with correct column and direction", () => {
      service.getSortParams("severity");

      expect(service.sortState()).toEqual({ column: "severity", direction: "asc" });
    });

    it("toggles sortState direction on second call for the same column", () => {
      service.getSortParams("title");
      service.getSortParams("title");

      expect(service.sortState()).toEqual({ column: "title", direction: "desc" });
    });

    it("resets sortState direction to asc when switching column", () => {
      service.getSortParams("severity");
      service.getSortParams("severity");
      service.getSortParams("title");

      expect(service.sortState()).toEqual({ column: "title", direction: "asc" });
    });

    it("does not trigger any HTTP request — sorting is server-side", () => {
      service.getSortParams("severity");

      httpMock.expectNone((r) => r.url === API_URL);
    });
  });


  describe('computed signals', () => {
    describe('criticalCount', () => {
      it('counts only CRITICAL severity incidents', () => {
        service.loadIncidents();
        httpMock.expectOne((r) => r.url === API_URL).flush(
          buildPage([
            buildIncident({ id: '1', severity: 'CRITICAL' }),
            buildIncident({ id: '2', severity: 'HIGH' }),
            buildIncident({ id: '3', severity: 'CRITICAL' }),
            buildIncident({ id: '4', severity: 'LOW' }),
          ])
        );

        expect(service.criticalCount()).toBe(2);
      });

      it('returns 0 when no incidents are loaded', () => {
        expect(service.criticalCount()).toBe(0);
      });
    });

    describe('openCount', () => {
      it('counts only OPEN status incidents', () => {
        service.loadIncidents();
        httpMock.expectOne((r) => r.url === API_URL).flush(
          buildPage([
            buildIncident({ id: '1', status: 'OPEN' }),
            buildIncident({ id: '2', status: 'RESOLVED' }),
            buildIncident({ id: '3', status: 'OPEN' }),
            buildIncident({ id: '4', status: 'ACKNOWLEDGED' }),
          ])
        );

        expect(service.openCount()).toBe(2);
      });

      it('returns 0 when no incidents are loaded', () => {
        expect(service.openCount()).toBe(0);
      });
    });

    describe('hasError', () => {
      it('returns false initially', () => {
        expect(service.hasError()).toBe(false);
      });

      it('returns true after failed HTTP request', () => {
        service.loadIncidents();
        httpMock.expectOne((r) => r.url === API_URL).flush(
          {},
          { status: 500, statusText: 'Server Error' }
        );

        expect(service.hasError()).toBe(true);
      });

      it('returns false after clearError is called', () => {
        service.loadIncidents();
        httpMock.expectOne((r) => r.url === API_URL).flush(
          {},
          { status: 500, statusText: 'Server Error' }
        );

        service.clearError();

        expect(service.hasError()).toBe(false);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // clearError
  // ──────────────────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('sets error to null', () => {
      service.loadIncidents();
      httpMock.expectOne((r) => r.url === API_URL).flush(
        {},
        { status: 500, statusText: 'Server Error' }
      );
      expect(service.error()).not.toBeNull();

      service.clearError();

      expect(service.error()).toBeNull();
    });
  });
});