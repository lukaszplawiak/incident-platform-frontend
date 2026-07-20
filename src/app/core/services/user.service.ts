import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRolesRequest,
  UpdateUserStatusRequest,
} from '../models/user.model';
import { PageResponse } from '../models/incident.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.authApiUrl}/api/v1/users`;

  /**
   * GET /api/v1/users
   * Returns paginated list of users in the tenant. ADMIN only.
   */
  listUsers(page = 0, size = 20): Observable<PageResponse<User>> {
    return this.http.get<PageResponse<User>>(this.baseUrl, {
      params: { page: page.toString(), size: size.toString(), sort: 'createdAt,desc' }
    });
  }

  /**
   * GET /api/v1/users/me
   * Returns the authenticated user's own profile.
   */
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  /**
   * POST /api/v1/users
   * Creates a new user and sends an invite email. ADMIN only.
   */
  createUser(request: CreateUserRequest): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(this.baseUrl, request);
  }

  /**
   * PATCH /api/v1/users/{id}/roles
   * Replaces all user roles atomically. ADMIN only.
   */
  updateRoles(userId: string, request: UpdateUserRolesRequest): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${userId}/roles`, request);
  }

  /**
   * PATCH /api/v1/users/{id}/status
   * Activates or deactivates a user. ADMIN only.
   */
  updateStatus(userId: string, request: UpdateUserStatusRequest): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${userId}/status`, request);
  }

  /**
   * POST /api/v1/users/{id}/resend-invite
   * Resends invite email for a user who hasn't accepted yet. ADMIN only.
   * Returns 202 Accepted — fire and forget.
   */
  resendInvite(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/resend-invite`, {});
  }

  /**
   * DELETE /api/v1/users/{id}
   * Archives (soft-deletes) a user. Reversible. ADMIN only.
   * Admins cannot archive their own account.
   */
  archiveUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${userId}`);
  }

  /**
   * POST /api/v1/users/{id}/restore
   * Restores an archived user. ADMIN only.
   */
  restoreUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/restore`, {});
  }

  /**
   * POST /api/v1/users/{id}/anonymize
   * Permanently anonymizes user data for GDPR compliance. IRREVERSIBLE.
   * User must be archived first. ADMIN only.
   */
  anonymizeUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/anonymize`, {});
  }
}