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
import { WorkspaceTabsService } from 'app/services/workspace-tabs.service';

@Injectable({
  providedIn: 'root',
})
export class MasterPermissionsGuard implements CanActivate {
  private permissionService = inject(AuthService);
  private router = inject(Router);
  private signalsService = inject(SignalsService);
  private workspaceTabs = inject(WorkspaceTabsService);

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
    

    const companyId = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
    return this.permissionService.getUserId(email).pipe(
      switchMap(userId => this.permissionService.fetchUserPermissions(userId, companyId)),
      map((permissions) => {
        if (companyId !== Number(this.signalsService.getRootSelectedBySidebar()() || 0)) return false;
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
          this.workspaceTabs.remove(state.url);
          this.router.navigate(['/unauthorized']);
          return false;
        }
      })
    );
  }
}
