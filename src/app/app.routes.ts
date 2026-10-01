import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/auth-page').then((m) => m.AuthPage),
    data: { mode: 'login' },
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/auth-page').then((m) => m.AuthPage),
    data: { mode: 'register' },
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'day' },
      {
        path: 'day',
        loadComponent: () => import('./pages/day-board/day-board').then((m) => m.DayBoard),
        data: { mode: 'global' },
      },
      {
        path: 'w/:wsId',
        loadComponent: () => import('./pages/workspace-host/workspace-host').then((m) => m.WorkspaceHost),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'board' },
          { path: 'day', redirectTo: 'board' },
          {
            path: 'board',
            loadComponent: () => import('./pages/day-board/day-board').then((m) => m.DayBoard),
            data: { mode: 'workspace' },
          },
          { path: 'projects', loadComponent: () => import('./pages/projects/projects-page').then((m) => m.ProjectsPage) },
          { path: 'tags', loadComponent: () => import('./pages/tags/tags-page').then((m) => m.TagsPage) },
          { path: 'members', loadComponent: () => import('./pages/members/members-page').then((m) => m.MembersPage) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
