import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { SessionService } from './core/services/session.service';

const sessionNameTitle: ResolveFn<string> = (route) =>
  inject(SessionService).sessions().find((session) => session.id === route.paramMap.get('id'))?.name ?? '';

export const routes: Routes = [
  { path: '', redirectTo: '/sessions', pathMatch: 'full' },
  {
    path: 'sessions',
    title: 'sessionList.title',
    loadComponent: () =>
      import('./features/sessions/session-list/session-list').then((module) => module.SessionList),
  },
  {
    path: 'session/:id',
    title: sessionNameTitle,
    loadComponent: () =>
      import('./features/sessions/session-detail/session-detail').then((module) => module.SessionDetail),
  },
];
