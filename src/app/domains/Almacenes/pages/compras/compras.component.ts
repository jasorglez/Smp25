import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule],
  templateUrl: './compras.component.html',
  styleUrl: './compras.component.scss'
})
export class ComprasComponent {

  private trackingService = inject(TrackingService);

  selectedTab: string = '';

  constructor() {
    this.selectedTab = 'proveedores';
  }

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    if (tabName === 'proveedores') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Proveedores',
        'Almacenes - Compras',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'requisiciones') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Requisiciones',
        'Almacenes - Compras',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'ordenes-compra') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Ordenes Compra',
        'Almacenes - Compras',
        this.trackingService.getEmail()
      );
    }
  }
}
