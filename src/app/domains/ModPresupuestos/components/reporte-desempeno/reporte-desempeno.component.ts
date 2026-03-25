import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GetDataPath } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { IReporteDesempeno } from 'app/interface/ipresupuesto';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'app-reporte-desempeno',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './reporte-desempeno.component.html',
  styleUrl: './reporte-desempeno.component.scss'
})
export class ReporteDesempenoComponent implements OnInit {

  private presupuestoService = inject(PresupuestoService);
  private signalsService = inject(SignalsService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idProject = 0;
  loading = false;

  reporteFlat: any[] = [];   // flat con dataPath para AG Grid Tree Data
  private gridApi!: GridApi;

  // Totales del reporte
  get totalPlaneado(): number { return this.reporteFlat.filter(r => !r.hijos?.length).reduce((s, r) => s + (r.monto_planeado || 0), 0); }
  get totalEjecutado(): number { return this.reporteFlat.filter(r => !r.hijos?.length).reduce((s, r) => s + (r.monto_ejecutado || 0), 0); }
  get totalVariacion(): number { return this.totalPlaneado - this.totalEjecutado; }
  get pctEjecucionGlobal(): number {
    return this.totalPlaneado > 0 ? (this.totalEjecutado / this.totalPlaneado) * 100 : 0;
  }

  public autoGroupColumnDef: ColDef = {
    headerName: 'Cuenta',
    minWidth: 300,
    cellRendererParams: { suppressCount: true }
  };

  public getDataPath: GetDataPath = (data: any) => data._path;

  public columnDefs: ColDef[] = [
    {
      headerName: 'Planeado',
      field: 'monto_planeado',
      width: 160,
      valueFormatter: p => this.formatCurrency(p.value ?? 0),
      cellClass: 'text-end'
    },
    {
      headerName: 'Ejecutado',
      field: 'monto_ejecutado',
      width: 160,
      valueFormatter: p => this.formatCurrency(p.value ?? 0),
      cellClass: 'text-end'
    },
    {
      headerName: 'Preregistrado',
      field: 'monto_preregistrado',
      width: 160,
      valueFormatter: p => this.formatCurrency(p.value ?? 0),
      cellClass: 'text-end'
    },
    {
      headerName: 'Variación',
      field: 'variacion',
      width: 150,
      cellRenderer: (p: ICellRendererParams) => {
        const val = p.value ?? 0;
        const fmt = this.formatCurrency(val);
        const cls = val < 0 ? 'text-danger fw-bold' : val === 0 ? 'text-muted' : 'text-success';
        const icon = val < 0 ? 'bi-arrow-down-circle-fill' : val > 0 ? 'bi-arrow-up-circle-fill' : '';
        return `<span class="${cls}"><i class="bi ${icon} me-1"></i>${fmt}</span>`;
      }
    },
    {
      headerName: '% Ejecución',
      field: 'pct_ejecucion',
      width: 130,
      cellRenderer: (p: ICellRendererParams) => {
        const pct = p.value ?? 0;
        const cls = pct > 100 ? 'danger' : pct > 80 ? 'warning' : pct > 50 ? 'info' : 'success';
        const bar = Math.min(pct, 100);
        return `
          <div style="padding-top:3px">
            <div class="progress" style="height:12px;border-radius:6px">
              <div class="progress-bar bg-${cls}" style="width:${bar}%"></div>
            </div>
            <span class="small">${pct.toFixed(1)}%</span>
          </div>`;
      }
    }
  ];

  public defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  public gridOptions: any = {
    treeData: true,
    groupDefaultExpanded: 1,
    headerHeight: 30,
    rowHeight: 35,
    getRowStyle: (p: any) => {
      if (!p.data) return {};
      const pct = p.data.pct_ejecucion ?? 0;
      if (pct > 100) return { background: '#f8d7da' };
      if (pct > 90)  return { background: '#fff3cd' };
      return {};
    }
  };

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
      if (this.idCompany && this.idProject) {
        this.loadData();
      } else {
        this.reporteFlat = [];
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
    if (this.idCompany && this.idProject) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.presupuestoService.getReporteDesempeno(this.idCompany, this.idProject)
      .pipe(catchError(() => {
        this.loading = false;
        alerts.basicAlert('Error', 'No se pudo cargar el reporte.', 'error');
        return EMPTY;
      }))
      .subscribe(data => {
        this.reporteFlat = this.buildFlatPaths(data);
        this.loading = false;
        setTimeout(() => {
          this.gridApi?.forEachNode(n => { if (n.level === 0) n.setExpanded(true); });
        }, 100);
      });
  }

  buildFlatPaths(items: IReporteDesempeno[], parentPath: string[] = []): any[] {
    const result: any[] = [];
    for (const item of items) {
      const path = [...parentPath, item.cuenta_codigo];
      result.push({ ...item, _path: path });
      if (item.hijos?.length) {
        result.push(...this.buildFlatPaths(item.hijos, path));
      }
    }
    return result;
  }

  onGridReady(p: GridReadyEvent): void { this.gridApi = p.api; }

  exportExcel(): void {
    this.gridApi?.exportDataAsExcel({ fileName: `reporte_presupuesto_${this.idProject}.xlsx` });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }
}
