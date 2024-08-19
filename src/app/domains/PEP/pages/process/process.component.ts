import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SettingComponent } from "../../components/setting/setting.component";
import { ReportdailyComponent } from "../../components/reportdaily/reportdaily.component";
import { ContractsComponent } from "../../components/contract/contracts.component";
import { ProjectComponent } from "../../components/project/project.component";


@Component({
  selector: 'app-process',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TranslateModule, SettingComponent,
    ReportdailyComponent, ContractsComponent, ProjectComponent],
  templateUrl: './process.component.html',
  styleUrl: './process.component.scss'
})
export class ProcessComponent {

   selectedTab :string = '';

   constructor() {
       this.selectedTab = 'conf' ;
   }

  //aqui inyecto de la nueva manera
    private trackingService = inject(TrackingService) ;

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    if (tabName === 'conf') {
      this.trackingService.addLog(
         this.trackingService.getnameComp(),
        'Click en la Pestaña Configuraciones',
        'Warehouses',
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
