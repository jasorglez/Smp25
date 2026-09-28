import { inject, effect, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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
    // Siempre verificar autenticación primero
    const email = localStorage.getItem('mail');
    if (!email) {
      this.router.navigate(['/login']);
      return of(false);
    }

    const requiredPermissions = route.data['permissions'];
    if (!requiredPermissions) {
      return of(true);
    }
    

    // Leemos los valores de los signals aquí, dentro de canActivate
    const isAdvanced = this.signalsService.getIsAdvanced();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();

    // Si es avanzado pero aún no se selecciona una sucursal, no podemos verificar permisos avanzados.
    // Sin una sucursal real se consultan los permisos básicos del usuario.

    return this.permissionService.getUserId(email).pipe(
      switchMap((userId) => {
        const basicPermissions = () => this.permissionService.fetchUserPermissions(userId);
        if (!isAdvanced || !idBranch || idBranch <= 0) {
          return basicPermissions();
        }

        return this.permissionService.fetchUserPermissionsAdvanced(userId, idBranch).pipe(
          switchMap((data: any) => data?.permissions && Object.keys(data.permissions).length > 0
            ? of(data)
            : basicPermissions()),
          catchError(() => basicPermissions())
        );
      }),
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
