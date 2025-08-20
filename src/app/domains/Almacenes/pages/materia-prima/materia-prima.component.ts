import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-materia-prima',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule],
  templateUrl: './materia-prima.component.html',
  styleUrl: './materia-prima.component.scss'
})
export class MateriaPrimaComponent {

  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  selectedTab: string = '';

  constructor() {
    this.selectedTab = 'materiales-maestro';
  }

  onTabSelected(tabName: string) {
    this.selectedTab = tabName;

    if (tabName === 'materiales-maestro') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Materiales Maestro',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'cat-fam-sub') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Cat-Fam-Sub',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'primera-fase') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Primera Fase',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'primera-fase-historico') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Primera Fase Histórico',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'segunda-fase') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Segunda Fase',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }

    if (tabName === 'segunda-fase-historico') {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Click en la Pestaña Segunda Fase Histórico',
        'Almacenes - Materia Prima',
        this.trackingService.getEmail()
      );
    }
  }
}