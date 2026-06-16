import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Ante un 401, intenta refrescar el idToken de Firebase con el refreshToken y reintenta
 * la petición original con el token nuevo. Si el refresh falla, cierra sesión con aviso.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  // No interceptar el propio refresh ni el login (evita bucles).
  if (req.url.includes('securetoken.googleapis.com') || req.url.includes('signInWithPassword')) {
    return next(req);
  }

  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) {
        return throwError(() => err);
      }

      // Sin refreshToken no hay forma de renovar → sesión expirada.
      if (!localStorage.getItem('refreshToken')) {
        authService.handleSessionExpired();
        return throwError(() => err);
      }

      return authService.refreshIdToken().pipe(
        switchMap((newToken) => {
          const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
          return next(retried);
        }),
        catchError((refreshErr) => {
          authService.handleSessionExpired();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
