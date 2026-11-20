import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from 'app/services/auth.service';

const ROUTE_BY_PERMISSION: Record<string, string> = {
  warehouses: 'warehouses',
  almacenes: 'warehouses',
  materials: 'materials-st',
  materiales: 'materials-st',
  'materials-st': 'materials-st',
  'material-traceability': 'material-traceability',
  traceability: 'material-traceability',
  trazabilidad: 'material-traceability',
  'trazabilidad-de-materiales': 'material-traceability',
  kardex: 'kardex',
  providers: 'providers-st',
  proveedores: 'providers-st',
  'proveedores-de-almacen': 'providers-st',
  proveedor: 'providers-st',
  'providers-st': 'providers-st',
  entry: 'entry-st',
  entries: 'entry-st',
  entradas: 'entry-st',
  'entradas-de-almacen': 'entry-st',
  'entrada-de-almacen': 'entry-st',
  'entry-st': 'entry-st',
  outing: 'outings-st',
  outings: 'outings-st',
  salidas: 'outings-st',
  'salidas-de-almacen': 'outings-st',
  'salida-de-almacen': 'outings-st',
  'outings-st': 'outings-st',
  inventory: 'inventory-st',
  inventario: 'inventory-st',
  'inventory-st': 'inventory-st',
  catalog: 'catalogs',
  catalogs: 'catalogs',
  catalogos: 'catalogs',
  'catalogos-de-movimientos': 'catalogs',
  'catalogos-de-almacen': 'catalogs',
  setup: 'setup-st',
  config: 'setup-st',
  configuracion: 'setup-st',
  'configuracion-de-almacenes': 'setup-st',
  'configuracion-de-almacen': 'setup-st',
  'setup-st': 'setup-st',
  projects: 'projects',
  proyectos: 'projects',
  'module-cleanup': 'module-cleanup',
  cleanup: 'module-cleanup',
  limpieza: 'module-cleanup',
  'limpieza-de-almacen-y-compras': 'module-cleanup',
};

const ICON_BY_PERMISSION: Record<string, string> = {
  warehouses: 'bi-houses', almacenes: 'bi-houses',
  materials: 'bi-box-seam', materiales: 'bi-box-seam', 'materials-st': 'bi-box-seam',
  'material-traceability': 'bi-diagram-3', traceability: 'bi-diagram-3', trazabilidad: 'bi-diagram-3', 'trazabilidad-de-materiales': 'bi-diagram-3',
  kardex: 'bi-journal-arrow-up',
  providers: 'bi-people-fill', proveedores: 'bi-people-fill', 'proveedores-de-almacen': 'bi-people-fill', 'providers-st': 'bi-people-fill',
  entry: 'bi-inbox-fill', entries: 'bi-inbox-fill', entradas: 'bi-inbox-fill', 'entradas-de-almacen': 'bi-inbox-fill', 'entry-st': 'bi-inbox-fill',
  outing: 'bi-upload', outings: 'bi-upload', salidas: 'bi-upload', 'salidas-de-almacen': 'bi-upload', 'outings-st': 'bi-upload',
  inventory: 'bi-list-check', inventario: 'bi-list-check', 'inventory-st': 'bi-list-check',
  catalog: 'bi-journal-text', catalogs: 'bi-journal-text', catalogos: 'bi-journal-text', 'catalogos-de-movimientos': 'bi-journal-text',
  setup: 'bi-gear-fill', config: 'bi-gear-fill', configuracion: 'bi-gear-fill', 'configuracion-de-almacenes': 'bi-gear-fill', 'setup-st': 'bi-gear-fill',
  projects: 'bi-kanban', proyectos: 'bi-kanban',
  'module-cleanup': 'bi-trash3', cleanup: 'bi-trash3', limpieza: 'bi-trash3', 'limpieza-de-almacen-y-compras': 'bi-trash3',
};

export function normalizeWarehousePermission(identifier: string): string {
  return String(identifier || '').trim().toLocaleLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '-');
}

export function warehouseRouteForPermission(identifier: string, permissionName?: string): string | null {
  const key = normalizeWarehousePermission(identifier);
  const labelKey = normalizeWarehousePermission(permissionName || '');
  return ROUTE_BY_PERMISSION[key] || ROUTE_BY_PERMISSION[labelKey] || null;
}

export function warehouseIconForPermission(identifier: string, permissionName?: string): string {
  const key = normalizeWarehousePermission(identifier);
  const labelKey = normalizeWarehousePermission(permissionName || '');
  return ICON_BY_PERMISSION[key] || ICON_BY_PERMISSION[labelKey] || 'bi-grid';
}

export const warehouseMenuPermissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const targetRoute = String(route.data['warehouseMenuRoute'] || '');
  const permissions = auth.getUserPermissions()?.warehousesTD?.children || {};
  const allowed = Object.entries(permissions).some(([identifier, permission]: [string, any]) =>
    permission?.active === true && warehouseRouteForPermission(identifier, permission?.permissionName || permission?.description) === targetRoute
      && auth.hasDetailedPermission('warehousesTD', identifier)
  );
  if (allowed) return true;
  const isWorkspaceRestore = router.getCurrentNavigation()?.extras.state?.['restoreWorkspace'] === true;
  return router.createUrlTree([isWorkspaceRestore ? '/publicidad' : '/unauthorized']);
};
