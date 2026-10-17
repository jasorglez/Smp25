import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';
import { getLastWarehouseRoute } from './warehouse-route-memory';

@Component({
  selector: 'app-warehouse-entry-redirect',
  standalone: true,
  template: '<div class="p-3 text-muted">Abriendo Almacenes…</div>'
})
export class WarehouseEntryRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly signalsService = inject(SignalsService);

  ngOnInit(): void {
    void this.router.navigate(['/warehousesTD', getLastWarehouseRoute(this.signalsService)], { replaceUrl: true });
  }
}
