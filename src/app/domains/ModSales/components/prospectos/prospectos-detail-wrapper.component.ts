import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { DetalleInteraccionesComponent } from './detalle-interacciones.component';
import { ProspectosAgendaComponent } from './prospectos-agenda.component';

@Component({
  selector: 'app-prospectos-detail-wrapper',
  standalone: true,
  imports: [CommonModule, DetalleInteraccionesComponent, ProspectosAgendaComponent],
  template: `
    <app-detalle-interacciones
      *ngIf="mode === 'interacciones'">
    </app-detalle-interacciones>

    <app-prospectos-agenda
      *ngIf="mode === 'agenda'"
      [inputProspecto]="prospecto"
      [inputIdCompany]="idCompany">
    </app-prospectos-agenda>
  `,
})
export class ProspectosDetailWrapperComponent implements ICellRendererAngularComp {
  mode:      'interacciones' | 'agenda' = 'interacciones';
  prospecto: any    = null;
  idCompany: number = 0;

  agInit(params: ICellRendererParams): void {
    this.prospecto = params.data;
    this.idCompany = (params as any).context?.idCompany ?? 0;
    this.mode      = params.data?.__detailMode ?? 'interacciones';
  }

  refresh(): boolean { return false; }
}
