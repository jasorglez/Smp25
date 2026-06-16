import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { PdfDetailComponent }        from './pdf-detail.component';
import { BitacoraTimesInactivosComponent } from './bitacora-tiempos-inactivos.component';
import { BitacoraPersonalComponent }  from './bitacora-personal.component';
import { BitacoraMaterialComponent }  from './bitacora-material.component';
import { BitacoraEquiposComponent }   from './bitacora-equipos.component';
import { BitacoraFotosComponent }     from './bitacora-fotos.component';
import { BitacoraVideosComponent }    from './bitacora-videos.component';
import { BitacoraConceptosComponent } from './bitacora-conceptos.component';
import { BitacoraNotasComponent }     from './bitacora-notas.component';

@Component({
  selector: 'app-bitacora-wrapper',
  standalone: true,
  imports: [
    CommonModule,
    PdfDetailComponent,
    BitacoraTimesInactivosComponent,
    BitacoraPersonalComponent, BitacoraMaterialComponent, BitacoraEquiposComponent,
    BitacoraFotosComponent, BitacoraVideosComponent,
    BitacoraConceptosComponent, BitacoraNotasComponent,
  ],
  template: `
<ng-container [ngSwitch]="detailType">
  <app-pdf-detail                  *ngSwitchCase="'pdf'"      [data]="data" [context]="ctx"></app-pdf-detail>
  <app-bitacora-tiempos-inactivos  *ngSwitchCase="'tiempos'"  [data]="data" [context]="ctx"></app-bitacora-tiempos-inactivos>
  <app-bitacora-personal           *ngSwitchCase="'personal'" [data]="data" [context]="ctx"></app-bitacora-personal>
  <app-bitacora-material   *ngSwitchCase="'material'"  [data]="data" [context]="ctx"></app-bitacora-material>
  <app-bitacora-equipos    *ngSwitchCase="'equipos'"   [data]="data" [context]="ctx"></app-bitacora-equipos>
  <app-bitacora-fotos      *ngSwitchCase="'fotos'"     [data]="data" [context]="ctx"></app-bitacora-fotos>
  <app-bitacora-videos     *ngSwitchCase="'videos'"    [data]="data" [context]="ctx"></app-bitacora-videos>
  <app-bitacora-conceptos  *ngSwitchCase="'conceptos'" [data]="data" [context]="ctx"></app-bitacora-conceptos>
  <app-bitacora-notas      *ngSwitchCase="'notas'"     [data]="data" [context]="ctx"></app-bitacora-notas>
  <!-- default -->
  <app-bitacora-personal   *ngSwitchDefault             [data]="data" [context]="ctx"></app-bitacora-personal>
</ng-container>
  `,
})
export class BitacoraWrapperComponent implements ICellRendererAngularComp {
  data: any       = null;
  ctx:  any       = null;
  detailType      = 'personal';

  agInit(params: ICellRendererParams): void {
    this.data       = params.data;
    this.ctx        = params.context;
    this.detailType = params.data?.detailType ?? 'personal';
  }

  refresh(params: ICellRendererParams): boolean {
    this.data       = params.data;
    this.ctx        = params.context;
    this.detailType = params.data?.detailType ?? 'personal';
    return true;
  }
}
