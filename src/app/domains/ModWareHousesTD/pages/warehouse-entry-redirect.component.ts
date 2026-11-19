import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { getLastWarehouseRoute } from './warehouse-route-memory';
import { warehouseRouteForPermission } from './warehouse-menu';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';

@Component({
  selector: 'app-warehouse-entry-redirect',
  standalone: true,
  template: '<div class="p-3 text-muted">Abriendo Almacenes…</div>'
})
export class WarehouseEntryRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly signalsService = inject(SignalsService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const children = this.authService.getUserPermissions()?.warehousesTD?.children || {};
    const availableRoutes = Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        path: warehouseRouteForPermission(identifier, permission.permissionName || permission.description),
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
        identifier,
      }))
      .filter(item => item.path
        && this.authService.hasDetailedPermission('warehousesTD', item.identifier)
        && (item.path !== 'module-cleanup' || canSeeWarehouseCleanup(this.signalsService)))
      .sort((a, b) => a.order - b.order);
    const rememberedRoute = getLastWarehouseRoute(this.signalsService);
    const destination = availableRoutes.find(item => item.path === rememberedRoute)?.path || availableRoutes[0]?.path;
    void this.router.navigate(destination ? ['/warehousesTD', destination] : ['/unauthorized'], { replaceUrl: true });
  }
}
