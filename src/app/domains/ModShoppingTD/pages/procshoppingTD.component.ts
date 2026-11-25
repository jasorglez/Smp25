import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';
import { SignalsService } from 'app/services/signals.service';
import { shoppingIconForPermission, shoppingRouteForPermission } from './shopping-menu';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [CommonModule, RouterModule, DomainsModule],
  templateUrl: './procshoppingTD.component.html',
  styleUrl: './procshoppingTD.component.scss',
})
export class ProcShoppingTDComponent {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  get canCleanModule(): boolean { return canSeeWarehouseCleanup(this.signalsService); }

  readonly menuItems = computed(() => {
    const children = this.authService.getUserPermissions()?.shoppingTD?.children || {};
    return Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        identifier,
        name: `modules.shopping.menu.${shoppingRouteForPermission(identifier, permission.permissionName || permission.description)}`,
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
        path: shoppingRouteForPermission(identifier, permission.permissionName || permission.description),
        icon: shoppingIconForPermission(identifier, permission.permissionName || permission.description),
      }))
      .filter(item => item.path && (item.path !== 'module-cleanup' || this.canCleanModule))
      .sort((a, b) => a.order - b.order);
  });

  trackMenuItem(_index: number, item: { identifier: string }): string {
    return item.identifier;
  }
}
