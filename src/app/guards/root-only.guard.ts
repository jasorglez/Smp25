import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from 'app/services/auth.service';

/** Permite acceso al usuario root: por email de entorno O por flag isRoot de la BD. */
@Injectable({
  providedIn: 'root',
})
export class RootOnlyGuard implements CanActivate {
  private router = inject(Router);
  private authService = inject(AuthService);

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean> {
    if (!this.authService.isCurrentUserRoot()) {
      this.router.navigate(['/main']);
      return of(false);
    }
    return of(true);
  }
}
