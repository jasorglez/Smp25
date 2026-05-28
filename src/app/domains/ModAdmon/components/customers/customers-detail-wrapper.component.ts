import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { CustomersCotizacionesComponent } from './customers-cotizaciones.component';
import { CustomersAgendaComponent } from './customers-agenda.component';

/**
 * Wrapper ICellRendererAngularComp para el masterDetail de CustomersComponent.
 * Lee `params.data.__detailMode` para decidir qué componente hijo renderizar:
 *   - 'cotizaciones'  → CustomersCotizacionesComponent
 *   - 'agenda'        → CustomersAgendaComponent
 */
@Component({
  selector: 'app-customers-detail-wrapper',
  standalone: true,
  imports: [CommonModule, CustomersCotizacionesComponent, CustomersAgendaComponent],
  template: `
    <app-customers-cotizaciones
      *ngIf="mode === 'cotizaciones'"
      [inputCustomer]="customer"
      [inputIdCompany]="idCompany">
    </app-customers-cotizaciones>

    <app-customers-agenda
      *ngIf="mode === 'agenda'"
      [inputCustomer]="customer"
      [inputIdCompany]="idCompany">
    </app-customers-agenda>
  `,
})
export class CustomersDetailWrapperComponent implements ICellRendererAngularComp {
  mode:      'cotizaciones' | 'agenda' = 'cotizaciones';
  customer:  any    = null;
  idCompany: number = 0;

  agInit(params: ICellRendererParams): void {
    this.customer  = params.data;
    this.idCompany = (params as any).context?.idCompany ?? 0;
    this.mode      = params.data?.__detailMode ?? 'cotizaciones';
  }

  refresh(): boolean { return false; }
}
