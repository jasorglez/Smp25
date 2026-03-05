import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { SignalsService } from 'app/services/signals.service';

/** Solo permite acceso al usuario con correo root (root@bi2.mx). */
@Injectable({
  providedIn: 'root',
})
export class RootOnlyGuard implements CanActivate {
  private router = inject(Router);
  private signalsService = inject(SignalsService);

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean> {
    const email = this.signalsService.getemailChoose() || localStorage.getItem('mail') || '';
    const isRoot = email.toLowerCase() === (environment.root || 'root@bi2.mx').toLowerCase();
    if (!isRoot) {
      this.router.navigate(['/main']);
      return of(false);
    }
    return of(true);
  }
}
