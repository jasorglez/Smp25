import { inject, Component, AfterViewInit, ViewChild, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetallesInventarioMoliendaComponent } from './detalles-inventario-molienda.component';
import { DetallesMatprimaFiltradoComponent } from './detalles-matprima-filtrado.component';
import { DetallesBoteFiltradoComponent } from './detalles-bote-filtrado.component';
import { DetallesParametrosFiltradoComponent } from './detalles-parametros-filtrado.component';

@Component({
  selector: 'app-detail-router-filtrado',
  standalone: true,
  imports: [CommonModule, DetallesInventarioMoliendaComponent, DetallesMatprimaFiltradoComponent, DetallesBoteFiltradoComponent, DetallesParametrosFiltradoComponent],
  template: `
    <app-detalles-matprima-filtrado   *ngIf="detailType === 'matprima'"   #matprima></app-detalles-matprima-filtrado>
    <app-detalles-bote-filtrado       *ngIf="detailType === 'bote'"       #bote></app-detalles-bote-filtrado>
    <app-detalles-inventario-molienda *ngIf="detailType === 'inventario'" #inventario></app-detalles-inventario-molienda>
    <app-detalles-parametros-filtrado *ngIf="detailType === 'parametros'" #parametros></app-detalles-parametros-filtrado>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`],
})
export class DetailRouterFiltradoComponent implements AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild('matprima')   matprimaRef?:   DetallesMatprimaFiltradoComponent;
  @ViewChild('bote')       boteRef?:       DetallesBoteFiltradoComponent;
  @ViewChild('inventario') inventarioRef?: DetallesInventarioMoliendaComponent;
  @ViewChild('parametros') parametrosRef?: DetallesParametrosFiltradoComponent;

  detailType: string | null = null;
  private params: any;

  agInit(params: any) {
    this.params     = params;
    this.detailType = params.data?.__detailType ?? 'inventario';
    this.cdr.detectChanges();

    setTimeout(() => {
      const child =
        this.detailType === 'matprima'   ? this.matprimaRef   :
        this.detailType === 'bote'       ? this.boteRef        :
        this.detailType === 'parametros' ? this.parametrosRef  :
        this.inventarioRef;
      child?.agInit(this.params);
    }, 0);
  }

  ngAfterViewInit() {
    // child init handled in agInit via setTimeout after detectChanges updates *ngIf
  }

  refresh(): boolean { return false; }
}
