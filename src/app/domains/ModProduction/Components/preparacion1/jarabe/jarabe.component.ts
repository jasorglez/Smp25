import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { environment } from '@env/environment';
import { PreparacionService } from 'app/services/preparacion.service';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { BranchsService } from 'app/services/branchs.service';
import { MaterialsService } from 'app/services/materials.service';
import { DetalleWrapperComponent } from './detalle-wrapper.component';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

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
    ::ng-deep .ag-cell-focus {
      outline: 3px solid #FFD700 !important;
      outline-offset: -1px;
    }
    ::ng-deep .ag-cell-editing {
      outline: 3px solid #FFD700 !important;
      outline-offset: -1px;
    }
  `]
})
export class JarabeComponent implements OnInit {

  private preparacionService = inject(PreparacionService);
  private signalsService = inject(SignalsService);
  private authService = inject(AuthService);
  private branchsService = inject(BranchsService);
  private materialsService = inject(MaterialsService);
  private gridApi!: GridApi;
  expandedRowId: string | null = null;
  expandedDetailType: string | null = null;
  hasRowSelected: boolean = false;
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  userBranches: any[] = [];
  branchNames: string[] = [];
  rawMaterials: any[] = [];
  rawMaterialNames: string[] = [];
  /** Igual que Proveedores: Enter cierra edición y onCellEditingStopped abre la siguiente celda editable */
  private enterPressedFlag = false;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idUser && idCompany) {
        this.loadUserBranches();
        this.loadRawMaterials(idCompany);
      }
    });
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    cellClassRules: {
      'new-row-cell': (params: any) => !!params.data?.__isNew
    },
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressedFlag = true;
        setTimeout(() => {
          if (this.gridApi) {
            this.gridApi.stopEditing();
          }
        }, 0);
        return true;
      }
      return false;
    }
  };

  rowData: any[] = [];

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowClassRules: {
      'new-row-highlight': (params: any) => !!params.data?.__isNew
    },
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (_dataItem: any) => true,
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
    },
    onCellEditingStarted: (event: any) => {
      if (event.data?.__isNew) {
        setTimeout(() => {
          const cell = document.querySelector(
            `.ag-row[row-index="${event.rowIndex}"] .ag-cell[col-id="${event.column.getColId()}"]`
          ) as HTMLElement;
          if (cell) {
            cell.style.outline = '2px solid #e67e00';
            const input = cell.querySelector('input') as HTMLElement;
            if (input) {
              input.style.backgroundColor = '#ffeaa0';
            }
          }
        }, 30);
      }
    },
    onCellEditingStopped: (event: any) => {
      if (event.data?.__isNew) {
        const cell = document.querySelector(
          `.ag-row[row-index="${event.rowIndex}"] .ag-cell[col-id="${event.column.getColId()}"]`
        ) as HTMLElement;
        if (cell) {
          cell.style.outline = '';
          const input = cell.querySelector('input') as HTMLElement;
          if (input) {
            input.style.backgroundColor = '';
          }
        }
      }

      const isEscapeKey = event.event?.key === 'Escape' || event.event?.keyCode === 27;
      if (isEscapeKey) {
        return;
      }

      const isEnterKey =
        event.event?.key === 'Enter' || event.event?.keyCode === 13 || this.enterPressedFlag;
      this.enterPressedFlag = false;

      if (isEnterKey) {
        const allColumns = this.gridApi.getColumnDefs() as ColDef[];
        const currentIndex = allColumns.findIndex(
          (col) => 'field' in col && col.field === event.column.colId
        );
        const nextEditableCol = allColumns.slice(currentIndex + 1).find(
          (col) =>
            'field' in col &&
            col.field &&
            col.editable &&
            !('hide' in col && (col as any).hide)
        );

        if (nextEditableCol && 'field' in nextEditableCol && nextEditableCol.field) {
          setTimeout(() => {
            this.gridApi.startEditingCell({
              rowIndex: event.rowIndex,
              colKey: nextEditableCol.field as string
            });
          }, 100);
        }
      }
    }
  };

  ngOnInit() {
    this.loadData();
  }

  async loadRawMaterials(idCompany: number) {
    try {
      const data = await lastValueFrom(this.materialsService.getMaterialsxview(idCompany));
      const list: any[] = Array.isArray(data) ? data : [];
      this.rawMaterials = list;
      this.rawMaterialNames = list.map(m => m.articulo || m.description || m.insumo || '').filter(Boolean);
      this._colDefs = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
      }
    } catch (error) {
      console.error('Error loading raw materials:', error);
    }
  }

  async loadUserBranches() {
    try {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (!idUser || !idCompany) return;

      const hasAll = this.authService.hasDetailedPermission('principal', 'see-all-branches');
      const email = localStorage.getItem('mail') ?? '';
      const isRoot = email === environment.root;

      let mapped: { id: any; name: string }[];

      if (hasAll || isRoot) {
        const data = await lastValueFrom(this.branchsService.getBranches2fields(idCompany));
        const list: any[] = Array.isArray(data) ? data : [];
        list.sort((a, b) => a.name.localeCompare(b.name));
        mapped = list.map((b: any) => ({ id: b.id, name: b.name as string }));
      } else {
        const data = await lastValueFrom(this.branchsService.getBranchesByUserAndCompany(idUser, idCompany));
        const list: any[] = (data as any)?.project ?? (Array.isArray(data) ? data : []);
        mapped = list
          .map((b: any) => ({
            id: b?.idPermission || b?.idBranch || b?.id,
            name: (b?.name || b?.description || b?.Name || '') as string
          }))
          .filter(b => b.id && b.name.trim());
      }

      this.userBranches = mapped;
      this.branchNames = mapped.map(b => b.name);

      this._colDefs = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
      }
    } catch (error) {
      console.error('Error loading user branches:', error);
    }
  }

  async loadData() {
    try {
      const items = await lastValueFrom(this.preparacionService.getAll());
      this.rowData = items.map(item => this.mapPreparacion(item));
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    } catch (error) {
      console.error('Error loading preparaciones:', error);
      this.rowData = [];
    }
  }

  private mapPreparacion(item: any): any {
    return {
      id: item.id,
      lote: item.lote || '',
      articulo: item.articulo || '',
      sucursal: item.idSucursal || null,
      fechaElaboracion: item.fecha || '',
      preparacion: item.preparacionCount || 0,
      cantidad: item.cantidad || 0,
      observaciones: item.observaciones || '',
      nota: item.nota || '',
      historialGastos: item.historialCount || 0,
      adicional: item.adicional || '',
      activom: item.active !== false,
      detailType: null,
      isExpanded: false,
      preparacionData: [],
      historialData: [],
      __isNew: false,
      __modified: false,
      saved: true
    };
  }

  private mapDetalle(item: any): any {
    return {
      id: item.id,
      idPreparacion: item.idPreparacion,
      ingrediente: item.ingrediente || '',
      prep: item.prep || '',
      coreccion: item.correccion || '',
      parametros: item.parametros || '',
      parametrosData: [],
      __isNew: false,
      __modified: false
    };
  }

  private mapParams(item: any): any {
    return {
      id: item.id,
      idDetalle: item.idDetalle,
      parametro1: item.parametro1,
      parametro2: item.parametro2,
      parametro3: item.parametro3,
      parametro4: item.parametro4,
      parametro5: item.parametro5 || '',
      __isNew: false,
      __modified: false
    };
  }

  private mapHistorial(item: any): any {
    return {
      id: item.id,
      idPreparacion: item.idPreparacion,
      fechaSalida: item.fechaSalida || '',
      quienUso: item.quienUs || '',
      cantidadSalida: item.cantidadSalida || 0,
      cantidadExistencia: item.cantidadExistencia || 0,
      loteProductoUso: item.loteProductoUso || '',
      nombreIngreso: item.nombreIngreso || '',
      numeroReporte: item.numeroReporte || '',
      adicional: item.adicional || '',
      __isNew: false,
      __modified: false
    };
  }

  private toApiPayload(item: any): any {
    return {
      lote: item.lote,
      articulo: item.articulo,
      idSucursal: item.sucursal || null,
      fecha: item.fechaElaboracion || null,
      preparacionCount: item.preparacion || 0,
      cantidad: item.cantidad || 0,
      observaciones: item.observaciones,
      nota: item.nota || '',
      historialCount: item.historialGastos || 0,
      adicional: item.adicional,
      active: item.activom !== false
    };
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
        field: 'sucursal',
        headerName: 'Sucursal',
        width: 160,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.branchNames }),
        valueFormatter: (params) => {
          if (params.value) {
            const branch = this.userBranches.find(b => b.id === params.value);
            return branch?.name ?? '';
          }
          return '';
        },
        valueSetter: (params) => {
          const selectedBranch = this.userBranches.find(b => b.name === params.newValue);
          params.data.sucursal = selectedBranch?.id ?? null;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'nota',
        headerName: 'Nota',
        width: 180,
        editable: true,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          params.data.nota = params.newValue ?? '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 200,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.rawMaterialNames }),
        valueSetter: (params) => {
          params.data.articulo = params.newValue ?? '';
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
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
        editable: false,
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
      getDetailRowData: async (detailParams: any) => {
        try {
          if (detailParams.data.detailType === 'preparacion') {
            const detalles = await lastValueFrom(this.preparacionService.getDetalles(detailParams.data.id));
            const mapped = await Promise.all(detalles.map(async (d: any) => {
              const det = this.mapDetalle(d);
              const paramsList = await lastValueFrom(this.preparacionService.getParams(d.id));
              det.parametrosData = paramsList.map((p: any) => this.mapParams(p));
              return det;
            }));
            // Asegurar que el conteo mostrado en el master sea el real (nivel 2)
            detailParams.data.preparacion = mapped.length;
            detailParams.api?.refreshCells?.({
              rowNodes: [detailParams.node],
              columns: ['preparacion'],
              force: true,
            });
            detailParams.successCallback(mapped);
          } else {
            const historial = await lastValueFrom(this.preparacionService.getHistorial(detailParams.data.id));
            const mappedHist = historial.map((h: any) => this.mapHistorial(h));
            // Mantener también el conteo del historial consistente
            detailParams.data.historialGastos = mappedHist.length;
            detailParams.api?.refreshCells?.({
              rowNodes: [detailParams.node],
              columns: ['historialGastos'],
              force: true,
            });
            detailParams.successCallback(mappedHist);
          }
        } catch (error) {
          console.error('Error loading detail data:', error);
          detailParams.successCallback([]);
        }
      },
      context: {
        componentParent: this
      }
    });

    this.loadData();
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

    // Obtener el nombre de la sucursal actual y buscar su ID
    const branchNameActual = this.signalsService.getBranchNameSelectedBySidebar()() ?? '';
    const currentBranch = this.userBranches.find(b => b.name === branchNameActual);
    const idSucursalActual = currentBranch?.id ?? null;

    const newItem = {
      id: tempId,
      lote: '',
      articulo: '',
      sucursal: idSucursalActual,
      fechaElaboracion: fecha,
      preparacion: 0,
      cantidad: 0,
      observaciones: '',
      nota: '',
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

    try {
      await lastValueFrom(this.preparacionService.delete(selectedItem.id));
      this.rowData = this.rowData.filter(row => row.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      alerts.basicAlert('Eliminado', 'Lote eliminado correctamente', 'success');
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Ocurrió un error al eliminar el lote.';

      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.error) {
        errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      } else if (error?.message) {
        errorMessage = error.message;
      }

      // Show minimal toast error notification
      alerts.preparacionErrorToast(errorMessage);
    }
  }

  async saveChanges() {
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

    try {
      for (const item of newItems) {
        const payload = this.toApiPayload(item);
        const created = await lastValueFrom(this.preparacionService.create(payload));
        item.id = created.id;
        item.__isNew = false;
        item.__modified = false;
        item.saved = true;
      }

      for (const item of modifiedItems) {
        const payload = this.toApiPayload(item);
        await lastValueFrom(this.preparacionService.update(item.id, payload));
        item.__modified = false;
        item.saved = true;
      }

      this.hasUnsavedChanges = false;
      this.gridApi.redrawRows();

      const totalSaved = newItems.length + modifiedItems.length;
      alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} lote(s) exitosamente.`, 'success');
    } catch (error) {
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los cambios.', 'error');
    }
  }

  async discardChanges() {
    if (this.hasUnsavedChanges) {
      await this.loadData();
      this.hasUnsavedChanges = false;
      this.gridApi.redrawRows();
      alerts.basicAlert('Deshacer', 'Cambios descartados', 'info');
    } else {
      alerts.basicAlert('Sin cambios', 'No hay cambios por deshacer', 'info');
    }
  }
}
