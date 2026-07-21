import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a request as targeting a public (unauthenticated) auth endpoint —
 * login, mfa/verify, accept-invite, and (from Branch 7) forgot-password /
 * reset-password.
 *
 * errorInterceptor reads this token to decide what a 401 response means:
 *
 * - Not set (default, every authenticated request) → 401 means "your
 *   session expired" → log the user out and redirect to /login. This is
 *   correct almost everywhere in the app.
 *
 * - Set to true → 401 means "the credentials/token you just submitted are
 *   wrong" → there is no session to expire, and redirecting away from the
 *   page the user is actively filling in would only interrupt them and
 *   show a misleading message.
 *
 * Usage at the call site (see AuthService):
 *
 *   const context = new HttpContext().set(IS_PUBLIC_AUTH_ENDPOINT, true);
 *   this.http.post(url, body, { context });
 *
 * Why HttpContext instead of a URL allowlist (the pattern auth.interceptor
 * already uses for isRefreshRequest): that works for one fixed exception,
 * but this list is growing — duplicating URL-matching in two interceptors
 * invites drift whenever an endpoint's path changes. HttpContext lets the
 * call site declare its own semantics once; every interceptor that cares
 * reads the same declaration.
 */
export const IS_PUBLIC_AUTH_ENDPOINT = new HttpContextToken<boolean>(() => false);