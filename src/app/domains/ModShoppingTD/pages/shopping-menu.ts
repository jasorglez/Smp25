import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'app/services/auth.service';

const ROUTE_BY_PERMISSION: Record<string, string> = {
  providers: 'providers-st', proveedores: 'providers-st', 'providers-st': 'providers-st',
  materials: 'materials-st', materiales: 'materials-st', 'materials-st': 'materials-st',
  requisitions: 'requisitions-st', requisicion: 'requisitions-st', requisiciones: 'requisitions-st', 'requisitions-st': 'requisitions-st',
  quotes: 'quotes-st', cotizacion: 'quotes-st', cotizaciones: 'quotes-st', 'quotes-st': 'quotes-st',
  purchaseorder: 'purchaseorder-st', 'purchase-order': 'purchaseorder-st', 'purchase-orders': 'purchaseorder-st', 'purchaseorder-st': 'purchaseorder-st',
  'orden-compra': 'purchaseorder-st', 'orden-de-compra': 'purchaseorder-st', 'orden-de-compras': 'purchaseorder-st',
  'ordenes-de-compra': 'purchaseorder-st', 'ordenes-de-compras': 'purchaseorder-st',
  setup: 'setupwarehouse', config: 'setupwarehouse', configuracion: 'setupwarehouse',
  'setupwarehouse': 'setupwarehouse', 'configuracion-de-compras': 'setupwarehouse',
  catalogs: 'catalogs', catalogos: 'catalogs', 'catalogos-de-compras': 'catalogs',
  families: 'fam-subfam', familias: 'fam-subfam', 'familias-y-subfamilias': 'fam-subfam', 'fam-subfam': 'fam-subfam',
  project: 'projects', projects: 'projects', proyectos: 'projects',
  'module-cleanup': 'module-cleanup', cleanup: 'module-cleanup', limpieza: 'module-cleanup',
  'limpieza-de-almacen-y-compras': 'module-cleanup',
};

export function shoppingRouteForPermission(identifier: string, permissionName?: string): string | null {
  const normalize = (value: string) => String(value || '').trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLocaleLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '-');
  return ROUTE_BY_PERMISSION[normalize(identifier)] || ROUTE_BY_PERMISSION[normalize(permissionName || '')] || null;
}

const ICON_BY_ROUTE: Record<string, string> = {
  'providers-st': 'bi-people-fill',
  'materials-st': 'bi-archive-fill',
  'requisitions-st': 'bi-list-task',
  'quotes-st': 'bi-file-earmark-text',
  'purchaseorder-st': 'bi-cart-fill',
  catalogs: 'bi-journal-text',
  'fam-subfam': 'bi-diagram-3',
  setupwarehouse: 'bi-gear-fill',
  projects: 'bi-kanban',
  'module-cleanup': 'bi-trash3',
};

export function shoppingIconForPermission(identifier: string, permissionName?: string): string {
  const path = shoppingRouteForPermission(identifier, permissionName);
  return ICON_BY_ROUTE[path || ''] || 'bi-grid';
}

export const shoppingMenuPermissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const targetRoute = String(route.data['shoppingMenuRoute'] || route.routeConfig?.path || '');
  const children = auth.getUserPermissions()?.shoppingTD?.children || {};
  const allowed = Object.entries(children).some(([identifier, permission]: [string, any]) =>
    permission?.active === true
      && shoppingRouteForPermission(identifier, permission?.permissionName || permission?.description) === targetRoute
      && auth.hasDetailedPermission('shoppingTD', identifier)
  );
  if (allowed) return true;
  const isWorkspaceRestore = router.getCurrentNavigation()?.extras.state?.['restoreWorkspace'] === true;
  return router.createUrlTree([isWorkspaceRestore ? '/publicidad' : '/unauthorized']);
};
