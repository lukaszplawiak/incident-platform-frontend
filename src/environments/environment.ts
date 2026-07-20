export const environment = {
  production: false,
  /** incident-service — incidents, audit, WebSocket */
  apiUrl: 'http://localhost:8082',
  /** auth-service — login, refresh, users, teams, API keys */
  authApiUrl: 'http://localhost:8087',
  /** oncall-service — on-call schedules */
  oncallApiUrl: 'http://localhost:8086',
  wsUrl: 'ws://localhost:8082/ws',
  tokenKey: 'incident_platform_access_token',
  refreshTokenKey: 'incident_platform_refresh_token',
  autoLogoutMinutes: 30,
};