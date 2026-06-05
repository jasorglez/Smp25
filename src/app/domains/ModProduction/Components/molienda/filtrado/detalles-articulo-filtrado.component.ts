import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalles-articulo-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #e8f5e9;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.8rem; color: #1b5e20;">Artículos de Materia Prima</strong>
        <div class="d-flex gap-1">
          <button class="btn btn-warning" (click)="revert()" title="Deshacer cambios">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-danger" (click)="deleteRow()" [disabled]="!selectedRow" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; position: relative; }`]
})
export class DetallesArticuloFiltradoComponent implements OnDestroy {
  private productionService = inject(ProductionService);

  private internalParams: any;
  private idMatDetalle: number | null = null;
  private articuloOptions: { id: number; name: string }[] = [];
  private idMatPrimaParent: number | null = null;
  private originalRowData: any[] = [];

  gridApi!: GridApi;
  rowData: any[] = [];
  selectedRow: any = null;

  private _hasChanges = false;
  get hasChanges(): boolean { return this._hasChanges; }
  set hasChanges(value: boolean) {
    this._hasChanges = value;
    if (this.internalParams?.data) this.internalParams.data.__pendingArticulosDirty = value;
  }

  colDefs: ColDef[] = [
    {
      field: 'idArticulo',
      headerName: 'Artículo',
      flex: 1,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(this.rowData.filter(r => r !== this.selectedRow).map((r: any) => r.idArticulo).filter(Boolean));
        return {
          options: this.articuloOptions
            .filter(a => !usados.has(a.id) && a.id !== this.idMatPrimaParent)
            .map(a => ({ id: a.id, description: a.name })),
        };
      },
      valueFormatter: (p: any) => this.articuloOptions.find(a => a.id === p.value)?.name ?? '',
      valueSetter: (p: any) => {
        p.data.idArticulo = p.newValue;
        p.data.__modified = true;
        this.hasChanges = true;
        // When the empty auto row gets its first value, insert the next empty row
        if (p.data.__isNew && p.oldValue == null && p.newValue != null)
          setTimeout(() => this.addAutoRow(false), 0);
        return true;
      },
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 110,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? String(Number(p.value)) : '',
      valueSetter: (p: any) => { p.data.cantidad = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
  ];

  gridOptions: any = {
    components: { selectV2: SelectWithTooltipEditorV2Component },
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 22,
    rowSelection: 'single',
    autoSizeStrategy: { type: 'fitCellContents' },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: { resizable: true },
  };

  agInit(params: any) {
    this.internalParams = params;
    this.idMatDetalle = params?.data?.id ?? null;
    this.articuloOptions = params?.context?.articuloOptions ?? [];
    this.idMatPrimaParent = params?.data?.idMatPrima ?? params?.context?.idMatPrimaParent ?? null;

    // Restore cached rows if component was collapsed with unsaved changes
    const cached = params?.data?.__pendingArticulos;
    if (Array.isArray(cached) && params?.data?.__pendingArticulosDirty) {
      this.rowData = cached;
      this._hasChanges = true;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.addAutoRow();
      }
    } else if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.loadData();
    }

    this.registerOnRow(params);
  }

  private registerOnRow(params: any) {
    if (!params?.data) return;
    params.data.__articuloHasChanges = () => this._hasChanges;
    params.data.__articuloSave = () => this.saveChanges();
  }

  refresh(): boolean { return false; }

  ngOnDestroy() {
    const data = this.internalParams?.data;
    if (!data) return;

    // Cache current rows and dirty flag so the parent can save even when collapsed
    data.__pendingArticulos = JSON.parse(JSON.stringify(this.rowData));
    data.__pendingArticulosDirty = this._hasChanges;

    if (!this._hasChanges) {
      data.__articuloHasChanges = () => false;
      data.__articuloSave = async () => {};
      return;
    }

    // Replace live references with offline closures that use the cached snapshot
    const productionSvc = this.productionService;
    const idMatDetalle = this.idMatDetalle;
    const cachedRows: any[] = data.__pendingArticulos;
    const onCountChanged = this.internalParams?.context?.onArticuloCountChanged;

    data.__articuloHasChanges = () => !!data.__pendingArticulosDirty;
    data.__articuloSave = async () => {
      if (!data.__pendingArticulosDirty) return;
      // Resolve real ID: parent may have saved this row and updated data.id after collapse
      const realIdMatDetalle = idMatDetalle ?? (data.id as number) ?? null;
      // Discard empty rows (auto-inserted but never filled)
      const newRows = cachedRows.filter((r: any) => r.__isNew && r.idArticulo);
      const modRows = cachedRows.filter((r: any) => r.__modified && !r.__isNew);
      for (const row of newRows) {
        const created = await lastValueFrom(productionSvc.createMoliendaMatArticulo({
          idMatDetalle: realIdMatDetalle, idArticulo: row.idArticulo, cantidad: row.cantidad ?? 0,
        }));
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(productionSvc.updateMoliendaMatArticulo(row.id, {
          idMatDetalle: realIdMatDetalle, idArticulo: row.idArticulo, cantidad: row.cantidad ?? 0,
        }));
        row.__modified = false;
      }
      data.__pendingArticulosDirty = false;
      if (onCountChanged) {
        const saved = cachedRows.filter((r: any) => !r.__isNew);
        onCountChanged(idMatDetalle, saved.length, saved.reduce((s: number, r: any) => s + (Number(r.cantidad) || 0), 0));
      }
    };
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this._hasChanges && this.rowData.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.addAutoRow();
    } else if (!this.idMatDetalle) {
      // New parent row: grid just mounted, add the auto row directly
      this.addAutoRow();
    } else {
      this.loadData();
    }
  }

  onSelectionChanged(event: any) {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  async loadData() {
    if (!this.idMatDetalle) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed()) this.addAutoRow();
      return;
    }
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaMatArticuloByDetalle(this.idMatDetalle));
      const mapped = (Array.isArray(items) ? items : []).map(i => ({
        id: i.id,
        idMatDetalle: i.idMatDetalle,
        idArticulo: i.idArticulo ?? null,
        cantidad: i.cantidad ?? 0,
        __isNew: false,
        __modified: false,
      }));
      this.rowData = mapped;
      this.sortRows();
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.addAutoRow();
    } catch (e) {
      console.error('Error cargando artículos de mat detalle:', e);
    }
  }

  private addAutoRow(focusNew = true) {
    // Don't add if there's already an unfilled new row
    if (this.rowData.some(r => r.__isNew && !r.idArticulo)) return;
    const autoRow = {
      id: null, __tempId: `auto_${Date.now()}`, __isNew: true,
      idMatDetalle: this.idMatDetalle,
      idArticulo: null,
      cantidad: null,
    };
    this.rowData = [...this.rowData, autoRow];
    // hasChanges stays false — no real data yet
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      if (focusNew) {
        const lastIdx = this.rowData.length - 1;
        setTimeout(() => this.gridApi.startEditingCell({ rowIndex: lastIdx, colKey: 'idArticulo' }), 80);
      }
    }
  }

  addRow() {
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true,
      idMatDetalle: this.idMatDetalle,
      idArticulo: null,
      cantidad: null,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' }), 80);
    }
  }

  async saveChanges() {
    // Discard empty rows (auto-inserted but never filled)
    this.rowData = this.rowData.filter(r => !(r.__isNew && !r.idArticulo));
    const newRows = this.rowData.filter(r => r.__isNew);
    const modRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modRows.length) { this._hasChanges = false; return; }
    // Resolve real ID: parent may have just saved this row and updated data.id
    const realId = this.idMatDetalle ?? (this.internalParams?.data?.id as number) ?? null;
    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.productionService.createMoliendaMatArticulo({
          idMatDetalle: realId,
          idArticulo: row.idArticulo,
          cantidad: row.cantidad ?? 0,
        }));
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaMatArticulo(row.id, {
          idMatDetalle: realId,
          idArticulo: row.idArticulo,
          cantidad: row.cantidad ?? 0,
        }));
        row.__modified = false;
      }
      this.sortRows();
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.notifyCount();
    } catch (e) {
      console.error('Error guardando artículos:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', this.rowData);
    this.addAutoRow();
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaMatArticulo(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      this.selectedRow = null;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.notifyCount();
    } catch (e) {
      console.error('Error eliminando artículo:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }

  private sortRows() {
    this.rowData.sort((a: any, b: any) => {
      const na = this.articuloOptions.find(o => o.id === a.idArticulo)?.name ?? '';
      const nb = this.articuloOptions.find(o => o.id === b.idArticulo)?.name ?? '';
      return na.localeCompare(nb, 'es', { sensitivity: 'base' });
    });
  }

  private notifyCount() {
    const saved = this.rowData.filter(r => !r.__isNew);
    const savedCount = saved.length;
    const cantidadSum = saved.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
    this.internalParams?.context?.onArticuloCountChanged?.(this.idMatDetalle, savedCount, cantidadSum);
  }
}
