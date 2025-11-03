import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procalmacenes',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule],
  templateUrl: './procalmacenes.component.html',
  styleUrl: './procalmacenes.component.scss'
})
export class ProcalmacenesComponent {

  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  selectedTab: string = '';

  constructor() {
    this.selectedTab = 'materia-prima';
    this.signalsService.setCatalogSelected('WAREHOUSE');
  }

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    if (tabName === 'materia-prima') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Materia Prima',
        'Almacenes',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'compras') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Compras',
        'Almacenes',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'catalogo') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Catálogo',
        'Almacenes',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'configuracion') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Configuración',
        'Almacenes',
        this.trackingService.getEmail()
      );
    }
  }
}