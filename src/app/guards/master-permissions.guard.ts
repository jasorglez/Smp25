import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MasterPermissionsGuard implements CanActivate {

  private permissionService = inject(AuthService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredPermissions = route.data['permissions'];
    if (!requiredPermissions) {
      return new Observable<boolean>((observer) => {
        observer.next(true);
        observer.complete();
      });
    }

    const email = localStorage.getItem('mail');
    if (!email) {
      this.router.navigate(['/login']);
      return new Observable<boolean>((observer) => {
        observer.next(false);
        observer.complete();
      });
    }

    return this.permissionService.getUserId(email).pipe(
      switchMap((userId) => this.permissionService.fetchUserPermissions(userId)),
      map((permissions) => {
        this.permissionService.setUserPermissions(permissions.permissions);
        const hasMasterPermission = this.permissionService.hasMasterPermission(
          requiredPermissions.master
        );
        const hasDetailedPermission = requiredPermissions.detailed
          ? this.permissionService.hasDetailedPermission(
            requiredPermissions.master,
            requiredPermissions.detailed
          )
          : true;

        if (hasMasterPermission && hasDetailedPermission) {
          return true;
        } else {
          this.router.navigate(['/unauthorized']);
          return false;
        }
      })
    );
  }
}
