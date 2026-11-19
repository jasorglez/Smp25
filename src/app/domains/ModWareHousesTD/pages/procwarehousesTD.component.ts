import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';
import { SignalsService } from 'app/services/signals.service';
import { saveLastWarehouseRoute } from './warehouse-route-memory';
import { warehouseIconForPermission, warehouseRouteForPermission } from './warehouse-menu';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [CommonModule, RouterModule, DomainsModule],
  templateUrl: './procwarehousesTD.component.html',
  styleUrl: './procwarehousesTD.component.scss',
})
export class ProcWarehousesTDComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  get canCleanModule(): boolean { return canSeeWarehouseCleanup(this.signalsService); }
  private readonly router = inject(Router);
  private routeSubscription?: Subscription;

  readonly menuItems = computed(() => {
    const children = this.authService.getUserPermissions()?.warehousesTD?.children || {};
    return Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        identifier,
        name: permission.permissionName || permission.description || identifier,
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
        path: warehouseRouteForPermission(identifier, permission.permissionName || permission.description),
        icon: warehouseIconForPermission(identifier, permission.permissionName || permission.description),
      }))
      .filter(item => item.path && (item.path !== 'module-cleanup' || this.canCleanModule))
      .sort((a, b) => a.order - b.order);
  });

  trackMenuItem(_index: number, item: { identifier: string }): string {
    return item.identifier;
  }

  ngOnInit(): void {
    this.routeSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => this.rememberWarehouseRoute(event.urlAfterRedirects || event.url));
    this.rememberWarehouseRoute(this.router.url);
    //this.signalsService.setCatalogSelected('SHOPPINGDELISON');
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private rememberWarehouseRoute(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const match = cleanUrl.match(/^\/warehousesTD\/([^/]+)\/?$/);
    if (match) saveLastWarehouseRoute(this.signalsService, match[1]);
  }
}
