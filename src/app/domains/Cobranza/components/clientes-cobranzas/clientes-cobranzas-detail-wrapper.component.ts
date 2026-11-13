import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { CustomersCotizacionesComponent } from 'app/domains/ModAdmon/components/customers/customers-cotizaciones.component';
import { CustomersAgendaComponent } from 'app/domains/ModAdmon/components/customers/customers-agenda.component';
import { ClientesCobranzasPagosComponent } from './clientes-cobranzas-pagos.component';

@Component({
  selector: 'app-clientes-cobranzas-detail-wrapper',
  standalone: true,
  imports: [CommonModule, CustomersCotizacionesComponent, CustomersAgendaComponent, ClientesCobranzasPagosComponent],
  template: `
    <app-customers-cotizaciones *ngIf="mode === 'cotizaciones'" [inputCustomer]="customer" [inputIdCompany]="idCompany"></app-customers-cotizaciones>
    <app-customers-agenda *ngIf="mode === 'agenda'" [inputCustomer]="customer" [inputIdCompany]="idCompany"></app-customers-agenda>
    <app-clientes-cobranzas-pagos *ngIf="mode === 'pagos'" [customer]="customer"></app-clientes-cobranzas-pagos>
  `
})
export class ClientesCobranzasDetailWrapperComponent implements ICellRendererAngularComp {
  mode: 'cotizaciones' | 'agenda' | 'pagos' = 'cotizaciones';
  customer: any = null;
  idCompany = 0;
  agInit(params: ICellRendererParams): void {
    this.customer = params.data;
    this.idCompany = (params as any).context?.idCompany ?? 0;
    this.mode = params.data?.__detailMode ?? 'cotizaciones';
  }
  refresh(): boolean { return false; }
}
