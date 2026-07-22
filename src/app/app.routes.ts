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

  {
    path: '**',
    redirectTo: '/incidents'
  },

  {
    path: 'mfa-settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/mfa-settings/mfa-settings')
        .then(m => m.MfaSettings),
    title: 'Account Security — Incident Platform'
  },
];