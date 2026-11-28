import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Adjunta el Bearer token si falta (red de seguridad; la mayoría de servicios ya lo arman a mano)
// y fuerza logout cuando el backend reporta que esta sesión fue reemplazada por otro login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');

  const authReq = token && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isSessionReplaced = error.status === 401 &&
        (error.error?.message === 'SESSION_REPLACED' || error.error?.data?.message === 'SESSION_REPLACED');
      if (isSessionReplaced) void authService.logout();
      return throwError(() => error);
    })
  );
};
