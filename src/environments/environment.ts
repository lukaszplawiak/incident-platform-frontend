export const environment = {
  production: false,
  apiUrl: 'http://localhost:8082',
  authApiUrl: 'http://localhost:8081',
  oncallApiUrl: 'http://localhost:8086',
  wsUrl: 'ws://localhost:8082/ws',
  tokenKey: 'incident_platform_token',
  autoLogoutMinutes: 30,
  devDefaults: {
    userId: 'user-1',
    tenantId: 'acme-corp'
  }
};