import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';

import { DomainsModule } from 'app/domains/domainsmodule';
import { SetupComponent } from "../../Components/setup/setup.component";
import { UsersComponent } from "../../Components/users/users.component";
import { ProjectsComponent } from "../../Components/projects/projects.component";
import { UsersMenuComponent } from '../../Components/users/users-menu.component';
import { ContractsComponent } from "../../Components/contracts/contracts.component";
import { OilfieldsComponent } from "../../Components/oilfields/oilfields.component";
import { ProvidersComponent } from "../../Components/providers/providers.component";


@Component({
  selector: 'app-proccbpi',
  standalone: true,
  imports: [DomainsModule, SetupComponent, UsersComponent, ProjectsComponent, UsersMenuComponent, ContractsComponent, OilfieldsComponent, ProvidersComponent],
  templateUrl: './proccbpi.component.html',
  styleUrl: './proccbpi.component.scss'
})
export class ProccbpiComponent {

  selectedTab :string = '';

  constructor() {
    // Inicializar la pestaña seleccionada como 'users-menu' (usuarios)
    this.onTabSelected('users-menu');
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
      case 'users-menu':
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Click en la Pestaña Users',
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
