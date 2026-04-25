import { inject, effect, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';
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
      console.warn('[Guard] Sin email en localStorage → redirigiendo a /login');
      this.router.navigate(['/login']);
      return of(false);
    }

    // Usuario root tiene acceso a todo
    const userRoot = this.signalsService.getUserRoot()();
    console.log(`[Guard] userRoot=${userRoot} | isRoot=${userRoot == 1}`);
    if (userRoot == 1) {
      return of(true);
    }

    const isAdvanced = this.signalsService.getIsAdvanced();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();

    console.log(`[Guard] Ruta: ${state.url} | Permiso requerido: master="${requiredPermissions.master}"${requiredPermissions.detailed ? ` detailed="${requiredPermissions.detailed}"` : ''} | isAdvanced=${isAdvanced} | idBranch=${idBranch}`);

    if (isAdvanced && !idBranch) {
      console.warn('[Guard] BLOQUEADO: isAdvanced=true pero idBranch es null/0. El sidebar aún no cargó la sucursal.');
      this.router.navigate(['/unauthorized']);
      return of(false);
    }

    // Si ya hay permisos cacheados del login, usarlos directamente
    const cachedPermissions = this.permissionService.getUserPermissions();
    if (cachedPermissions && Object.keys(cachedPermissions).length > 0) {
      const hasMasterPermission = this.permissionService.hasMasterPermission(requiredPermissions.master);
      const hasDetailedPermission = requiredPermissions.detailed
        ? this.permissionService.hasDetailedPermission(requiredPermissions.master, requiredPermissions.detailed)
        : true;

      console.log(`[Guard] Usando permisos cacheados | hasMaster=${hasMasterPermission} | hasDetailed=${hasDetailedPermission}`);

      if (hasMasterPermission && hasDetailedPermission) {
        return of(true);
      } else {
        console.warn(`[Guard] BLOQUEADO (cache): master "${requiredPermissions.master}" → hasMaster=${hasMasterPermission}, hasDetailed=${hasDetailedPermission}`);
        this.router.navigate(['/unauthorized']);
        return of(false);
      }
    }

    // Sin caché: fetch desde el servidor
    return this.permissionService.getUserId(email).pipe(
      switchMap((userId) => {
        console.log(`[Guard] userId=${userId} | Modo: ${isAdvanced ? 'Advanced (branch=' + idBranch + ')' : 'Normal'}`);
        return isAdvanced
          ? this.permissionService.fetchUserPermissionsAdvanced(userId, idBranch)
          : this.permissionService.fetchUserPermissions(userId);
      }),
      map((permissions) => {
        if (permissions.permissions && Object.keys(permissions.permissions).length > 0) {
          this.permissionService.setUserPermissions(permissions.permissions);
        }
        const hasMasterPermission = this.permissionService.hasMasterPermission(requiredPermissions.master);
        const hasDetailedPermission = requiredPermissions.detailed
          ? this.permissionService.hasDetailedPermission(requiredPermissions.master, requiredPermissions.detailed)
          : true;

        console.log(`[Guard] hasMaster=${hasMasterPermission} | hasDetailed=${hasDetailedPermission} | permisos recibidos:`, permissions.permissions);

        if (hasMasterPermission && hasDetailedPermission) {
          return true;
        } else {
          console.warn(`[Guard] BLOQUEADO: master "${requiredPermissions.master}" → hasMaster=${hasMasterPermission}, hasDetailed=${hasDetailedPermission}`);
          this.router.navigate(['/unauthorized']);
          return false;
        }
      })
    );
  }
}
