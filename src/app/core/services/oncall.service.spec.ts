import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { OncallService } from './oncall.service';
import { OncallSchedule, CurrentOncall } from '../models/oncall.model';
import { PageResponse } from '../models/incident.model';
import { environment } from '../../../environments/environment';

// ─── Test data factories ──────────────────────────────────────────────────────

function buildSchedule(overrides: Partial<OncallSchedule> = {}): OncallSchedule {
  return {
    id: 'schedule-1',
    tenantId: 'acme-corp',
    teamId: null,
    userId: 'user-1',
    userName: 'Jan Kowalski',
    email: 'jan@acme.com',
    phone: null,
    slackUserId: null,
    role: 'PRIMARY',
    startsAt: '2026-07-21T00:00:00Z',
    endsAt: '2026-07-28T00:00:00Z',
    notes: null,
    createdAt: '2026-07-20T00:00:00Z',
    ...overrides,
  };
}

function buildPage(
  schedules: OncallSchedule[],
  overrides: Partial<PageResponse<OncallSchedule>> = {}
): PageResponse<OncallSchedule> {
  return {
    content: schedules,
    totalElements: schedules.length,
    totalPages: 1,
    size: 20,
    page: 0,
    first: true,
    last: true,
    ...overrides,
  };
}

function buildCurrentOncall(overrides: Partial<CurrentOncall> = {}): CurrentOncall {
  return {
    userId: 'user-1',
    userName: 'Jan Kowalski',
    email: 'jan@acme.com',
    teamId: null,
    phone: null,
    slackUserId: null,
    role: 'PRIMARY',
    shiftEndsAt: '2026-07-28T00:00:00Z',
    ...overrides,
  };
}

const BASE_URL = `${environment.oncallApiUrl}/api/v1/oncall`;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OncallService', () => {
  let service: OncallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(OncallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── listSchedules ───────────────────────────────────────────────────────────

  describe('listSchedules', () => {
    it('sends GET to /api/v1/oncall/schedules with page/size/sort params', () => {
      service.listSchedules(1, 10).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${BASE_URL}/schedules`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.params.get('sort')).toBe('startsAt');
      req.flush(buildPage([buildSchedule()]));
    });

    it('defaults to page 0, size 20', () => {
      service.listSchedules().subscribe();

      const req = httpMock.expectOne(r => r.url === `${BASE_URL}/schedules`);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(buildPage([]));
    });

    it('returns the paginated schedules', () => {
      let result: PageResponse<OncallSchedule> | undefined;
      service.listSchedules().subscribe(res => { result = res; });

      const page = buildPage([buildSchedule({ id: 'schedule-2' })], { totalElements: 1 });
      httpMock.expectOne(r => r.url === `${BASE_URL}/schedules`).flush(page);

      expect(result?.content).toHaveLength(1);
      expect(result?.content[0].id).toBe('schedule-2');
    });
  });

  // ── createSchedule ──────────────────────────────────────────────────────────

  describe('createSchedule', () => {
    it('sends POST to /api/v1/oncall/schedules with the request body', () => {
      service.createSchedule({
        teamId: 'team-1',
        userId: 'user-1',
        userName: 'Jan Kowalski',
        email: 'jan@acme.com',
        role: 'PRIMARY',
        startsAt: '2026-07-21T00:00:00Z',
        endsAt: '2026-07-28T00:00:00Z',
      }).subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/schedules`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.teamId).toBe('team-1');
      expect(req.request.body.role).toBe('PRIMARY');
      req.flush(buildSchedule(), { status: 201, statusText: 'Created' });
    });
  });

  // ── deleteSchedule ───────────────────────────────────────────────────────────

  describe('deleteSchedule', () => {
    it('sends DELETE to /api/v1/oncall/schedules/{id}', () => {
      service.deleteSchedule('schedule-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/schedules/schedule-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  // ── getAllCurrentOncall ──────────────────────────────────────────────────────

  describe('getAllCurrentOncallForTeam', () => {
    it('sends GET to /api/v1/oncall/current/all with the teamId param', () => {
      service.getAllCurrentOncallForTeam('team-1').subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${BASE_URL}/current/all`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('teamId')).toBe('team-1');
      req.flush([buildCurrentOncall()]);
    });

    it('returns the array from a 200 response', () => {
      let result: CurrentOncall[] | undefined;
      service.getAllCurrentOncallForTeam('team-1').subscribe(res => { result = res; });

      httpMock.expectOne(r => r.url === `${BASE_URL}/current/all`).flush([
        buildCurrentOncall({ role: 'PRIMARY' }),
        buildCurrentOncall({ role: 'SECONDARY' }),
      ]);

      expect(result).toHaveLength(2);
    });

    it('returns an empty array when no one is on call for the team', () => {
      let result: CurrentOncall[] | undefined;
      service.getAllCurrentOncallForTeam('team-1').subscribe(res => { result = res; });

      httpMock.expectOne(r => r.url === `${BASE_URL}/current/all`).flush([]);

      expect(result).toEqual([]);
    });
  });
});