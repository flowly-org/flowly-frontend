import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  if (await auth.loadMe()) return true;
  return router.parseUrl('/login');
};

export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const next = route.queryParamMap.get('next');
  if (auth.isLoggedIn() || (await auth.loadMe())) return router.parseUrl(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
  return true;
};

export const staffGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user() ?? (await auth.loadMe());
  return user?.is_staff ? true : router.parseUrl('/day');
};
