import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';
import { shoppingRouteForPermission } from './shopping-menu';

@Component({
  selector: 'app-shopping-entry-redirect',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-3 text-muted" *ngIf="!hasRoutes">No hay accesos de Compras activos vinculados a una pantalla.</div>'
})
export class ShoppingEntryRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly signalsService = inject(SignalsService);
  hasRoutes = false;

  ngOnInit(): void {
    const children = this.authService.getUserPermissions()?.shoppingTD?.children || {};
    const routes = Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        identifier,
        path: shoppingRouteForPermission(identifier, permission.permissionName || permission.description),
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
      }))
      .filter(item => item.path
        && this.authService.hasDetailedPermission('shoppingTD', item.identifier)
        && (item.path !== 'module-cleanup' || canSeeWarehouseCleanup(this.signalsService)))
      .sort((a, b) => a.order - b.order);
    if (routes[0]?.path) {
      this.hasRoutes = true;
      void this.router.navigate(['/shoppingTD', routes[0].path], { replaceUrl: true });
    }
  }
}
