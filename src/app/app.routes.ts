import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/incidents',
    pathMatch: 'full'
  },

  // ── Public auth routes ─────────────────────────────────────────────────────

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login),
    title: 'Login — Incident Platform'
  },

  {
    path: 'auth/mfa',
    loadComponent: () =>
      import('./features/auth/mfa-verify/mfa-verify')
        .then(m => m.MfaVerify),
    title: 'Two-Factor Authentication — Incident Platform'
  },

  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/accept-invite/accept-invite')
        .then(m => m.AcceptInvite),
    title: 'Accept Invitation — Incident Platform'
  },

  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password')
        .then(m => m.ForgotPassword),
    title: 'Forgot Password — Incident Platform'
  },

  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password')
        .then(m => m.ResetPassword),
    title: 'Reset Password — Incident Platform'
  },

  {
    // No canActivate guard — deliberately, same reasoning as auth/mfa above:
    // reached mid-login (tenant requires MFA, user has none configured yet),
    // before any access token exists. Identified by mfaSetupToken passed via
    // router state from Login, not by an authenticated session.
    path: 'mfa-setup-required',
    loadComponent: () =>
      import('./features/auth/mfa-setup-required/mfa-setup-required')
        .then(m => m.MfaSetupRequired),
    title: 'Set Up Two-Factor Authentication — Incident Platform'
  },

  // ── Protected routes ───────────────────────────────────────────────────────

  {
    path: 'incidents',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/incidents/dashboard/dashboard')
        .then(m => m.Dashboard),
    title: 'Dashboard — Incident Platform'
  },

  {
    path: 'incidents/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/incidents/incident-detail/incident-detail')
        .then(m => m.IncidentDetail),
    title: 'Incident Detail — Incident Platform'
  },

  {
    // authGuard, not adminGuard — every user manages their own MFA,
    // this has nothing to do with the ROLE_ADMIN/ROLE_RESPONDER distinction.
    path: 'mfa-settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/mfa-settings/mfa-settings')
        .then(m => m.MfaSettings),
    title: 'Account Security — Incident Platform'
  },

  // ── Admin routes (ROLE_ADMIN required) ────────────────────────────────────

  {
    path: 'admin/users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/users/users')
        .then(m => m.Users),
    title: 'Users — Incident Platform'
  },

  {
    path: 'admin/teams',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/teams/teams')
        .then(m => m.Teams),
    title: 'Teams — Incident Platform'
  },

  {
    path: 'admin/integrations',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/integrations/integrations')
        .then(m => m.Integrations),
    title: 'Integrations — Incident Platform'
  },

  {
    path: 'admin/settings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/tenant-settings/tenant-settings')
        .then(m => m.TenantSettings),
    title: 'Tenant Settings — Incident Platform'
  },

  // ── Error routes ───────────────────────────────────────────────────────────

  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/errors/forbidden/forbidden')
        .then(m => m.Forbidden),
    title: '403 Forbidden — Incident Platform'
  },

  {
    path: 'error',
    loadComponent: () =>
      import('./features/errors/error/error')
        .then(m => m.Error),
    title: 'Error — Incident Platform'
  },

  // ── Wildcard — MUST remain the last entry ───────────────────────────────────
  //
  // Fixed: this route previously sat BEFORE mfa-settings, mfa-setup-required,
  // and admin/settings below it in the array. Angular Router matches routes
  // sequentially in declaration order — the first match wins, and '**'
  // matches literally any path — so all three of those routes were
  // completely unreachable: any navigation to them was caught here and
  // redirected to /incidents first. For mfa-setup-required specifically,
  // this silently recreated the exact permanent MFA lockout the backend fix
  // (LoginResponse.mfaSetupRequired) was written to prevent: Login
  // correctly navigated to /mfa-setup-required, but the router intercepted
  // that navigation before ever reaching this route's real definition,
  // sending the user to /incidents → (no access token yet) → authGuard
  // redirect to /login, with no way to complete the MFA setup that was
  // blocking their login in the first place.
  {
    path: '**',
    redirectTo: '/incidents'
  }
];