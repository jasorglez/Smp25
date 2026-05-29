import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetallesInventarioMoliendaComponent } from './detalles-inventario-molienda.component';
import { DetallesMatprimaFiltradoComponent } from './detalles-matprima-filtrado.component';

@Component({
  selector: 'app-detail-router-filtrado',
  standalone: true,
  imports: [CommonModule, DetallesInventarioMoliendaComponent, DetallesMatprimaFiltradoComponent],
  template: `
    <app-detalles-matprima-filtrado *ngIf="detailType === 'matprima'" #matprima></app-detalles-matprima-filtrado>
    <app-detalles-inventario-molienda *ngIf="detailType !== 'matprima'" #inventario></app-detalles-inventario-molienda>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`],
})
export class DetailRouterFiltradoComponent implements AfterViewInit {
  @ViewChild('matprima') matprimaRef?: DetallesMatprimaFiltradoComponent;
  @ViewChild('inventario') inventarioRef?: DetallesInventarioMoliendaComponent;

  detailType = 'inventario';
  private params: any;

  agInit(params: any) {
    this.params = params;
    this.detailType = params.data?.__detailType ?? 'inventario';
  }

  ngAfterViewInit() {
    const child = this.detailType === 'matprima' ? this.matprimaRef : this.inventarioRef;
    child?.agInit(this.params);
  }

  refresh(): boolean { return false; }
}
