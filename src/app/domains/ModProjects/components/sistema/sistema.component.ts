import { Component, OnInit, inject, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DailyReportService } from 'app/services/daily-report.service';
import { LogbookService } from 'app/services/logbook.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
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

@Component({
  selector: 'app-sistema',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AgGridModule,
    ButtonCellRendererExpenditureComponent,
    PdfButtonCellRendererComponent, PdfDetailComponent,
    BitacoraPersonalComponent, BitacoraMaterialComponent, BitacoraEquiposComponent,
    BitacoraFotosComponent, BitacoraVideosComponent, BitacoraConceptosComponent, BitacoraNotasComponent,
  ],
  templateUrl: './sistema.component.html',
  styleUrl: './sistema.component.scss'
})
export class SistemaComponent implements OnInit {

  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);
  private signalsService    = inject(SignalsService);

  public rowData: any[]       = [];
  private originalRowData: any[] = [];
  public gridApi!: GridApi;
  public hasUnsavedChanges   = false;
  public selectedRow: any    = null;
  private idProject: number  = 0;
  private idRoot: number    = 0;
  
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
    detailCellRendererSelector: (params: any) => {
      const t = params.data?.detailType;
      if (t === 'pdf')       return { component: PdfDetailComponent };
      if (t === 'material')  return { component: BitacoraMaterialComponent };
      if (t === 'equipos')   return { component: BitacoraEquiposComponent };
      if (t === 'fotos')     return { component: BitacoraFotosComponent };
      if (t === 'videos')    return { component: BitacoraVideosComponent };
      if (t === 'conceptos') return { component: BitacoraConceptosComponent };
      if (t === 'notas')     return { component: BitacoraNotasComponent };
      return { component: BitacoraPersonalComponent }; // default: personal
    },
    suppressMenuHide: false,
    context: {
      componentParent: null
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
      field: 'date', headerName: 'Fecha', width: 120, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.date ? String(p.data.date).substring(0, 10) : '',
      valueSetter: (p) => { p.data.date = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    { field: 'startTime', headerName: 'Inicio', width: 100, editable: true },
    { field: 'endTime', headerName: 'Término', width: 120, editable: true },
    { field: 'type', headerName: 'Tipo', width: 100, editable: true },
    { field: 'description', headerName: 'Descripción', width: 200, editable: true },
    {
      field: 'totalPay', headerName: 'Total $', width: 140, editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p) => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00',
    },
    {
      headerName: 'PDF',
      width: 70,
      cellRenderer: PdfButtonCellRendererComponent,
      cellRendererParams: {
        onClick: (node: any) => this.togglePdfDetail(node),
      },
      editable: false,
      cellStyle: { textAlign: 'center' }
    },

    // Columnas de Bitácoras como botones
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

    {
      field: 'personal',
      headerName: 'Personal',
      width: 140,
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
      }
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    });
  }

  ngOnInit(): void {
    const projectId = this.signalsService.getSidebarProjectId()();
    if (projectId) {
      this.idProject = projectId;
      this.loadReports();
    }
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridOptions.context.componentParent = this;
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData || []);
      },
      context: this.gridOptions.context
    });
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
    if (!this.idProject) {
      alerts.basicAlert('Aviso', 'Selecciona un Proyecto antes de agregar un reporte', 'warning');
      return;
    }
    const newRow = {
      idOt: null,
      idProject: this.idProject,
      date: new Date().toISOString().substring(0, 10),
      startTime: '07:52:00',
      endTime: '17:02:00',
      type: 'CORTE',
      description: '',
      totalPay: 0,
      close: false,
      paid: true,
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
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'date' });
    }, 50);
  }

  async saveChanges(): Promise<void> {
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
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  async delete(): Promise<void> {
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
    console.log('📤 Enviando al servidor:', data);
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
}
