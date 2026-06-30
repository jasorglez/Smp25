import { Component, OnInit, OnDestroy, inject, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DailyReportService } from 'app/services/daily-report.service';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { LogbookService } from 'app/services/logbook.service';
import { SignalsService } from 'app/services/signals.service';
import { SignalrService } from 'app/services/signalr.service';
import { ConventionsService } from 'app/services/conventions.service';
import { alerts } from 'app/helpers/alerts';
import { Subscription } from 'rxjs';
import { IDailyReport } from 'app/interface/idaily-report';
import { ButtonCellRendererExpenditureComponent } from '../../../ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';
import { PdfButtonCellRendererComponent }  from './pdf-button-cell-renderer.component';
import { PdfDetailComponent }              from './pdf-detail.component';
import { BitacoraPersonalComponent }  from './bitacora-personal.component';
import { BitacoraMaterialComponent }  from './bitacora-material.component';
import { BitacoraEquiposComponent }   from './bitacora-equipos.component';
import { BitacoraFotosComponent }     from './bitacora-fotos.component';
import { BitacoraVideosComponent }    from './bitacora-videos.component';
import { BitacoraConceptosComponent } from './bitacora-conceptos.component';
import { BitacoraNotasComponent }     from './bitacora-notas.component';
import { BitacoraWrapperComponent }   from './bitacora-wrapper.component';
import { BitacoraAvanceComponent }    from './bitacora-avance.component';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-sistema',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AgGridModule,
    ButtonCellRendererExpenditureComponent,
    PdfButtonCellRendererComponent, PdfDetailComponent,
    BitacoraPersonalComponent, BitacoraMaterialComponent, BitacoraEquiposComponent,
    BitacoraWrapperComponent, BitacoraAvanceComponent,
  ],
  templateUrl: './sistema.component.html',
  styleUrl: './sistema.component.scss'
})
export class SistemaComponent implements OnInit, OnDestroy {
  private trackingService = inject(TrackingService);

  private dailyReportService = inject(DailyReportService);
  private logbookService     = inject(LogbookService);
  private signalsService     = inject(SignalsService);
  private signalRService     = inject(SignalrService);
  private conventionsService = inject(ConventionsService);
  private projectsService    = inject(ProjectsService);
  private oilfieldService    = inject(OilfieldService);

  private signalRSub!: Subscription;
  private reloadTimeout: any = null;

  public rowData: IDailyReport[]       = [];
  public conventionsList: any[] = [];
  private originalRowData: IDailyReport[] = [];
  public gridApi!: GridApi;
  public hasUnsavedChanges   = false;
  public selectedRow: any    = null;
  private idProject: number  = 0;
  private idContract: number = 0;
  private idRoot: number    = 0;
  private oilfields: any[]  = [];
  private projectOilfieldName: string = '';
  
  externalFilterActive: boolean = false;
  
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    animateRows: true,
    pagination: true,
    paginationPageSize: 25,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 600,
    detailCellRenderer: BitacoraWrapperComponent,
    suppressMenuHide: false,
    context: {
      componentParent: null
    },
    getContextMenuItems: (params: any) => {
      if (!params.node?.data) return ['copy'];
      const row = params.node.data;
      return [
        {
          name: '<b>Traer Personal</b>',
          icon: '<i class="bi bi-people-fill" style="color:#1976d2"></i>',
          action: () => this.copyFromPreviousDay(row, ['PERSONAL']),
        },
        {
          name: '<b>Traer Material</b>',
          icon: '<i class="bi bi-box-fill" style="color:#e91e63"></i>',
          action: () => this.copyFromPreviousDay(row, ['MATERIAL']),
        },
        {
          name: '<b>Traer Equipo</b>',
          icon: '<i class="bi bi-truck" style="color:#9c27b0"></i>',
          action: () => this.copyFromPreviousDay(row, ['EQUIPMENT']),
        },
        'separator',
        {
          name: '<b>Traer Personal, Material y Equipo</b>',
          icon: '<i class="bi bi-clipboard-check-fill" style="color:#2e7d32"></i>',
          action: () => this.copyFromPreviousDay(row, ['PERSONAL', 'MATERIAL', 'EQUIPMENT']),
        },
        {
          name: '<b>Traer todo del día anterior</b>',
          icon: '<i class="bi bi-calendar-check-fill" style="color:#f57c00"></i>',
          action: () => this.copyFromPreviousDay(row, ['PERSONAL', 'MATERIAL', 'EQUIPMENT', 'CONCEPTO', 'NOTE']),
        },
        'separator',
        'copy',
      ];
    },
    isExternalFilterPresent: () => {
      return this.externalFilterActive;
    },
    doesExternalFilterPass: (node: any) => {
      return node.data.visible !== false;
    },
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  };

  public colDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, editable: false, hide: true },
    {
      field: 'date', headerName: 'Fecha', width: 110, editable: true, pinned: 'left',
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.date ? String(p.data.date).substring(0, 10) : '',
      valueSetter: (p) => { p.data.date = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    { field: 'startTime', headerName: 'Inicio', width: 110, editable: true },
    { field: 'endTime', headerName: 'Término', width: 110, editable: true },
 /* { field: 'type', headerName: 'Tipo', width: 100, editable: true },
  { field: 'description',      headerName: 'Descripción',       width: 200, editable: true },
    {
      field: 'totalPay', headerName: 'Total $', width: 120, editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p) => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00',
    },
*/    
    {
      field: 'idConvention',
      headerName: 'Convenio',
      width: 180,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => ({
        values: this.conventionsList.map((c: any) => c.description)
      }),
      valueGetter: (params: any) => {
        if (!params.data?.idConvention) return '';
        const conv = this.conventionsList.find((c: any) => c.id === params.data.idConvention);
        return conv ? conv.description : '';
      },
      valueSetter: (params: any) => {
        if (!params.newValue) { params.data.idConvention = 0; return true; }
        const conv = this.conventionsList.find((c: any) => c.description === params.newValue);
        params.data.idConvention = conv ? conv.id : 0;
        return true;
      },
    },
    { field: 'numReporte',       headerName: 'No. Reporte',       width: 200, editable: true },
    { field: 'ubication',        headerName: 'Ubicación',         width: 130, editable: true },
    { field: 'condition',        headerName: 'Cond. Meteorológ.', width: 180, editable: true },
    { field: 'platicasSeguridad',headerName: 'Plática Seguridad', width: 180, editable: true },
 
    {
      headerName: 'PDF',
      width: 100,
      cellRenderer: PdfButtonCellRendererComponent,
      cellRendererParams: {
        onClick: (node: any) => this.togglePdfDetail(node),
      },
      editable: false,
      cellStyle: { textAlign: 'center' }
    },

    // Columnas de Bitácoras como botones
    {
      field: 'tiempos',
      headerName: 'T.Inactivos',
      width: 130,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'tiempos'),
      },
      valueGetter: params => params.data.tiempos || 0,
      editable: false,
      cellStyle: { backgroundColor: '#fbe9e7', cursor: 'pointer', textDecoration: 'underline' }
    },

   {
      field: 'conceptos',
      headerName: 'Conceptos',
      width: 130,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'conceptos'),
      },
      valueGetter: params => params.data.conceptos || 0,
      editable: false,
      cellStyle: { backgroundColor: '#e0f2f1', cursor: 'pointer', textDecoration: 'underline' }
   },

   // ── Punto 6 — Avance diario por tarea ──────────────────────────────────
   {
      headerName: 'Avance',
      width: 100,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'avance'),
        label: '📊 Avance',
      },
      valueGetter: () => '📊',
      editable: false,
      cellStyle: { backgroundColor: '#fff3cd', cursor: 'pointer', textDecoration: 'underline',
                   fontWeight: '600', color: '#856404' }
   },

    {
      field: 'personal',
      headerName: 'Personal',
      width: 130,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'personal'),
      },
      valueGetter: params => params.data.personal || 0,
      editable: false,
      cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' }
    },
   
        {
      field: 'material',
      headerName: 'Materiales',
      width: 130,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'material'),
      },
      valueGetter: params => params.data.material || 0,
      editable: false,
      cellStyle: { backgroundColor: '#fce4ec', cursor: 'pointer', textDecoration: 'underline' }
    },
    {
      field: 'equipos',
      headerName: 'Equipos',
      width: 120,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'equipos'),
      },
      valueGetter: params => params.data.equipos || 0,
      editable: false,
      cellStyle: { backgroundColor: '#f3e5f5', cursor: 'pointer', textDecoration: 'underline' }
    },

    {
      field: 'fotos',
      headerName: 'Fotos',
      width: 120,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'fotos'),
      },
      valueGetter: params => params.data.fotos || 0,
      editable: false,
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
    },
    {
      field: 'videos',
      headerName: 'Videos',
      width: 120,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'videos'),
      },
      valueGetter: params => params.data.videos || 0,
      editable: false,
      cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
    },


    {
      field: 'notas',
      headerName: 'Notas',
      width: 120,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleBitacoraDetail(node, 'notas'),
      },
      valueGetter: params => params.data.notas || 0,
      editable: false,
      cellStyle: { backgroundColor: '#efebe9', cursor: 'pointer', textDecoration: 'underline' }
    },

    {
      field: 'close', headerName: 'Cerrado', width: 90, editable: true,
      cellEditor: 'agCheckboxCellEditor',
      cellRenderer: (p: any) => p.value
        ? '<i class="bi bi-check-circle-fill text-success"></i>'
        : '<i class="bi bi-x-circle-fill text-danger"></i>',
    },
    {
      field: 'paid', headerName: 'Pagado', width: 90, editable: true,
      cellEditor: 'agCheckboxCellEditor',
      cellRenderer: (p: any) => p.value
        ? '<i class="bi bi-check-circle-fill text-success"></i>'
        : '<i class="bi bi-x-circle-fill text-danger"></i>',
    },
  ];

  constructor() {
    // Carga convenios cada vez que cambia el contrato seleccionado en sidebar
    effect(() => {
      const contractId = this.signalsService.getContractSelectedBySidebar()();
      if (contractId) {
        this.idContract = contractId;
        this.loadConventions(contractId);
      }
    });

    // Usa getSidebarProjectId (nunca modificada por ordenes) para evitar
    // que la selección de una OT de otra empresa contamine esta vista.
    effect(() => {
      const projectId = this.signalsService.getSidebarProjectId()();
      if (projectId && projectId !== this.idProject) {
        this.idProject = projectId;
        this.rowData = [];
        this.originalRowData = [];
        this.hasUnsavedChanges = false;
        this.selectedRow = null;
        this.loadReports();
        this.resolveProjectData(projectId);
      } else if (!projectId) {
        this.signalsService.setProjectNumberBySidebar('');
        this.projectOilfieldName = '';
      }
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    });

    // Tiempo real: recargar cuando el bot guarda nota, foto o crea reporte nuevo
    const handler = (data: any) => {
      const projectId = data?.IdProject ?? data?.idProject;
      if (projectId && +projectId === this.idProject) {
        this.scheduleReload();
      }
    };

    this.signalRSub = new Subscription();
    this.signalRSub.add(this.signalRService.textUpdate$.subscribe(handler));
    this.signalRSub.add(this.signalRService.photoUpdate$.subscribe(handler));
    this.signalRSub.add(this.signalRService.newDailyReport$.subscribe(handler));
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
    if (this.reloadTimeout) clearTimeout(this.reloadTimeout);
  }

  // Debounce para evitar múltiples recargas seguidas
  private scheduleReload(): void {
    if (this.reloadTimeout) clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(() => this.loadReports(), 800);
  }

  ngOnInit(): void {
    // Conectar al hub del bot Telegram para recibir eventos en tiempo real
    if (!this.signalRService.isTelegramConnected()) {
      this.signalRService.startTelegramConnection();
    }

    const projectId  = this.signalsService.getSidebarProjectId()();
    const contractId = this.signalsService.getContractSelectedBySidebar()();
    if (contractId) this.idContract = contractId;

    this.oilfieldService.getOilfields().subscribe({
      next: (data: any) => {
        this.oilfields = data || [];
        if (projectId) this.resolveProjectData(projectId);
      },
      error: () => { this.oilfields = []; }
    });

    if (projectId) {
      this.idProject = projectId;
      this.loadReports();
    }
  }

  private resolveProjectData(projectId: number): void {
    this.projectsService.getProjectsById(projectId).subscribe({
      next: (proj: any) => {
        const num = Array.isArray(proj) ? proj[0]?.number : proj?.number;
        const idOil = Array.isArray(proj) ? proj[0]?.idOilfield : proj?.idOilfield;
        this.signalsService.setProjectNumberBySidebar(num ?? '');
        const oil = this.oilfields.find((o: any) => o.id === idOil);
        this.projectOilfieldName = oil ? oil.name : '';
      },
      error: () => {
        this.signalsService.setProjectNumberBySidebar('');
        this.projectOilfieldName = '';
      }
    });
  }

  loadConventions(idContract: number): void {
    this.conventionsService.getConvention2fields(idContract).subscribe({
      next: (resp: any) => {
        this.conventionsList = resp.data || resp || [];
        if (this.gridApi) {
          this.gridApi.refreshCells({ columns: ['idConvention'], force: true });
        }
      },
      error: (err) => {
        console.error('Error cargando convenios:', err);
        this.conventionsList = [];
      }
    });
  }

  private readonly COL_STATE_KEY = 'sistema-col-state';

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridOptions.context.componentParent = this;
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData || []);
      },
      context: this.gridOptions.context
    });

    this.restoreColState();

    if (this.idContract) {
      this.loadConventions(this.idContract);
    }
  }

  saveColState(): void {
    if (!this.gridApi) return;
    const state = this.gridApi.getColumnState();
    localStorage.setItem(this.COL_STATE_KEY, JSON.stringify(state));
  }

  private restoreColState(): void {
    const raw = localStorage.getItem(this.COL_STATE_KEY);
    if (!raw) return;
    try {
      const state = JSON.parse(raw);
      this.gridApi.applyColumnState({ state, applyOrder: true });
    } catch { /* si está corrupto lo ignoramos */ }
  }

  loadReports(): void {
    if (!this.idProject) return;
    this.dailyReportService.getDailyReportsByProject(this.idProject).subscribe({
      next: (resp: any) => {
        // Agregar propiedades para master-detail
        this.rowData = (resp.data || []).map((report: any) => ({
          ...report,
          detailType: null,
          detailData: [],
          visible: true
        }));
        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        this.selectedRow = null;
      },
      error: () => alerts.basicAlert('Error', 'No se pudieron cargar los reportes diarios', 'error'),
    });
  }

  add(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo sistema', 'Proyectos', this.trackingService.getEmail());
    if (!this.idProject) {
      alerts.basicAlert('Aviso', 'Selecciona un Proyecto antes de agregar un reporte', 'warning');
      return;
    }
    const projectNumber = this.signalsService.getProjectNumberBySidebar()();
    const consecutive   = (this.rowData.length + 1).toString().padStart(3, '0');
    const numReporte    = projectNumber ? `${projectNumber}-${consecutive}` : consecutive;

    const newRow = {
      idOt: null,
      idProject: this.idProject,
      date: new Date().toISOString().substring(0, 10),
      startTime: '07:52:00',
      endTime: '17:02:00',
      type: 'CORTE',
      description: '',
      idConvention: this.signalsService.getConventionVigente()()?.id ?? null,
      numReporte,
      condition: 'Dia Soleado',
      ubication: this.projectOilfieldName,
      platicasSeguridad: 'Sin Platicas',
      totalPay: 0,
      close: false,
      paid: true,
      tiempos: 0,
      personal: 0,
      fotos: 0,
      videos: 0,
      material: 0,
      equipos: 0,
      conceptos: 0,
      notas: 0,
      active: true,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'numReporte' });
    }, 50);
  }

  async saveChanges(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en sistema', 'Proyectos', this.trackingService.getEmail());
    const newItems      = this.rowData.filter(r => r.__isNew);
    const modifiedItems = this.rowData.filter(r => r.__modified && !r.__isNew);
    
    if (!newItems.length && !modifiedItems.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    try {
      for (const item of newItems) {
        await new Promise((resolve, reject) => {
          this.dailyReportService.addDailyReport(this.cleanForServer(item))
            .subscribe({ 
              next: resolve, 
              error: (err) => {
                console.error('❌ Error al agregar:', err);
                let msg = 'Error desconocido';
                if (err.error) {
                  if (typeof err.error === 'string') {
                    msg = err.error;
                  } else if (err.error.errors) {
                    const errors = Object.entries(err.error.errors);
                    msg = errors.map(([field, value]: [string, any]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | ');
                  } else if (err.error.message) {
                    msg = err.error.message;
                  }
                } else if (err.message) {
                  msg = err.message;
                }
                reject(new Error(`Error al agregar reporte del ${item.date}: ${msg}`));
              } 
            });
        });
      }
      for (const item of modifiedItems) {
        await new Promise((resolve, reject) => {
          this.dailyReportService.updateDailyReport(item.id, this.cleanForServer(item))
            .subscribe({ 
              next: resolve, 
              error: (err) => {
                console.error('❌ Error al actualizar:', err);
                let msg = 'Error desconocido';
                if (err.error) {
                  if (typeof err.error === 'string') {
                    msg = err.error;
                  } else if (err.error.errors) {
                    const errors = Object.entries(err.error.errors);
                    msg = errors.map(([field, value]: [string, any]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | ');
                  } else if (err.error.message) {
                    msg = err.error.message;
                  }
                } else if (err.message) {
                  msg = err.message;
                }
                reject(new Error(`Error al actualizar reporte ID ${item.id}: ${msg}`));
              } 
            });
        });
      }
      alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
      this.loadReports();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      alerts.basicAlert('Error', error?.message || 'Error al guardar los cambios', 'error');
    }
  }

  revertChanges(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en sistema', 'Proyectos', this.trackingService.getEmail());
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  async delete(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó sistema', 'Proyectos', this.trackingService.getEmail());
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      this.selectedRow = null;
      return;
    }
    const result = await alerts.confirmAlert(
      '¿Eliminar reporte?', 'Esta acción no se puede deshacer', 'warning', 'Eliminar'
    );
    if (!result.isConfirmed) return;
    this.dailyReportService.deleteDailyReport(this.selectedRow.id).subscribe({
      next: () => { alerts.basicAlert('Eliminado', 'Reporte eliminado', 'success'); this.loadReports(); },
      error: () => alerts.basicAlert('Error', 'No se pudo eliminar el reporte', 'error'),
    });
  }

  onRowSelected(event: any): void {
    if (event.node?.isSelected()) {
      this.selectedRow = event.data;
    }
  }

  onCellValueChanged(event: any): void {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasUnsavedChanges = true;
  }

  private cleanForServer(item: any): any {
    const { __isNew, __modified, detailType, detailData, visible, ...data } = item;
    return data;
  }

  // ==================== MÉTODOS PARA CASCADAS DE BITÁCORAS ====================

  toggleBitacoraDetail(node: any, bitacoraType: string) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === bitacoraType;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
      return;
    }

    // Expandir con la bitácora seleccionada, ocultar las demás filas
    this.externalFilterActive = true;
    api.forEachNode((n: any) => {
      n.data.visible = n.id === node.id ? true : false;
    });
    api.onFilterChanged();

    // Si la fila está expandida con otro tipo de detalle, cerrarla
    if (node.expanded && node.data.detailType !== bitacoraType) {
      node.setExpanded(false);
    }

    // Cambiar el tipo de detalle
    node.data.detailType = bitacoraType;

    // Expandir
    setTimeout(() => {
      node.setExpanded(true);
    }, 0);
  }

  collapseBitacoraDetail(reportId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === reportId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      // Mostrar todas las filas
      this.externalFilterActive = false;
      this.gridApi.forEachNode((node) => {
        if (node.data) node.data.visible = true;
      });
      this.gridApi.onFilterChanged();
    }
  }

  updateBitacoraCount(reportId: number, bitacoraType: string, count: number) {
    if (!this.gridApi) return;

    this.gridApi.forEachNode((node) => {
      if (node.data?.id === reportId) {
        node.data[bitacoraType] = count;
        this.gridApi.refreshCells({
          rowNodes: [node],
          columns: [bitacoraType],
          force: true
        });
      }
    });
  }

  togglePdfDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'pdf';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
      return;
    }

    this.externalFilterActive = true;
    api.forEachNode((n: any) => {
      n.data.visible = n.id === node.id ? true : false;
    });
    api.onFilterChanged();

    if (node.expanded && node.data.detailType !== 'pdf') {
      node.setExpanded(false);
    }

    node.data.detailType = 'pdf';

    setTimeout(() => {
      node.setExpanded(true);
    }, 0);
  }

  collapsePdfDetail(reportId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === reportId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      this.externalFilterActive = false;
      this.gridApi.forEachNode((node) => {
        if (node.data) node.data.visible = true;
      });
      this.gridApi.onFilterChanged();
    }
  }

  // ==================== COPIAR DEL DÍA ANTERIOR ====================

  async copyFromPreviousDay(row: any, types: string[]): Promise<void> {
    if (!row.id) {
      alerts.basicAlert('Aviso', 'Guarda el reporte primero antes de copiar datos del día anterior', 'warning');
      return;
    }

    // Buscar el reporte más reciente con fecha anterior a la del row seleccionado
    const currentDate = new Date(String(row.date).substring(0, 10) + 'T00:00:00');
    const prevReport = this.rowData
      .filter(r => r.id && r.id !== row.id && new Date(String(r.date).substring(0, 10) + 'T00:00:00') < currentDate)
      .sort((a, b) => new Date(String(b.date).substring(0, 10)).getTime() - new Date(String(a.date).substring(0, 10)).getTime())[0];

    if (!prevReport) {
      alerts.basicAlert('Sin reporte previo', 'No se encontró ningún reporte anterior a este día', 'warning');
      return;
    }

    const typeLabels = types.map(t => this.typeLabel(t)).join(', ');
    const result = await alerts.confirmAlert(
      'Copiar del día anterior',
      `Se copiará ${typeLabels} del ${this.fmtDateMx(prevReport.date)} al ${this.fmtDateMx(row.date)}.\n\nLos registros existentes no se eliminarán.`,
      'question',
      'Copiar'
    );
    if (!result.isConfirmed) return;

    let totalCopied = 0;
    const destDate = String(row.date).substring(0, 10);

    try {
      for (const typeNote of types) {
        const resp: any = await new Promise((res, rej) =>
          this.logbookService.getInfoByReporte(prevReport.id, typeNote).subscribe({ next: res, error: rej }));

        if (!resp?.success || !resp?.data?.length) continue;

        // Filtrar filas vacías según el tipo
        const allItems: any[] = resp.data;
        const items = allItems.filter(item => {
          if (typeNote === 'PERSONAL')  return !!(item.position?.trim());
          if (typeNote === 'MATERIAL')  return !!(item.description?.trim());
          if (typeNote === 'EQUIPMENT') return !!(item.description?.trim());
          return true;
        });

        const shouldMergeByType = this.shouldMergeOnCopy(typeNote);
        const itemsToCopy = shouldMergeByType
          ? this.mergeSourceItemsByType(items, typeNote)
          : items;

        const destinationItemsMap = new Map<string, any>();
        if (shouldMergeByType) {
          const destinationResp: any = await new Promise((res, rej) =>
            this.logbookService.getInfoByReporte(row.id, typeNote).subscribe({ next: res, error: rej }));
          if (destinationResp?.success && destinationResp?.data?.length) {
            for (const existingItem of destinationResp.data) {
              const key = this.buildCopyKey(existingItem, typeNote);
              if (key && !destinationItemsMap.has(key)) {
                destinationItemsMap.set(key, existingItem);
              }
            }
          }
        }

        for (let i = 0; i < itemsToCopy.length; i++) {
          const item = itemsToCopy[i];

          if (shouldMergeByType) {
            const key = this.buildCopyKey(item, typeNote);
            const existingItem = key ? destinationItemsMap.get(key) : null;
            if (existingItem?.id) {
              const payloadUpdate = {
                idReporte:   row.id,
                idProject:   row.idProject ?? null,
                idPadre:     0,
                typeNote,
                date:        destDate,
                orden:       existingItem.orden ?? i + 1,
                quantity:    this.toQuantityNumber(existingItem.quantity) + this.toQuantityNumber(item.quantity),
                description: existingItem.description ?? item.description ?? null,
                supervisor:  item.supervisor ?? existingItem.supervisor ?? null,
                position:    item.position ?? existingItem.position ?? null,
                idResource:  existingItem.idResource ?? item.idResource ?? null,
                imageUrl:    item.imageUrl ?? existingItem.imageUrl ?? null,
                active:      1,
              };
              await new Promise((res, rej) =>
                this.logbookService.updateDataForOt(existingItem.id, payloadUpdate).subscribe({ next: res, error: rej }));
              existingItem.quantity = payloadUpdate.quantity;
              totalCopied++;
              continue;
            }
          }

          const payload = {
            idReporte:   row.id,
            idProject:   row.idProject ?? null,
            idPadre:     0,
            typeNote,
            date:        destDate,
            orden:       i + 1,
            quantity:    item.quantity    ?? null,
            description: item.description ?? null,
            supervisor:  item.supervisor  ?? null,
            position:    item.position    ?? null,
            idResource:  item.idResource  ?? null,
            imageUrl:    item.imageUrl    ?? null,
            active:      1,
          };
          const addResp: any = await new Promise((res, rej) =>
            this.logbookService.addDataForOt(payload).subscribe({ next: res, error: rej }));

          if (shouldMergeByType) {
            const key = this.buildCopyKey(item, typeNote);
            if (key) {
              destinationItemsMap.set(key, {
                ...payload,
                id: addResp?.id ?? null,
              });
            }
          }

          totalCopied++;
        }
      }

      alerts.basicAlert('Éxito', `Se copiaron ${totalCopied} registro(s) del día anterior`, 'success');

      // Actualizar contadores en el grid maestro
      for (const typeNote of types) {
        const field = this.typeToField(typeNote);
        if (!field) continue;
        const resp: any = await new Promise((res, rej) =>
          this.logbookService.getInfoByReporte(row.id, typeNote).subscribe({ next: res, error: rej }));
        if (resp?.success) {
          const count = resp.data?.length ?? 0;
          this.updateBitacoraCount(row.id, field, count);
          this.dailyReportService.updateBitacoraCount(row.id, typeNote, count).subscribe();
        }
      }
    } catch (e: any) {
      console.error('Error al copiar del día anterior:', e);
      alerts.basicAlert('Error', e?.message || 'No se pudo copiar del día anterior', 'error');
    }
  }

  private typeLabel(typeNote: string): string {
    const labels: Record<string, string> = {
      'PERSONAL':  'Personal',
      'MATERIAL':  'Material',
      'EQUIPMENT': 'Equipos',
      'CONCEPT':   'Conceptos',
      'CONCEPTO':  'Conceptos',
      'NOTE':      'Notas',
      'Photo':     'Fotos',
      'Video':     'Videos',
    };
    return labels[typeNote] ?? typeNote;
  }

  private typeToField(typeNote: string): string | null {
    const map: Record<string, string> = {
      'PERSONAL':      'personal',
      'MATERIAL':      'material',
      'EQUIPMENT':     'equipos',
      'CONCEPT':       'conceptos',
      'CONCEPTO':      'conceptos',
      'NOTE':          'notas',
      'Photo':         'fotos',
      'Video':         'videos',
      'TIME_INACTIVE': 'tiempos',
    };
    return map[typeNote] ?? null;
  }

  private fmtDateMx(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = String(dateStr).substring(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : dateStr;
  }

  private shouldMergeOnCopy(typeNote: string): boolean {
    return typeNote === 'MATERIAL' || typeNote === 'PERSONAL' || typeNote === 'EQUIPMENT';
  }

  private buildCopyKey(item: any, typeNote: string): string {
    if (typeNote === 'PERSONAL') {
      const position = String(item?.position ?? '').trim().toLowerCase();
      if (position) return `position:${position}`;
    }

    const idResource = item?.idResource;
    if (idResource !== null && idResource !== undefined && String(idResource).trim() !== '') {
      return `id:${idResource}`;
    }

    const description = String(item?.description ?? '').trim().toLowerCase();
    return description ? `desc:${description}` : '';
  }

  private toQuantityNumber(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private mergeSourceItemsByType(items: any[], typeNote: string): any[] {
    const grouped = new Map<string, any>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = this.buildCopyKey(item, typeNote) || `row:${i}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...item });
        continue;
      }

      existing.quantity = this.toQuantityNumber(existing.quantity) + this.toQuantityNumber(item.quantity);
      if (!existing.idResource && item.idResource) existing.idResource = item.idResource;
      if (!existing.description && item.description) existing.description = item.description;
      if (!existing.position && item.position) existing.position = item.position;
      if (!existing.supervisor && item.supervisor) existing.supervisor = item.supervisor;
    }

    return Array.from(grouped.values());
  }
}
