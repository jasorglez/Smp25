import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

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
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './inspeccion.component.html',
  styleUrl: './inspeccion.component.scss'
})
export class InspeccionComponent implements OnInit {

  // Servicios
  private otService = inject(OtService);
  private signalsService = inject(SignalsService);

  // Variables de estado
  public activeTab: string = 'reportes';
  public allReportsData: ReportData[] = [];
  public groupedReportsData: any[] = [];
  public allOtsData: any[] = [];
  private idRoot: number = 0;

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
    paginationPageSize: 20
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
      headerName: '#',
      width: 50,
      cellRenderer: (params: any) => {
        return params.node.rowIndex + 1;
      },
      sortable: false,
      filter: false
    },
    {
      field: 'idOt',
      headerName: 'ID OT',
      width: 80,
      sortable: true,
      filter: true,
      sort: 'desc',
      hide: true
    },
    {
      field: 'otNumber',
      headerName: 'Número OT',
      width: 120,
      sortable: true,
      filter: true
    },
    {
      field: 'cdc',
      headerName: 'CDC',
      width: 100,
      sortable: true,
      filter: true
    },
    {
      field: 'area',
      headerName: 'Área',
      width: 150,
      sortable: true,
      filter: true
    },
    {
      field: 'description',
      headerName: 'Descripción',
      flex: 2,
      minWidth: 200,
      sortable: true,
      filter: true
    },
    {
      field: 'observations',
      headerName: 'Observaciones',
      flex: 1,
      minWidth: 150,
      sortable: true,
      filter: true
    },
    {
      field: 'closed',
      headerName: 'Cerrado Web',
      width: 100,
      cellRenderer: (params) => {
        return params.value ? 
          '<i class="bi bi-check-circle-fill text-success"></i>' : 
          '<i class="bi bi-x-circle-fill text-danger"></i>';
      },
      sortable: true,
      filter: true
    },
    {
      field: 'closedApp',
      headerName: 'Cerrado App',
      width: 120,
      cellRenderer: (params) => {
        return params.value ? 
          '<i class="bi bi-check-circle-fill text-success"></i>' : 
          '<i class="bi bi-x-circle-fill text-danger"></i>';
      },
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
    });
  }

  ngOnInit(): void {
    const rootId = this.signalsService.getRootSelectedBySidebar()();
    if (rootId) {
      this.idRoot = rootId;
      this.loadAllReports();
    }
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
        console.log('Datos cargados:', data.length, 'reportes');
      },
      error: (error) => {
        console.error('Error al cargar reportes:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los reportes', 'error');
      }
    });
  }

  // Procesar datos para ambas pestañas
  processDataForTabs(): void {
    // Para la pestaña de reportes agrupados: usar datos tal como vienen
    this.groupedReportsData = [...this.allReportsData];

    // Para la pestaña de OTs: obtener OTs únicas
    const uniqueOts = new Map();
    this.allReportsData.forEach(report => {
      const otKey = report.otNumber;
      if (!uniqueOts.has(otKey)) {
        uniqueOts.set(otKey, {
          idOt: report.idOt,
          otNumber: report.otNumber,
          cdc: report.cdc,
          area: report.area,
          description: report.description,
          observations: report.observations,
          closed: report.closed,
          closedApp: report.closedApp,
          projectName: report.projectName
        });
      }
    });
    this.allOtsData = Array.from(uniqueOts.values());
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

}