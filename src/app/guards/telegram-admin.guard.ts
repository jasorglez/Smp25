import { inject, Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';

const ALLOWED_EMAILS = ['root@bi2.mx', 'asoriano@bi2.mx'];

@Injectable({ providedIn: 'root' })
export class TelegramAdminGuard implements CanActivate {
  private router = inject(Router);
  private signalsService = inject(SignalsService);

  canActivate(_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean> {
    const email = (this.signalsService.getemailChoose() || localStorage.getItem('mail') || '').toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      this.router.navigate(['/main']);
      return of(false);
    }
    return of(true);
  }
}
