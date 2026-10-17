import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { OrdenesComponent } from '../ordenes/ordenes.component';
import { firstValueFrom } from 'rxjs';

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
  public activeTab: string = 'reportes';
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
        this.loadOtsForSelectedProject();
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
    this.loadOtsForSelectedProject();
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

  private loadOtsForSelectedProject(): void {
    const request = this.selectedProjectId
      ? this.otService.getOtListByProject(this.selectedProjectId, false)
      : this.otService.getOtList();

    request.subscribe({
      next: (response: any) => {
        const rows = Array.isArray(response) ? response : (response?.data || []);
        this.allOtsData = rows.map((ot: any) => ({
          ...ot,
          idOt: ot.idOt ?? ot.id,
          id: String(ot.id ?? ot.idOt)
        }));
        void this.loadOtContentSummary(this.allOtsData);
        if (this.otsGridApi) this.otsGridApi.setGridOption('rowData', this.allOtsData);
        this.selectedOt = null;
      },
      error: (error) => {
        console.error('Error al cargar órdenes de trabajo:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar las órdenes de trabajo de la cuadrilla seleccionada', 'error');
      }
    });
  }

  private async loadOtContentSummary(orders: any[]): Promise<void> {
    const projectIds = [...new Set(orders.map(ot => Number(ot.idProject)).filter(id => id > 0))];
    if (!projectIds.length) return;

    const responses = await Promise.all(projectIds.map(async idProject => {
      try {
        return await firstValueFrom(this.otService.getProjectOrdersWithContent(idProject, {}));
      } catch (error) {
        console.warn(`No se pudo consultar el contenido de las OTs del proyecto ${idProject}.`, error);
        return [];
      }
    }));
    const summaryById = new Map<string, any>();
    responses.flat().forEach(summary => {
      [summary.id, summary.Id, summary.idOt, summary.IdOt, summary.idOT]
        .filter(value => value !== undefined && value !== null)
        .forEach(value => summaryById.set(String(value), summary));
    });
    this.allOtsData = orders.map(order => {
      const summary = [order.id, order.idOt, order.idOT].map(value => summaryById.get(String(value))).find(Boolean);
      return summary ? {
        ...order,
        photoCount: Number(summary.photoCount ?? summary.photosCount ?? summary.PhotoCount ?? summary.photos ?? summary.fotos) || 0,
        personalCount: Number(summary.personalCount ?? summary.PersonalCount ?? summary.personnelCount ?? summary.crewCount ?? summary.personal) || 0,
        materialCount: Number(summary.materialCount ?? summary.MaterialCount ?? summary.materialsCount ?? summary.materials) || 0,
        equipmentCount: Number(summary.equipmentCount ?? summary.EquipmentCount ?? summary.equipmentsCount ?? summary.equipment) || 0
      } : order;
    });
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
