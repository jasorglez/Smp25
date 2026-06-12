import { inject, effect, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SignalsService } from 'app/services/signals.service';

@Injectable({
  providedIn: 'root',
})
export class MasterPermissionsGuard implements CanActivate {
  private permissionService = inject(AuthService);
  private router = inject(Router);
  private signalsService = inject(SignalsService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredPermissions = route.data['permissions'];
    if (!requiredPermissions) {
      return of(true);
    }

    const email = localStorage.getItem('mail');
    if (!email) {
      this.router.navigate(['/login']);
      return of(false);
    }

    if (this.permissionService.isCurrentUserRoot()) {
      return of(true);
    }
    

    const isAdvanced = this.signalsService.getIsAdvanced();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();

    // Si es avanzado pero la sucursal aún no está lista, usamos permisos básicos
    const useAdvanced = isAdvanced && !!idBranch;

    return this.permissionService.getUserId(email).pipe(
      switchMap((userId) =>
        useAdvanced
          ? forkJoin({
              basic: this.permissionService.fetchUserPermissions(userId),
              advanced: this.permissionService.fetchUserPermissionsAdvanced(
                userId,
                idBranch
              ),
            }).pipe(
              map(({ basic, advanced }) =>
                this.permissionService.mergeGuardAdvancedIntoBase(
                  basic.permissions,
                  advanced?.permissions
                )
              )
            )
          : this.permissionService
              .fetchUserPermissions(userId)
              .pipe(map((p) => p.permissions))
      ),
      map((permissionsTree) => {
        const hasMasterPermission =
          permissionsTree?.[requiredPermissions.master]?.active === true;
        const hasDetailedPermission = requiredPermissions.detailed
          ? permissionsTree?.[requiredPermissions.master]?.children?.[
              requiredPermissions.detailed
            ]?.active === true
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
