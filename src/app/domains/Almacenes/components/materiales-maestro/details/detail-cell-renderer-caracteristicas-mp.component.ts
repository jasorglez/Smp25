import { Component, inject, OnDestroy, signal, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { PendingChangesService } from 'app/services/pending-changes.service';
import { CaracteristicasMateriaPrimaService, CaracteristicaMateriaPrima } from 'app/services/caracteristicas-materia-prima.service';

/**
 * Cascada "Características" por material (hoja de Materia Prima / materiales-maestro).
 * 2 columnas: Activo (checkbox) + Característica (texto MAYÚSCULAS, sin duplicados).
 * Guardado CENTRALIZADO por el botón Guardar del Nivel 1 (PendingChangesService).
 */
@Component({
  selector: 'app-detail-cell-renderer-caracteristicas-mp',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div style="padding: 10px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Características de: {{ materialName }}</strong>
          <div>
            <button class="btn btn-sm btn-success me-2" (click)="addCaracteristica()" [disabled]="!gridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button class="btn btn-sm btn-warning me-2" (click)="refreshData()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteSelected()">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="columnDefs"
          [rowData]="rowData"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererCaracteristicasMpComponent implements ICellRendererAngularComp, OnDestroy {
  private service = inject(CaracteristicasMateriaPrimaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private pendingChangesService = inject(PendingChangesService);
  private saverId = '';

  params: any;
  materialId: any;
  materialName = '';
  rowData: any[] = [];
  gridApi: any;
  selected = signal<any>(null);

  private _hasChanges = false;
  get hasChanges(): boolean { return this._hasChanges; }
  set hasChanges(value: boolean) {
    this._hasChanges = value;
    if (this.saverId) this.pendingChangesService.notifyChanges(this.saverId, value);
  }

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 22,
    rowSelection: 'single',
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
  };

  columnDefs = [
    {
      field: 'activo',
      headerName: 'Activo',
      width: 90,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
    },
    {
      field: 'caracteristica',
      headerName: 'Característica',
      flex: 1,
      minWidth: 220,
      editable: true,
      valueSetter: (params: any) => {
        const value = (params.newValue ?? '').toString().trim().toUpperCase();
        if (!value) {
          alerts.basicAlert('Campo requerido', 'La característica es obligatoria.', 'error');
          return false;
        }
        const dup = this.rowData.some((r, i) =>
          i !== params.node.rowIndex && (r.caracteristica ?? '').toString().trim().toUpperCase() === value);
        if (dup) {
          alerts.basicAlert('Valor duplicado', 'Ya existe esa característica para este material.', 'error');
          return false;
        }
        params.data.caracteristica = value;
        return true;
      },
    },
  ];

  private isTempMaterialId(): boolean {
    return typeof this.materialId === 'string' && String(this.materialId).startsWith('temp_');
  }

  agInit(params: any): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo;

    this.saverId = `caracteristicasMp-${this.materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.pendingChangesService.register(this.saverId, {
      hasChanges: false,
      save: (idMap?: Map<string, number>) => this.saveCaracteristicas(idMap),
    });

    this.loadData();
  
    this.cdr.detectChanges();}

  ngOnDestroy(): void {
    if (this.saverId) this.pendingChangesService.unregister(this.saverId);
  }

  refresh(): boolean { return false; }

  onGridReady(params: any) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
    params.api.addEventListener('selectionChanged', () => {
      const nodes = params.api.getSelectedNodes();
      this.selected.set(nodes.length > 0 ? nodes[0].data : null);
    });
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  private loadData(): Promise<boolean> {
    if (this.isTempMaterialId()) { this.rowData = []; return Promise.resolve(true); }
    return new Promise((resolve) => {
      this.service.getByMaterial(Number(this.materialId)).subscribe({
        next: (data: any) => { this.rowData = Array.isArray(data) ? data : []; resolve(true); },
        error: (e) => { console.error('Error cargando características MP:', e); this.rowData = []; resolve(false); },
      });
    });
  }

  refreshData() {
    this.loadData();
    this.hasChanges = false;
  }

  addCaracteristica() {
    if (!this.gridApi) return;
    const newRow = {
      id: `temp_caractMp_${Date.now()}`,
      idMaterial: this.materialId,
      activo: true,
      caracteristica: '',
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'caracteristica' }), 100);
  }

  private cleanForServer(data: any): CaracteristicaMateriaPrima {
    return {
      idMaterial: Number(data.idMaterial),
      activo: data.activo !== false,
      caracteristica: (data.caracteristica ?? '').toString().trim().toUpperCase() || null,
    };
  }

  async saveCaracteristicas(idMap?: Map<string, number>) {
    // Remapeo de ID temporal del material → real (Nivel 1 acaba de crear el material).
    if (this.isTempMaterialId() && idMap) {
      const realId = idMap.get(String(this.materialId));
      if (realId) {
        this.materialId = realId;
        this.rowData.forEach((r: any) => { if (String(r.idMaterial).startsWith('temp_')) r.idMaterial = realId; });
      }
    }
    if (!this.hasChanges && idMap) return;

    const newRows = this.rowData.filter((r) => r.__isNew);
    const modRows = this.rowData.filter((r) => r.__modified && !r.__isNew);

    // Validación: ninguna fila con datos puede quedar sin característica.
    if ([...newRows, ...modRows].some((r) => !(r.caracteristica ?? '').toString().trim())) {
      if (!idMap) alerts.basicAlert('Campo requerido', 'Captura la característica en todas las filas.', 'error');
      return;
    }

    const adds = newRows.map((r) => this.service.create(this.cleanForServer(r)));
    const upds = modRows.map((r) => this.service.update(r.id, this.cleanForServer(r)));

    try {
      await lastValueFrom(concat(...adds, ...upds).pipe(toArray()));
      this.hasChanges = false;
      this.refreshData();
    } catch (e) {
      console.error('Error guardando características MP:', e);
      if (!idMap) alerts.basicAlert('Error', 'No se pudieron guardar las características.', 'error');
    }
  }

  deleteSelected() {
    if (!this.gridApi) { alerts.basicAlert('Error', 'Grid no inicializado.', 'error'); return; }
    const sel = this.selected();
    if (!sel) { alerts.basicAlert('Eliminar', 'Selecciona una característica para eliminar.', 'error'); return; }

    alerts.confirmAlert('Eliminar característica', '¿Eliminar esta característica?', 'warning', 'Sí, eliminar')
      .then((result) => {
        if (!result.isConfirmed) return;
        const realId = sel.id ?? null;
        if (sel.__isNew || !realId || String(realId).startsWith('temp_')) {
          this.rowData = this.rowData.filter((r) => r !== sel);
          this.gridApi.applyTransaction({ remove: [sel] });
          this.selected.set(null);
          return;
        }
        this.service.delete(realId).pipe(
          catchError((e) => { alerts.basicAlert('Eliminar', 'Error al eliminar.', 'error'); console.error(e); return EMPTY; })
        ).subscribe(() => {
          this.refreshData();
          this.selected.set(null);
        });
      });
  }
}
