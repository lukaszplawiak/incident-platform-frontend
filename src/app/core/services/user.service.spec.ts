import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserService } from './user.service';
import { User, CreateUserRequest, CreateUserResponse } from '../models/user.model';
import { PageResponse } from '../models/incident.model';
import { environment } from '../../../environments/environment';

// ─── Test data factories ──────────────────────────────────────────────────────

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    tenantId: 'acme-corp',
    email: 'user@acme.com',
    roles: ['ROLE_RESPONDER'],
    teamIds: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildPage(
  users: User[],
  overrides: Partial<PageResponse<User>> = {}
): PageResponse<User> {
  return {
    content: users,
    totalElements: users.length,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
    ...overrides,
  };
}

const BASE_URL = `${environment.authApiUrl}/api/v1/users`;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── listUsers ────────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('sends GET to /api/v1/users with pagination params', () => {
      const page = buildPage([buildUser()]);

      service.listUsers(0, 20).subscribe();

      const req = httpMock.expectOne(r =>
        r.url === BASE_URL &&
        r.params.get('page') === '0' &&
        r.params.get('size') === '20'
      );

      expect(req.request.method).toBe('GET');
      req.flush(page);
    });

    it('returns paginated user list', () => {
      const users = [buildUser({ id: 'user-1' }), buildUser({ id: 'user-2' })];
      const page = buildPage(users, { totalElements: 2 });
      let result: PageResponse<User> | undefined;

      service.listUsers().subscribe(p => { result = p; });
      httpMock.expectOne(r => r.url === BASE_URL).flush(page);

      expect(result?.content).toHaveLength(2);
      expect(result?.totalElements).toBe(2);
    });

    it('uses page 1 when specified', () => {
      service.listUsers(1, 20).subscribe();

      const req = httpMock.expectOne(r =>
        r.url === BASE_URL && r.params.get('page') === '1'
      );
      req.flush(buildPage([]));
    });
  });

  // ── getMe ────────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('sends GET to /api/v1/users/me', () => {
      const user = buildUser();

      service.getMe().subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/me`);
      expect(req.request.method).toBe('GET');
      req.flush(user);
    });

    it('returns the current user', () => {
      const user = buildUser({ email: 'me@acme.com' });
      let result: User | undefined;

      service.getMe().subscribe(u => { result = u; });
      httpMock.expectOne(`${BASE_URL}/me`).flush(user);

      expect(result?.email).toBe('me@acme.com');
    });
  });

  // ── createUser ───────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('sends POST to /api/v1/users with request body', () => {
      const request: CreateUserRequest = {
        email: 'new@acme.com',
        roles: ['ROLE_RESPONDER'],
      };
      const response: CreateUserResponse = {
        userId: 'user-new',
        email: 'new@acme.com',
        inviteToken: 'invite-token-abc',
        expiresAt: '2026-07-27T00:00:00Z',
      };

      service.createUser(request).subscribe();

      const req = httpMock.expectOne(BASE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(response);
    });

    it('returns the CreateUserResponse', () => {
      const response: CreateUserResponse = {
        userId: 'user-new',
        email: 'new@acme.com',
        inviteToken: 'invite-token-abc',
        expiresAt: '2026-07-27T00:00:00Z',
      };
      let result: CreateUserResponse | undefined;

      service.createUser({ email: 'new@acme.com', roles: ['ROLE_RESPONDER'] })
        .subscribe(r => { result = r; });
      httpMock.expectOne(BASE_URL).flush(response);

      expect(result?.inviteToken).toBe('invite-token-abc');
    });
  });

  // ── updateRoles ──────────────────────────────────────────────────────────────

  describe('updateRoles', () => {
    it('sends PATCH to /api/v1/users/{id}/roles', () => {
      const updated = buildUser({ roles: ['ROLE_ADMIN'] });

      service.updateRoles('user-1', { roles: ['ROLE_ADMIN'] }).subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1/roles`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ roles: ['ROLE_ADMIN'] });
      req.flush(updated);
    });

    it('returns the updated user', () => {
      const updated = buildUser({ roles: ['ROLE_ADMIN', 'ROLE_RESPONDER'] });
      let result: User | undefined;

      service.updateRoles('user-1', { roles: ['ROLE_ADMIN', 'ROLE_RESPONDER'] })
        .subscribe(u => { result = u; });
      httpMock.expectOne(`${BASE_URL}/user-1/roles`).flush(updated);

      expect(result?.roles).toContain('ROLE_ADMIN');
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('sends PATCH to /api/v1/users/{id}/status', () => {
      const updated = buildUser({ active: false });

      service.updateStatus('user-1', { active: false }).subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: false });
      req.flush(updated);
    });
  });

  // ── resendInvite ─────────────────────────────────────────────────────────────

  describe('resendInvite', () => {
    it('sends POST to /api/v1/users/{id}/resend-invite', () => {
      service.resendInvite('user-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1/resend-invite`);
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 202, statusText: 'Accepted' });
    });
  });

  // ── archiveUser ──────────────────────────────────────────────────────────────

  describe('archiveUser', () => {
    it('sends DELETE to /api/v1/users/{id}', () => {
      service.archiveUser('user-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  // ── restoreUser ──────────────────────────────────────────────────────────────

  describe('restoreUser', () => {
    it('sends POST to /api/v1/users/{id}/restore', () => {
      service.restoreUser('user-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1/restore`);
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  // ── anonymizeUser ─────────────────────────────────────────────────────────────

  describe('anonymizeUser', () => {
    it('sends POST to /api/v1/users/{id}/anonymize', () => {
      service.anonymizeUser('user-1').subscribe();

      const req = httpMock.expectOne(`${BASE_URL}/user-1/anonymize`);
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});