import { Routes } from '@angular/router';

import { authGuard, guestGuard, staffGuard } from './core/auth.guard';
import { prefersCompact } from './core/view-mode';

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
    path: 'oauth/authorize',
    loadComponent: () => import('./pages/oauth/oauth-consent').then((m) => m.OAuthConsent),
  },
  {
    path: 'join/:token',
    loadComponent: () => import('./pages/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'm',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/mobile/mobile-day').then((m) => m.MobileDay),
  },
  {
    path: 'apps',
    loadComponent: () => import('./pages/apps/apps-page').then((m) => m.AppsPage),
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
      { path: '', pathMatch: 'full', redirectTo: () => (prefersCompact() ? '/m' : 'day') },
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
            path: 'settings',
            loadComponent: () => import('./pages/workspace-settings/workspace-settings').then((m) => m.WorkspaceSettings),
          },
          { path: 'time', loadComponent: () => import('./pages/time/time-page').then((m) => m.TimePage) },
          { path: 'billing', loadComponent: () => import('./pages/billing/billing-page').then((m) => m.BillingPage) },
          {
            path: 'billing/invoices/:invoiceId',
            loadComponent: () => import('./pages/invoice/invoice-page').then((m) => m.InvoicePage),
          },
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
