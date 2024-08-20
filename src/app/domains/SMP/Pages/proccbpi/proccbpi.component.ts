import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';

import { DomainsModule } from 'app/domains/domainsmodule';
import { SetupComponent } from "../../Components/setup/setup.component";
import { LogbookComponent } from '../../Components/logbook/logbook.component';

@Component({
  selector: 'app-proccbpi',
  standalone: true,
  imports: [DomainsModule, SetupComponent, LogbookComponent],
  templateUrl: './proccbpi.component.html',
  styleUrl: './proccbpi.component.scss'
})
export class ProccbpiComponent {

  selectedTab :string = '';

  constructor() {
    // Inicializar la pestaña seleccionada como 'bl' (booklogs)
    this.onTabSelected('bl');
  }

  //inject new way
  private trackingService = inject(TrackingService) ;

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    switch (tabName) {
      case 'conf':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Configuraciones',
          'Warehouses',
          this.trackingService.getEmail()
        );
        this.trackingService.setbandform('REQUIS');
        break;
      case 'bl':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Booklogs',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
      case 'contract':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Contratos',
          'Warehouses',
          this.trackingService.getEmail()
        );
        this.trackingService.setbandform('OC');
        break;
      case 'oil':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Campos Petroleros',
          'Warehouses',
          this.trackingService.getEmail()
        );
        this.trackingService.setbandformEO('ENT');
        break;
      case 'proj':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Proyectos',
          'Warehouses',
          this.trackingService.getEmail()
        );
        this.trackingService.setbandformEO('OUT');
        break;
      case 'sec':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Seguridad',
          'Warehouses',
          this.trackingService.getEmail()
        );
        this.trackingService.setbandformEO('OUT');
        break;
    }
  }


}
