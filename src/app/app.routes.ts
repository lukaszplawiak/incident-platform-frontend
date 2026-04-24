import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/incidents',
    pathMatch: 'full'
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login),
    title: 'Login — Incident Platform'
  },

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
  }
];