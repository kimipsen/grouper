import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/sessions', pathMatch: 'full' },
  {
    path: 'sessions',
    loadComponent: () =>
      import('./features/sessions/session-list/session-list').then((module) => module.SessionList),
  },
  {
    path: 'session/:id',
    loadComponent: () =>
      import('./features/sessions/session-detail/session-detail').then((module) => module.SessionDetail),
  },
];
