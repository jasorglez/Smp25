import { Component, inject } from '@angular/core';
import { TrackingService } from '../../../../services/tracking.service';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procadmon',
  standalone: true,
  imports: [DomainsModule],
  templateUrl: './procadmon.component.html',
  styleUrl: './procadmon.component.scss'
})
export class ProcadmonComponent {

  selectedTab :string = 'conf';

  //aqui inyecto de la nueva manera
private trackingService = inject(TrackingService) ;

onTabSelected(tabName: string) {
  this.selectedTab = tabName;

  if (tabName === 'conf') {
    this.trackingService.addLog(
       this.trackingService.getnameComp(),
      'Click en la Pestaña Configuraciones',
      'Admon App',
      this.trackingService.getEmail()
    );
    this.trackingService.setbandform('REQUIS')
  }

  if (tabName === 'contract') {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Click en la Pestaña Contratos',
      'Warehouses',
      this.trackingService.getEmail()
    );
    this.trackingService.setbandform('OC')
  }

  if (tabName === 'oil') {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Click en la Pestaña Campos Petroleros',
      'Warehouses',
      this.trackingService.getEmail()
    );
    this.trackingService.setbandformEO('ENT')
  }

  if (tabName === 'proj') {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Click en la Pestaña Poyectos',
      'Warehouses',
      this.trackingService.getEmail()
    );
    this.trackingService.setbandformEO('OUT')
  }

  if (tabName === 'sec') {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Click en la Pestaña Seguridad',
      'Warehouses',
      this.trackingService.getEmail()
    );
    this.trackingService.setbandformEO('OUT')
  }
}

}
