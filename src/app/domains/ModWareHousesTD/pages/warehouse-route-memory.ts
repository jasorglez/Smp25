import { SignalsService } from 'app/services/signals.service';

const WAREHOUSE_ROUTES = new Set([
  'warehouses',
  'materials-st',
  'material-traceability',
  'kardex',
  'providers-st',
  'entry-st',
  'outings-st',
  'inventory-st',
  'setup-st'
]);

function storageKey(signalsService: SignalsService): string {
  const email = signalsService.getemailChoose() || localStorage.getItem('mail') || 'default';
  return `lastWarehouseRoute:${email.toLocaleLowerCase()}`;
}

export function getLastWarehouseRoute(signalsService: SignalsService): string {
  const route = localStorage.getItem(storageKey(signalsService)) || '';
  return WAREHOUSE_ROUTES.has(route) ? route : 'materials-st';
}

export function saveLastWarehouseRoute(signalsService: SignalsService, route: string): void {
  if (WAREHOUSE_ROUTES.has(route)) {
    localStorage.setItem(storageKey(signalsService), route);
  }
}
