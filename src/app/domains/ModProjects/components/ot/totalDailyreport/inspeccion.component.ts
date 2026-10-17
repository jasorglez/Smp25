import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { OrdenesComponent } from '../ordenes/ordenes.component';

interface ReportData {
  id: number;
  idOt: number;
  nameSmall: string;
  otNumber: string;
  cdc: string;
  area: string;
  description: string;
  projectName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPay: number;
  companyId: number;
  observations: string;
  closed: boolean;
  closedApp: boolean;
}

@Component({
  selector: 'app-inspeccion',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule, OrdenesComponent],
  templateUrl: './inspeccion.component.html',
  styleUrl: './inspeccion.component.scss'
})
export class InspeccionComponent implements OnInit {

  // Servicios
  private otService = inject(OtService);
  private signalsService = inject(SignalsService);

  // Variables de estado
  public activeTab: string = 'ots';
  public allReportsData: ReportData[] = [];
  public groupedReportsData: any[] = [];
  public allOtsData: any[] = [];
  public selectedOt: any = null;
  private idRoot: number = 0;
  private selectedProjectId: number = 0;

  // APIs del grid
  public reportesGridApi!: GridApi;
  public otsGridApi!: GridApi;

  // Configuración del grid
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 20,
    tooltipShowDelay: 350,
    tooltipHideDelay: 10000,
    defaultColDef: {
      tooltipValueGetter: (params: any) => this.getOtContentTooltip(params.data)
    },
    rowClassRules: {
      'ot-has-content': (params: any) => this.hasOtContent(params.data)
    }
  };

  // Configuración del grid con agrupación
  public groupedGridOptions: any = {
    ...this.gridOptions,
    groupDefaultExpanded: 1,
    groupSelectsChildren: false,
    suppressRowClickSelection: true,
    groupRowRendererParams: {
      suppressCount: false,
      innerRenderer: 'agGroupCellRenderer'
    }
  };

  // Columnas para reportes diarios agrupados
  public reportesColumnDefs: ColDef[] = [
    {
      field: 'date',
      headerName: 'Fecha',
      width: 120,
      rowGroup: true,
      hide: true,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleDateString('es-ES');
      }
    },
    {
      field: 'projectName',
      headerName: 'Cuadrillas',
      width: 120      
    },
    {
      field: 'startTime',
      headerName: 'Inicio',
      width: 100,
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    {
      field: 'endTime',
      headerName: 'Término',
      width: 100,
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    {
      field: 'totalPay',
      headerName: 'Total $',
      hide: !this.signalsService.getrootChoose(), // ← Esto oculta toda la columna
      width: 120,
      aggFunc: 'sum',
      cellRenderer: (params) => {
        const value = params.value || 0;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2
        }).format(value);
      }
    },
    {
      field: 'otNumber',
      headerName: 'OT',
      width: 120
    },
    {
      field: 'cdc',
      headerName: 'CDC',
      width: 100
    },
    {
      field: 'area',
      headerName: 'Área',
      width: 150
    },
    {
      field: 'description',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 200
    }
  ];

  // Columnas para todas las OTs
  public otsColumnDefs: ColDef[] = [
    {
      colId: 'otRowNumber',
      headerName: '#',
      width: 52,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      valueGetter: (params: any) => params.node?.rowIndex == null ? '' : params.node.rowIndex + 1
    },
    {
      field: 'otNumber',
      headerName: 'OT',
      width: 110,
      sortable: true,
      filter: true,
      sort: 'desc'
    },
    {
      field: 'cdc',
      headerName: 'CDC',
      width: 100,
      sortable: true,
      filter: true
    },
    {
      field: 'results',
      headerName: 'Respuesta',
      flex: 1,
      minWidth: 140,
      sortable: true,
      filter: true
    }
  ];

  constructor() {
    // Escuchar cambios en la empresa seleccionada
    effect(() => {
      const rootId = this.signalsService.getRootSelectedBySidebar()();
      if (rootId && rootId !== this.idRoot) {
        this.idRoot = rootId;
        this.loadAllReports();
      }
      const projectId = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
      if (projectId !== this.selectedProjectId) {
        this.selectedProjectId = projectId;
        this.selectedOt = null;
        this.allOtsData = [];
        if (this.otsGridApi) this.otsGridApi.setGridOption('rowData', []);
      }
    });
  }

  ngOnInit(): void {
    const rootId = this.signalsService.getRootSelectedBySidebar()();
    if (rootId) {
      this.idRoot = rootId;
      this.loadAllReports();
    }
    this.selectedProjectId = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
  }

  // Cargar todos los reportes de la empresa
  loadAllReports(): void {
    if (!this.idRoot) {
      console.log('No hay empresa seleccionada');
      return;
    }

    this.otService.getOtAllt(this.idRoot).subscribe({
      next: (data: ReportData[]) => {
        this.allReportsData = data;
        this.processDataForTabs();
        //console.log('Datos cargados:', data.length, 'reportes');
      },
      error: (error) => {
        console.error('Error al cargar reportes:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los reportes', 'error');
      }
    });
  }

  onCaptureOtsChanged(orders: any[]): void {
    this.allOtsData = Array.isArray(orders) ? orders : [];
    if (this.otsGridApi) this.otsGridApi.setGridOption('rowData', this.allOtsData);
  }

  private hasOtContent(row: any): boolean {
    return !!row && [row.photoCount, row.personalCount, row.materialCount, row.equipmentCount]
      .some(count => Number(count) > 0);
  }

  private getOtContentTooltip(row: any): string | undefined {
    if (!this.hasOtContent(row)) return undefined;
    return [
      Number(row.personalCount) > 0 ? `Personal: ${row.personalCount}` : '',
      Number(row.photoCount) > 0 ? `Fotos: ${row.photoCount}` : '',
      Number(row.materialCount) > 0 ? `Materiales: ${row.materialCount}` : '',
      Number(row.equipmentCount) > 0 ? `Equipos: ${row.equipmentCount}` : ''
    ].filter(Boolean).join(' · ');
  }

  // Procesar datos para ambas pestañas
  processDataForTabs(): void {
    // Para la pestaña de reportes agrupados: usar datos tal como vienen
    this.groupedReportsData = [...this.allReportsData];

  }

  // Cambiar pestaña activa
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Grid ready events
  onReportesGridReady(params: GridReadyEvent): void {
    this.reportesGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onOtsGridReady(params: GridReadyEvent): void {
    this.otsGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onOtSelected(event: any): void {
    this.selectedOt = event?.data || null;
  }

}
