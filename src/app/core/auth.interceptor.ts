import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

const isAuthCall = (url: string) => /\/auth\/(login|register|refresh)\/$/.test(url);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (isAuthCall(req.url)) return next(req);

  return next(withToken(req, auth.token)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.hasSession) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError((refreshErr) => {
          auth.logout();
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
