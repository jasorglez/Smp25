import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-producto-terminado',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule],
  templateUrl: './producto-terminado.component.html',
  styleUrl: './producto-terminado.component.scss'
})
export class ProductoTerminadoComponent {

  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  selectedTab: string = '';

  constructor() {
    this.selectedTab = 'cat-prod-term';
    this.signalsService.setCatalogSelected('WAREHOUSE');
  }

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    if (tabName === 'cat-prod-term') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Cat-Prod-Term',
        'Almacenes - Productos Terminados',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'productos-terminados') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Productos Terminados',
        'Almacenes - Productos Terminados',
        this.trackingService.getEmail()
      );
    }
  }
}
