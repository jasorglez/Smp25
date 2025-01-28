import { inject, Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {

  private permissionService = inject(AuthService);
  private router = inject(Router);

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const requiredPermission = route.data['permission'] as any;
    
    if (!requiredPermission) {
      return true;
    }

    // Obtener el userId primero
    const userId = await firstValueFrom(this.permissionService.getUserId(localStorage.getItem('mail')));
    
    // Esperar a que los permisos estén cargados
    await firstValueFrom(this.permissionService.loadUserPermissions(userId));

    if (this.permissionService.hasPermission(requiredPermission)) {
      return true;
    }

    this.router.navigate(['/unauthorized']);
    return false;
  }
}