import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { MedicionesBoteComponent } from './mediciones-bote.component';
import { LibLimpiezaBoteComponent } from './lib-limpieza-bote.component';

@Component({
  selector: 'app-params-detail-renderer',
  standalone: true,
  imports: [CommonModule, MedicionesBoteComponent, LibLimpiezaBoteComponent],
  styles: [':host { display: block; height: 100%; overflow: hidden; }'],
  template: `
    <app-mediciones-bote  *ngIf="mode === 'mediciones'" [agParams]="gridParams"></app-mediciones-bote>
    <app-lib-limpieza-bote *ngIf="mode === 'liberacion'" [agParams]="gridParams"></app-lib-limpieza-bote>
  `,
})
export class ParamsDetailRendererComponent implements ICellRendererAngularComp {
  mode: 'mediciones' | 'liberacion' = 'mediciones';
  gridParams: any = null;

  agInit(params: any): void {
    this.gridParams = params;
    this.mode = params.data?.__detailMode ?? 'mediciones';
  }

  refresh(): boolean { return false; }
}
