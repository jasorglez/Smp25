import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class MasterPermissionsGuard implements CanActivate {

  private permissionService =  inject(AuthService);
  private router = inject(Router);

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    // Obtiene el permiso requerido desde la ruta
    const requiredPermissions = route.data['permissions'];
    if (!requiredPermissions) {
      return true;
    }

    // Verifica si el usuario tiene el permiso maestro
    const hasMasterPermission = this.permissionService.hasMasterPermission(
      requiredPermissions.master
    );

    // Verifica si el usuario tiene el permiso detallado (si se especifica)
    const hasDetailedPermission = requiredPermissions.detailed
      ? this.permissionService.hasDetailedPermission(
          requiredPermissions.master,
          requiredPermissions.detailed
        )
      : true;

    // Permite el acceso si tiene ambos permisos
    if (hasMasterPermission && hasDetailedPermission) {
      return true;
    }

    // Redirige a una página de "no autorizado" si no tiene permiso
    this.router.navigate(['/unauthorized']);
    return false;
  }
}