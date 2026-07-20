import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TeamService } from './team.service';
import { Team, TeamMember } from '../models/team.model';
import { environment } from '../../../environments/environment';

// ─── Test data factories ──────────────────────────────────────────────────────

function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    tenantId: 'acme-corp',
    name: 'Backend Team',
    description: 'Handles backend services',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    userId: 'user-1',
    email: 'user@acme.com',
    teamRole: 'RESPONDER',
    joinedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const BASE_URL = `${environment.authApiUrl}/api/v1/teams`;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TeamService', () => {
  let service: TeamService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TeamService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── listTeams ────────────────────────────────────────────────────────────────

  describe('listTeams', () => {
    it('sends GET to /api/v1/teams', () => {
      service.listTeams().subscribe();

      const req = httpMock.expectOne(BASE_URL);
      expect(req.request.method).toBe('GET');
      req.flush([buildTeam()]);
    });

    it('returns list of teams', () => {
      const teams = [buildTeam({ id: 'team-1' }), buildTeam({ id: 'team-2', name: 'Ops Team' })];
      let result: Team[] | undefined;

      service.listTeams().subscribe(t => { result = t; });
      httpMock.expectOne(BASE_URL).flush(teams);

      expect(result).toHaveLength(2);
    });
  });

  // ── createTeam ───────────────────────────────────────────────────────────────

  describe('createTeam', () => {
    it('sends POST to /api/v1/teams with request body', () => {
      const team = buildTeam();

      service.createTeam({ name: 'Backend Team', description: 'Handles backend' }).subscribe();

      const req = httpMock.expectOne(BASE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Backend Team', description: 'Handles backend' });
      req.flush(team);
    });

    it('returns the created team', () => {
      const team = buildTeam({ name: 'New Team' });
      let result: Team | undefined;

      service.createTeam({ name: 'New Team' }).subscribe(t => { result = t; });
      httpMock.expectOne(BASE_URL).flush(team);

      expect(result?.name).toBe('New Team');
    });
  });

  // ── archiveTeam ──────────────────────────────────────────────────────────────

  describe('archiveTeam', () => {
    it('sends DELETE to /api/v1/teams/{teamId}', () => {
      service.archiveTeam('team-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/team-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  // ── restoreTeam ──────────────────────────────────────────────────────────────

  describe('restoreTeam', () => {
    it('sends POST to /api/v1/teams/{teamId}/restore', () => {
      const team = buildTeam();

      service.restoreTeam('team-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/team-1/restore`);
      expect(req.request.method).toBe('POST');
      req.flush(team);
    });
  });

  // ── listMembers ──────────────────────────────────────────────────────────────

  describe('listMembers', () => {
    it('sends GET to /api/v1/teams/{teamId}/members', () => {
      service.listMembers('team-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/team-1/members`);
      expect(req.request.method).toBe('GET');
      req.flush([buildMember()]);
    });
  });

  // ── addMember ────────────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('sends POST to /api/v1/teams/{teamId}/members with request body', () => {
      const member = buildMember();

      service.addMember('team-1', { userId: 'user-1', teamRole: 'RESPONDER' }).subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/team-1/members`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: 'user-1', teamRole: 'RESPONDER' });
      req.flush(member);
    });
  });

  // ── updateMemberRole ─────────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('sends PATCH with teamRole as query param', () => {
      const updated = buildMember({ teamRole: 'MANAGER' });

      service.updateMemberRole('team-1', 'user-1', 'MANAGER').subscribe();

      const req = httpMock.expectOne(r =>
        r.url === `${BASE_URL}/team-1/members/user-1/role` &&
        r.params.get('teamRole') === 'MANAGER'
      );
      expect(req.request.method).toBe('PATCH');
      req.flush(updated);
    });
  });

  // ── removeMember ─────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('sends DELETE to /api/v1/teams/{teamId}/members/{userId}', () => {
      service.removeMember('team-1', 'user-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/team-1/members/user-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});