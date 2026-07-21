/**
 * Typed HTTP error thrown by errorInterceptor.
 *
 * Why this exists: several places in the app (login, mfa-verify, and the
 * admin panels for users/teams/integrations) branch on the original HTTP
 * status code — e.g. "if 409, show a duplicate-email message". Historically
 * errorInterceptor threw a plain `new Error(userMessage)`, which has no
 * `status` property at all, so every one of those checks silently always
 * fell through to a generic fallback message.
 *
 * ApiError preserves the original status alongside the human-readable
 * message, so downstream code can do:
 *
 *   catch (err: unknown) {
 *     if (err instanceof ApiError && err.status === 409) { ... }
 *   }
 *
 * instead of matching substrings against translated UI copy.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
    // Restores the prototype chain when extending a built-in like Error —
    // without this, `instanceof ApiError` can fail depending on the
    // TS compilation target.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}