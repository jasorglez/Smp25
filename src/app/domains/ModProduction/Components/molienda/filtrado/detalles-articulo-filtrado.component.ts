import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SalidasMpService } from 'app/services/salidas-mp.service';
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
  private salidasService = inject(SalidasMpService);

  private internalParams: any;
  private idMatDetalle: number | null = null;
  private articuloOptions: { id: number; name: string; cantidad?: number }[] = [];
  private allArticuloOptions: { id: number; name: string }[] = [];
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
      // Ya NO es dropdown: abre el MODAL de salida por lote (FEFO). Espejo.
      editable: false,
      cellStyle: { cursor: 'pointer', color: '#0d47a1', textDecoration: 'underline' },
      valueFormatter: (p: any) => this.allArticuloOptions.find(a => a.id === p.value)?.name ?? (p.value ? '' : 'Elegir…'),
      onCellClicked: (p: any) => this.abrirModalSalida(p.data),
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 110,
      // Espejo: se llena desde el modal (suma de lo tomado por lote). No editable.
      editable: false,
      valueFormatter: (p: any) => p.value != null ? String(Number(p.value)) : '',
      cellStyle: { backgroundColor: '#f5f5f5', color: '#37474f' },
    },
  ];

  /** Abre el modal de salida por lote para esta fila (vía context, hosteado en molienda.component). */
  private async abrirModalSalida(row: any) {
    const openSalidaModal = this.internalParams?.context?.openSalidaModal;
    const idSucursal = this.internalParams?.context?.idSucursal;
    if (!openSalidaModal || !idSucursal) {
      alerts.reqErrorToast('No se pudo abrir el selector de lotes (falta sucursal).');
      return;
    }
    this.selectedRow = row;
    const usados = new Set(this.rowData.filter(r => r !== row).map((r: any) => r.idArticulo).filter(Boolean));
    const opciones = this.articuloOptions.filter(a => !usados.has(a.id) && a.id !== this.idMatPrimaParent);

    // Cargar salidas previas si la fila ya está guardada (para modo edición).
    let salidasPrevias: { [idDatoExterno: number]: number } = {};
    if (row.id) {
      try {
        const previas = await lastValueFrom(this.salidasService.getByOrigen('MOLIENDA', row.id)).catch(() => []);
        for (const s of (Array.isArray(previas) ? previas : [])) {
          salidasPrevias[s.idDatoExterno] = (salidasPrevias[s.idDatoExterno] ?? 0) + s.cantidad;
        }
      } catch { /* si falla, abre sin pre-llenar */ }
    }

    openSalidaModal({
      articuloOptions: opciones,
      idSucursal,
      idArticuloActual: row.idArticulo ?? null,
      salidasPrevias,
      empleadoActual: row.__empleadoSalida ?? this.rowData.find(r => r !== row && r.__empleadoSalida)?.__empleadoSalida ?? null,
      onResolve: (res: { idArticulo: number; cantidad: number; empleado: string; lotes: any[] }) => this.aplicarSalida(row, res),
    });
  }

  /** Pega artículo + cantidad (espejo) y guarda el reparto por lote para persistir en salidas_mp. */
  private aplicarSalida(row: any, res: { idArticulo: number; cantidad: number; empleado: string; lotes: any[] }) {
    const eraNuevoVacio = row.__isNew && row.idArticulo == null;
    row.idArticulo = res.idArticulo;
    row.cantidad = res.cantidad;
    row.__salidasLotes = res.lotes;   // [{ idDatoExterno, cantidad }] → Fase 3 guarda en salidas_mp
    row.__empleadoSalida = res.empleado;
    row.__modified = true;
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.refreshCells({ force: true });
    }
    if (eraNuevoVacio) setTimeout(() => this.addAutoRow(false), 0);
  }

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
    this.allArticuloOptions = params?.context?.allArticuloOptions ?? this.articuloOptions;
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
    const salidasSvc = this.salidasService;
    const idMatDetalle = this.idMatDetalle;
    const cachedRows: any[] = data.__pendingArticulos;
    const onCountChanged = this.internalParams?.context?.onArticuloCountChanged;
    const usuarioCtx = this.internalParams?.data?.usuario ?? '';
    const fechaCtx = this.internalParams?.data?.fechaMolienda ?? null;

    // Guarda el reparto por lote en salidas_mp (reemplaza las previas del artículo-molienda).
    const persistSalidasOffline = async (row: any) => {
      const idOrigen = row.id;
      const lotes = Array.isArray(row.__salidasLotes) ? row.__salidasLotes : null;
      if (!idOrigen || !lotes) return;
      try {
        const previas: any = await lastValueFrom(salidasSvc.getByOrigen('MOLIENDA', idOrigen)).catch(() => []);
        await Promise.all((Array.isArray(previas) ? previas : []).map((s: any) => lastValueFrom(salidasSvc.delete(s.id))));
        for (const l of lotes) {
          await lastValueFrom(salidasSvc.create({
            idDatoExterno: l.idDatoExterno, idMaterial: row.idArticulo, cantidad: l.cantidad,
            fecha: fechaCtx, usuario: usuarioCtx, idOrigen, tipoOrigen: 'MOLIENDA',
          }));
        }
      } catch (e) { console.error('Error guardando salidas MP (offline):', e); }
    };

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
        await persistSalidasOffline(row);
      }
      for (const row of modRows) {
        await lastValueFrom(productionSvc.updateMoliendaMatArticulo(row.id, {
          idMatDetalle: realIdMatDetalle, idArticulo: row.idArticulo, cantidad: row.cantidad ?? 0,
        }));
        row.__modified = false;
        await persistSalidasOffline(row);
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
      const mapped = await Promise.all((Array.isArray(items) ? items : []).map(async (i: any) => {
        const row: any = {
          id: i.id,
          idMatDetalle: i.idMatDetalle,
          idArticulo: i.idArticulo ?? null,
          cantidad: i.cantidad ?? 0,
          __isNew: false,
          __modified: false,
        };
        try {
          const salidas: any = await lastValueFrom(this.salidasService.getByOrigen('MOLIENDA', i.id)).catch(() => []);
          const arr = Array.isArray(salidas) ? salidas : [];
          if (arr.length) {
            row.__empleadoSalida = arr[0].usuario ?? null;
            row.__salidasLotes = arr.map((s: any) => ({ idDatoExterno: s.idDatoExterno, cantidad: s.cantidad }));
          }
        } catch { /* si falla, abre sin pre-llenar empleado */ }
        return row;
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
        await this.persistSalidas(row);
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaMatArticulo(row.id, {
          idMatDetalle: realId,
          idArticulo: row.idArticulo,
          cantidad: row.cantidad ?? 0,
        }));
        row.__modified = false;
        await this.persistSalidas(row);
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

  /** Persiste el reparto por lote en salidas_mp (reemplaza las previas de este artículo-molienda). */
  private async persistSalidas(row: any) {
    const idOrigen = row.id;
    const lotes = Array.isArray(row.__salidasLotes) ? row.__salidasLotes : null;
    if (!idOrigen || !lotes) return;   // fila sin reparto (vieja) → no tocar salidas
    try {
      const previas: any = await lastValueFrom(this.salidasService.getByOrigen('MOLIENDA', idOrigen)).catch(() => []);
      await Promise.all((Array.isArray(previas) ? previas : []).map((s: any) =>
        lastValueFrom(this.salidasService.delete(s.id))));
      const usuario = row.__empleadoSalida ?? this.internalParams?.data?.usuario ?? '';
      const fecha = new Date().toISOString().split('T')[0];
      for (const l of lotes) {
        await lastValueFrom(this.salidasService.create({
          idDatoExterno: l.idDatoExterno, idMaterial: row.idArticulo, cantidad: l.cantidad,
          fecha, usuario, idOrigen, tipoOrigen: 'MOLIENDA',
        }));
      }
    } catch (e) {
      console.error('Error guardando salidas MP:', e);
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
      const na = this.allArticuloOptions.find(o => o.id === a.idArticulo)?.name ?? '';
      const nb = this.allArticuloOptions.find(o => o.id === b.idArticulo)?.name ?? '';
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
