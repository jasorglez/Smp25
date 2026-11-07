import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';

export function canSeeWarehouseCleanup(signals: SignalsService): boolean {
  return (signals.getemailChoose() || localStorage.getItem('mail') || '').trim().toLowerCase() === 'root@bi2.mx';
}

export const warehouseCleanupGuard: CanActivateFn = () =>
  canSeeWarehouseCleanup(inject(SignalsService)) || inject(Router).createUrlTree(['/main']);
