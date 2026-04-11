import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { DetalleWrapperComponent } from './detalle-wrapper.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetalleWrapperComponent],
  template: `
    <div class="container-fluid h-100 p-3">
      <div style="display: flex; height: calc(100vh - 120px);">
        
        <!-- Botones CRUD lateral izquierdo -->
        <div style="display: flex; flex-direction: column; gap: 5px; margin-right: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; height: fit-content;">
          <button class="btn btn-sm btn-success" (click)="addLote()" title="Agregar">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-sm btn-warning" (click)="discardChanges()" title="Deshacer">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()" [disabled]="!hasRowSelected" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges" title="Guardar">
            <i class="bi bi-floppy"></i>
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
            </span>
          </button>
        </div>

        <!-- Grid -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          <ag-grid-angular
            #agGrid
            class="ag-theme-quartz"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [defaultColDef]="defaultColDef"
            [localeText]="AG_GRID_LOCALE_ES"
            (gridReady)="onGridReady($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (cellClicked)="onCellClicked($event)"
            (selectionChanged)="onSelectionChanged($event)"
            style="width: 100%; height: 100%;">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `]
})
export class JarabeComponent implements OnInit {

  private signalsService = inject(SignalsService);
  private gridApi!: GridApi;
  expandedRowId: string | null = null;
  expandedDetailType: string | null = null;
  hasRowSelected: boolean = false;
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true
  };

  rowData: any[] = [];

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetalleWrapperComponent,
    onRowClicked: (event: any) => {
      const clickedColumn = event.column?.getColId();
      if (clickedColumn === 'pdf') {
        return;
      }
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node: any) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.rowData = [
      {
        id: 1,
        lote: 'LOTE-001-2024',
        articulo: 'JARABE DE ALTA FRUCTOSA',
        fechaElaboracion: '2024-01-15',
        preparacion: 5,
        cantidad: 1000,
        observaciones: 'PRODUCCIÓN ESTÁNDAR',
        historialGastos: 5,
        adicional: 'N/A',
        activom: true,
        detailType: null,
        isExpanded: false,
        preparacionData: [
          { id: 1, ingrediente: 'AZÚCAR REFINADA', prep: 'Disolución', coreccion: 'BRIX 65%', parametros: 'Temperatura 40°C, agitación constante', parametrosData: [
            { id: 1, parametro1: 65.5, parametro2: 7.0, parametro3: 65.0, parametro4: 7.2, parametro5: 'VERIFICAR BRIX FINAL' },
            { id: 2, parametro1: 40.0, parametro2: 7.0, parametro3: 40.5, parametro4: 7.1, parametro5: 'TEMPERATURA CRÍTICA' }
          ]},
          { id: 2, ingrediente: 'AGUA PURIFICADA', prep: 'Hervor', coreccion: 'pH 7.0', parametros: '100°C por 15 minutos', parametrosData: [
            { id: 1, parametro1: 0.0, parametro2: 7.0, parametro3: 0.0, parametro4: 7.0, parametro5: 'AGUA PURA VERIFICADA' }
          ]},
          { id: 3, ingrediente: 'ÁCIDO CÍTRICO', prep: 'Incorporación', coreccion: 'pH 3.5', parametros: 'Adición lenta con agitación', parametrosData: [
            { id: 1, parametro1: 3.5, parametro2: 2.5, parametro3: 3.6, parametro4: 3.4, parametro5: 'CONTROLAR PH LENTAMENTE' }
          ]},
          { id: 4, ingrediente: 'BENZOATO DE SODIO', prep: 'Disolución', coreccion: 'Conservante 0.1%', parametros: 'Diluir en agua tibia', parametrosData: []},
          { id: 5, ingrediente: 'COLORANTE CARAMELO', prep: 'Incorporación', coreccion: 'Color café claro', parametros: 'Gotas según tonalidad', parametrosData: []}
        ],
        historialData: [
          { id: 1, fechaSalida: '2024-01-20', quienUso: 'JUAN PÉREZ', cantidadSalida: 250, cantidadExistencia: 750, loteProductoUso: 'LOTE-001-2024', nombreIngreso: 'INGRESO-001', numeroReporte: 'REP-001-2024', adicional: 'SALIDA PARA PRODUCCIÓN' },
          { id: 2, fechaSalida: '2024-01-25', quienUso: 'MARÍA GARCÍA', cantidadSalida: 100, cantidadExistencia: 650, loteProductoUso: 'LOTE-001-2024', nombreIngreso: 'INGRESO-002', numeroReporte: 'REP-002-2024', adicional: 'MUESTRAS DE CALIDAD' }
        ],
        __isNew: false,
        __modified: false,
        saved: true
      },
      {
        id: 2,
        lote: 'LOTE-002-2024',
        articulo: 'JARABE DE MAÍZ',
        fechaElaboracion: '2024-01-20',
        preparacion: 3,
        cantidad: 500,
        observaciones: 'LOTE PEQUEÑO',
        historialGastos: 3,
        adicional: 'ESPECIAL',
        activom: true,
        detailType: null,
        isExpanded: false,
        preparacionData: [
          { id: 1, ingrediente: 'ALMIDÓN DE MAÍZ', prep: 'Disolución', coreccion: 'VIS 30', parametros: 'Mezclado en frío', parametrosData: [
            { id: 1, parametro1: 30.0, parametro2: 6.5, parametro3: 30.5, parametro4: 6.8, parametro5: 'VISCOSIDAD ALTA' }
          ]},
          { id: 2, ingrediente: 'AGUA POTABLE', prep: 'Hervor', coreccion: 'pH 6.5', parametros: '95°C por 10 min', parametrosData: [
            { id: 1, parametro1: 95.0, parametro2: 6.5, parametro3: 95.0, parametro4: 6.5, parametro5: 'ESTERILIZAR AGUA' }
          ]},
          { id: 3, ingrediente: 'ENZIMAS ALFA', prep: 'Incorporación', coreccion: 'ACTIVACIÓN', parametros: '60°C por 2 horas', parametrosData: [
            { id: 1, parametro1: 60.0, parametro2: 5.5, parametro3: 62.0, parametro4: 5.2, parametro5: 'TIEMPO DE ACTIVACIÓN' }
          ]}
        ],
        historialData: [
          { id: 1, fechaSalida: '2024-02-01', quienUso: 'CARLOS LÓPEZ', cantidadSalida: 150, cantidadExistencia: 350, loteProductoUso: 'LOTE-002-2024', nombreIngreso: 'INGRESO-003', numeroReporte: 'REP-003-2024', adicional: 'ENVÍO A CLIENTE' }
        ],
        __isNew: false,
        __modified: false,
        saved: true
      },
      {
        id: 3,
        lote: 'LOTE-003-2024',
        articulo: 'JARABE INVERTIDO',
        fechaElaboracion: '2024-02-01',
        preparacion: 8,
        cantidad: 2000,
        observaciones: 'ALTA DEMANDA',
        historialGastos: 4,
        adicional: 'PREMIUM',
        activom: true,
        detailType: null,
        isExpanded: false,
        preparacionData: [
          { id: 1, ingrediente: 'SACAROSA PURA', prep: 'Disolución', coreccion: 'BRIX 65°', parametros: '50°C con agitación', parametrosData: [
            { id: 1, parametro1: 65.0, parametro2: 7.0, parametro3: 65.5, parametro4: 7.0, parametro5: 'JARABE ESTÁNDAR' }
          ]},
          { id: 2, ingrediente: 'ÁCIDO CLorhÍDRICO', prep: 'Incorporación', coreccion: 'pH 2.0', parametros: 'Gotas controladas', parametrosData: [
            { id: 1, parametro1: 2.0, parametro2: 1.5, parametro3: 2.1, parametro4: 2.0, parametro5: 'MUY ÁCIDO - CONTROLAR' }
          ]},
          { id: 3, ingrediente: 'HIDRÓXIDO DE SODIO', prep: 'Neutralización', coreccion: 'pH 5.5', parametros: 'Lento hasta pH final', parametrosData: [
            { id: 1, parametro1: 5.5, parametro2: 2.0, parametro3: 5.4, parametro4: 5.5, parametro5: 'NEUTRALIZACIÓN COMPLETA' }
          ]}
        ],
        historialData: [
          { id: 1, fechaSalida: '2024-02-05', quienUso: 'ANA MARTÍNEZ', cantidadSalida: 500, cantidadExistencia: 1500, loteProductoUso: 'LOTE-003-2024', nombreIngreso: 'INGRESO-004', numeroReporte: 'REP-004-2024', adicional: 'PRIMERA SALIDA' }
        ],
        __isNew: false,
        __modified: false,
        saved: true
      },
      {
        id: 4,
        lote: 'LOTE-004-2024',
        articulo: 'JARABE DE GLUCOSA',
        fechaElaboracion: '2024-02-10',
        preparacion: 2,
        cantidad: 750,
        observaciones: 'PENDIENTE CONTROL',
        historialGastos: 2,
        adicional: 'ESTANDAR',
        activom: false,
        detailType: null,
        isExpanded: false,
        preparacionData: [
          { id: 1, ingrediente: 'GLUCOSA CRISTALINA', prep: 'Disolución', coreccion: 'BRIX 45°', parametros: 'Agua tibia 35°C', parametrosData: [
            { id: 1, parametro1: 45.0, parametro2: 7.0, parametro3: 45.2, parametro4: 6.9, parametro5: 'DISOLVER EN AGUA TIBIA' }
          ]},
          { id: 2, ingrediente: 'PRESERVANTE', prep: 'Incorporación', coreccion: '0.05%', parametros: 'Mezcla homogénea', parametrosData: []}
        ],
        historialData: [],
        __isNew: false,
        __modified: false,
        saved: true
      },
      {
        id: 5,
        lote: 'LOTE-005-2024',
        articulo: 'JARABE DE SACAROSA',
        fechaElaboracion: '2024-02-15',
        preparacion: 6,
        cantidad: 1500,
        observaciones: 'EN PROCESO',
        historialGastos: 5,
        adicional: 'ORGÁNICO',
        activom: true,
        detailType: null,
        isExpanded: false,
        preparacionData: [
          { id: 1, ingrediente: 'AZÚCAR ORGÁNICA', prep: 'Disolución', coreccion: 'BRIX 60°', parametros: '40°C sin agitadores metálicos', parametrosData: [
            { id: 1, parametro1: 60.0, parametro2: 7.0, parametro3: 60.5, parametro4: 6.8, parametro5: 'PRODUCTO ORGÁNICO' }
          ]},
          { id: 2, ingrediente: 'AGUA PURIFICADA', prep: 'Hervor', coreccion: 'pH 7.0', parametros: '100°C por 20 min', parametrosData: [
            { id: 1, parametro1: 100.0, parametro2: 7.0, parametro3: 100.0, parametro4: 7.0, parametro5: 'ESTERILIZACIÓN COMPLETA' }
          ]},
          { id: 3, ingrediente: 'EXTRACTO DE VAINILLA', prep: 'Incorporación', coreccion: 'AROMA', parametros: '1mL por kg', parametrosData: [
            { id: 1, parametro1: 0.0, parametro2: 5.5, parametro3: 0.0, parametro4: 5.5, parametro5: 'AROMA NATURAL' }
          ]}
        ],
        historialData: [
          { id: 1, fechaSalida: '2024-02-20', quienUso: 'PEDRO SÁNCHEZ', cantidadSalida: 200, cantidadExistencia: 1300, loteProductoUso: 'LOTE-005-2024', nombreIngreso: 'INGRESO-005', numeroReporte: 'REP-005-2024', adicional: 'ÚLTIMA SALIDA DEL LOTE' }
        ],
        __isNew: false,
        __modified: false,
        saved: true
      }
    ];
  }

  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    this._colDefs = [
      {
        headerName: '#',
        width: 60,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
   
      {
        field: 'lote',
        headerName: 'Lote',
        width: 150,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.lote = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'articulo',
        headerName: 'Articulo',
        width: 200,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.articulo = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'fechaElaboracion',
        headerName: 'Fecha Elaboración',
        width: 150,
        editable: true,
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (!params.value) return '';
          const [y, m, d] = String(params.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : params.value;
        },
        valueSetter: (params) => {
          if (!params.newValue) return false;
          if (params.newValue instanceof Date) {
            const d = params.newValue;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            params.data.fechaElaboracion = `${y}-${m}-${day}`;
          } else {
            params.data.fechaElaboracion = String(params.newValue).substring(0, 10);
          }
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'preparacion',
        headerName: 'Preparación',
        width: 160,
        editable: false,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          const container = document.createElement('div');
          container.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #0d6efd; text-decoration: underline;';
          container.innerHTML = `<span>${count} ingrediente(s)</span>`;
          container.addEventListener('click', () => {
            this.toggleCascade(params.node, 'preparacion');
          });
          return container;
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueSetter: (params) => {
          params.data.cantidad = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'observaciones',
        headerName: 'Observaciones',
        flex: 1,
        minWidth: 180,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        valueSetter: (params) => {
          params.data.observaciones = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'historialGastos',
        headerName: 'Historial Gastos',
        width: 140,
        editable: false,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          const container = document.createElement('div');
          container.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e65100; text-decoration: underline;';
          container.innerHTML = `<span>${count} registro(s)</span>`;
          container.addEventListener('click', () => {
            this.toggleCascade(params.node, 'historial');
          });
          return container;
        },
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' }
      },
      {
        field: 'adicional',
        headerName: 'Adicional',
        width: 120,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.adicional = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'activom',
        headerName: 'Activom',
        width: 80,
        editable: true,
        cellRenderer: (params: any) => {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = params.value === true;
          input.style.cursor = 'pointer';
          input.addEventListener('change', () => {
            params.data.activom = input.checked;
            params.data.__modified = true;
            this.hasUnsavedChanges = true;
            params.api.refreshCells({ rowNodes: [params.node], columns: ['activom'] });
          });
          return input;
        }
      }
    ];

    return this._colDefs;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        const detailData = params.data.detailType === 'preparacion' 
          ? params.data.preparacionData || [] 
          : params.data.historialData || [];
        params.successCallback(detailData);
      },
      context: {
        componentParent: this
      }
    });
  }

  toggleCascade(node: any, type: string) {
    if (this.expandedRowId === node.id && this.expandedDetailType === type) {
      node.setExpanded(false);
      this.expandedRowId = null;
      this.expandedDetailType = null;
      node.data.detailType = null;
      node.data.isExpanded = false;

      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      node.data.detailType = type;
      this.expandedRowId = node.id;
      this.expandedDetailType = type;
      node.data.isExpanded = true;

      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  onCellClicked(event: any) {
    event.node.setSelected(true);
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.hasRowSelected = selectedNodes.length > 0;
  }

  addLote() {
    const tempId = `temp_${Date.now()}`;
    const today = new Date();
    const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const newItem = {
      id: tempId,
      lote: '',
      articulo: '',
      fechaElaboracion: fecha,
      preparacion: 0,
      cantidad: 0,
      observaciones: '',
      historialGastos: 0,
      adicional: '',
      activom: true,
      detailType: null,
      __isNew: true,
      __modified: false,
      saved: false
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'lote'
      });
    }, 0);
  }

  async deleteSelected() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un lote para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedNodes[0].data;

    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(row => row.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      alerts.basicAlert('Eliminado', 'Lote eliminado del listado', 'success');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar lote?',
      `¿Está seguro de eliminar "${selectedItem.lote}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    this.rowData = this.rowData.filter(row => row.id !== selectedItem.id);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);

    alerts.basicAlert('Eliminado', 'Lote eliminado correctamente', 'success');
  }

  saveChanges() {
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const itemsSinLote = this.rowData.filter(item =>
      (item.__isNew || item.__modified) && !item.lote
    );

    if (itemsSinLote.length > 0) {
      alerts.basicAlert('Campo obligatorio', 'La columna "Lote" es obligatoria.', 'warning');
      return;
    }

    this.rowData.forEach(item => {
      if (item.__isNew || item.__modified) {
        item.__isNew = false;
        item.__modified = false;
        item.saved = true;
      }
    });

    this.hasUnsavedChanges = false;
    this.gridApi.redrawRows();

    const totalSaved = newItems.length + modifiedItems.length;
    alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} lote(s) exitosamente.`, 'success');
  }

  discardChanges() {
    if (this.hasUnsavedChanges) {
      this.loadData();
      this.hasUnsavedChanges = false;
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.redrawRows();
      alerts.basicAlert('Deshacer', 'Cambios descartados', 'info');
    } else {
      alerts.basicAlert('Sin cambios', 'No hay cambios por deshacer', 'info');
    }
  }
}
