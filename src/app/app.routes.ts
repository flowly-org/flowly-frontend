import { Routes } from '@angular/router';

import { authGuard, guestGuard, staffGuard } from './core/auth.guard';

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
    path: 'join/:token',
    loadComponent: () => import('./pages/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 't/:ref',
    loadComponent: () => import('./pages/task-link/task-link-page').then((m) => m.TaskLinkPage),
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
        path: 'manage',
        canActivate: [staffGuard],
        loadComponent: () => import('./pages/manage/manage-page').then((m) => m.ManagePage),
      },
      { path: 'shared', loadComponent: () => import('./pages/shared/shared-page').then((m) => m.SharedPage) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage) },
      {
        path: 'github/app-created',
        loadComponent: () => import('./pages/github-callback/github-callback').then((m) => m.GithubCallback),
        data: { mode: 'app-created' },
      },
      {
        path: 'github/installed',
        loadComponent: () => import('./pages/github-callback/github-callback').then((m) => m.GithubCallback),
        data: { mode: 'installed' },
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
          {
            path: 'integrations',
            loadComponent: () => import('./pages/integrations/integrations-page').then((m) => m.IntegrationsPage),
          },
          { path: 'members', loadComponent: () => import('./pages/members/members-page').then((m) => m.MembersPage) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
