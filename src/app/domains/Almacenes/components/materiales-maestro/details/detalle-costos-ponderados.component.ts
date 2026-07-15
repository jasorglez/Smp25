import { CommonModule } from '@angular/common';
import { inject, Component, ChangeDetectorRef } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { CostosPonderadosService, CostoPonderado } from 'app/services/costos-ponderados.service';

// Nivel 2 (cascada) de la columna "Costos Ponderados" en materiales-maestro.
// Muestra el desglose de compras por proveedor de un material BÁSICO + los 3 KPIs
// (Promedio Ponderado / Máximo / Última Compra) sobre la ventana móvil.
@Component({
  selector: 'app-detalle-costos-ponderados',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column; gap: 10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <strong style="font-size: 13px;">Costos Ponderados — {{ materialName }}</strong>
        <span style="font-size: 11px; color:#558b2f;">
          Ventana: {{ costo?.ventanaMeses || '—' }} meses
          <ng-container *ngIf="periodo"> · {{ periodo }}</ng-container>
          <span *ngIf="costo?.parcial" style="margin-left:6px; background:#fff3e0; color:#e65100; padding:1px 6px; border-radius:8px;">parcial</span>
        </span>
      </div>

      <div *ngIf="loading" style="font-size:12px; color:#777;">Cargando costos…</div>

      <div *ngIf="!loading && sinDatos" style="font-size:12px; color:#777; font-style:italic;">
        No hay compras pagadas en la ventana para este material.
      </div>

      <ng-container *ngIf="!loading && !sinDatos">
        <!-- KPIs -->
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="flex:1 1 140px; background:#fff; border:1px solid #c8e6c9; border-radius:6px; padding:8px 10px;">
            <div style="font-size:10px; color:#888; text-transform:uppercase;">Promedio Ponderado</div>
            <div style="font-size:16px; font-weight:600; color:#2e7d32;">{{ costo?.promedioPonderado | currency:'MXN':'symbol-narrow':'1.2-4' }}</div>
          </div>
          <div style="flex:1 1 140px; background:#fff; border:1px solid #ffe0b2; border-radius:6px; padding:8px 10px;">
            <div style="font-size:10px; color:#888; text-transform:uppercase;">Máximo (peor caso)</div>
            <div style="font-size:16px; font-weight:600; color:#e65100;">{{ costo?.maximo | currency:'MXN':'symbol-narrow':'1.2-4' }}</div>
          </div>
          <div style="flex:1 1 140px; background:#fff; border:1px solid #bbdefb; border-radius:6px; padding:8px 10px;">
            <div style="font-size:10px; color:#888; text-transform:uppercase;">Última Compra</div>
            <div style="font-size:16px; font-weight:600; color:#1565c0;">{{ costo?.ultimaCompra | currency:'MXN':'symbol-narrow':'1.2-4' }}</div>
          </div>
          <div style="flex:1 1 140px; background:#fafafa; border:1px solid #e0e0e0; border-radius:6px; padding:8px 10px;">
            <div style="font-size:10px; color:#888; text-transform:uppercase;">Total comprado (ventana)</div>
            <div style="font-size:13px; font-weight:600; color:#444;">{{ costo?.cantidadTotal | number:'1.0-2' }} u · {{ costo?.costoTotal | currency:'MXN':'symbol-narrow':'1.2-2' }}</div>
          </div>
        </div>

        <!-- Desglose por proveedor -->
        <ag-grid-angular
          style="width: 100%; flex-grow: 1; min-height: 120px;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="columnDefs"
          [rowData]="rowData"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)">
        </ag-grid-angular>
      </ng-container>
    </div>
  `
})
export class DetalleCostosPonderadosComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private costosService = inject(CostosPonderadosService);

  public params!: ICellRendererParams;
  public materialName = '';
  public costo: CostoPonderado | null = null;
  public rowData: any[] = [];
  public loading = true;
  public sinDatos = false;
  public periodo = '';
  private gridApi!: GridApi;

  public gridOptions = {
    headerHeight: 26,
    rowHeight: 24,
    onFirstDataRendered: (p: any) => runAutosizeAllColumns(p.api),
  };

  public columnDefs: ColDef[] = [
    { headerName: 'Proveedor', field: 'proveedor', flex: 2, minWidth: 160 },
    {
      headerName: 'Cantidad', field: 'cantidad', flex: 1, minWidth: 100,
      valueFormatter: (p: any) => (p.value ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })
    },
    {
      headerName: 'Total Pagado', field: 'totalPagado', flex: 1, minWidth: 120,
      valueFormatter: (p: any) => '$' + (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      headerName: '$/unidad', field: 'precioUnitario', flex: 1, minWidth: 100,
      valueFormatter: (p: any) => '$' + (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialName = params.data?.articulo || params.data?.insumo || 'N/A';

    const idCompany = params.context?.idRoot;
    const idMaterial = params.data?.id;
    if (!idCompany || !idMaterial) {
      this.loading = false;
      this.sinDatos = true;
      this.cdr.detectChanges();
      return;
    }

    this.costosService.getByMaterial(idCompany, idMaterial).subscribe({
      next: (c) => {
        this.costo = c;
        this.sinDatos = !c || c.sinDatos;
        this.rowData = c?.desglose || [];
        this.periodo = c ? this.fmtPeriodo(c.periodoInicio, c.periodoFin) : '';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.sinDatos = true;
        this.cdr.detectChanges();
      }
    });
  }

  refresh(): boolean { return false; }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  // yyyy-MM-dd → "Mmm YYYY–Mmm YYYY"
  private fmtPeriodo(ini: string, fin: string): string {
    const f = (s: string) => {
      if (!s) return '';
      const [y, m] = s.split('-');
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${meses[Math.max(0, Math.min(11, +m - 1))]} ${y}`;
    };
    return `${f(ini)}–${f(fin)}`;
  }
}
