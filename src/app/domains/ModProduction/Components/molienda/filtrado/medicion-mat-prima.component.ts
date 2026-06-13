import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SalidasMpService } from 'app/services/salidas-mp.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-medicion-mat-prima',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  styles: [':host { display:block; height:100%; }'],
  template: `
    <div style="height:100%;display:flex;flex-direction:column;background:#e8f5e9;border-top:2px solid #a5d6a7;">
      <div style="padding:3px 8px;flex-shrink:0;border-bottom:1px solid #a5d6a7;display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.75rem;color:#2e7d32;font-weight:600;flex:1;">
          <i class="bi bi-boxes me-1"></i>Materias primas
        </span>
        <button class="btn btn-sm btn-outline-secondary" style="padding:1px 7px;font-size:0.73rem;"
                (click)="reloadData()">
          <i class="bi bi-arrow-clockwise"></i> Refrescar
        </button>
        <button class="btn btn-sm btn-danger" style="padding:1px 7px;font-size:0.73rem;"
                (click)="deleteRow()" [disabled]="!selectedRow">
          <i class="bi bi-trash"></i> Borrar
        </button>
      </div>
      <div style="flex:1 1 auto;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz"
          style="width:100%;height:100%;"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged()">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class MedicionMatPrimaComponent implements ICellRendererAngularComp {
  private productionService = inject(ProductionService);
  private salidasService = inject(SalidasMpService);

  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  private _hasChanges = false;
  selectedRow: any = null;

  private idMedicion: number | null = null;
  private internalParams: any = null;
  private matPrimaOptions: { id: number; name: string }[] = [];
  private idMatPrimaParent: number | null = null;
  private onCountChanged: ((id: number, count: number) => void) | null = null;
  private openSalidaModal: ((p: any) => void) | null = null;
  private idSucursal: number | null = null;
  private articuloOptionsFiltered: { id: number; name: string; cantidad?: number }[] = [];
  private readonly EXTRACCION_FERMENTACION_DEPT_ID = 62;

  colDefs: ColDef[] = [];

  get hasChanges() { return this._hasChanges; }
  set hasChanges(v: boolean) {
    this._hasChanges = v;
    if (this.internalParams?.data) this.internalParams.data.__matPrimaHasDirty = v;
  }

  gridOptions: any = {
    getRowId:                      (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight:                  22,
    rowHeight:                     22,
    rowSelection:                  'single',
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  agInit(params: any): void {
    this.internalParams    = params;
    this.idMedicion        = params.data?.id ?? null;
    this.matPrimaOptions   = params.context?.allArticuloOptions ?? params.context?.matPrimaOptions ?? [];
    this.idMatPrimaParent  = params.context?.idArticulo ?? null;
    this.onCountChanged    = params.context?.onMatPrimaCountChanged ?? null;
    this.openSalidaModal         = params.context?.openSalidaModal ?? null;
    this.idSucursal              = params.context?.idSucursal ?? null;
    this.articuloOptionsFiltered = params.context?.articuloOptions ?? [];

    // Registrar callbacks en el row para que el padre los llame al guardar
    if (params.data) {
      params.data.__matPrimaHasChanges = () => this._hasChanges;
      params.data.__matPrimaSave       = () => this.saveChanges();
    }

    this.buildColDefs();
    if (this.idMedicion) this.loadData();
  }

  refresh(): boolean { return false; }

  private buildColDefs() {
    this.colDefs = [
      {
        field: 'idMatPrima',
        headerName: 'Materia Prima',
        editable: false,
        flex: 1,
        cellStyle: { cursor: 'pointer', color: '#0d47a1', textDecoration: 'underline' },
        valueFormatter: (p: any) =>
          p.value == null
            ? 'Elegir…'
            : (this.matPrimaOptions.find(m => m.id === p.value)?.name ?? String(p.value)),
        onCellClicked: (p: any) => this.abrirModalSalida(p.data),
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        editable: false,
        width: 120,
        // Espejo: se llena desde el modal (suma de lo tomado por lote). No editable.
        cellStyle: { backgroundColor: '#f5f5f5', color: '#37474f' },
        valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(4) : '',
      },
    ];
  }

  private async abrirModalSalida(row: any) {
    if (!this.openSalidaModal || !this.idSucursal) {
      alerts.reqErrorToast('No se pudo abrir el selector de lotes (falta sucursal).');
      return;
    }
    this.selectedRow = row;
    const usadas = new Set(this.rowData.filter(r => r !== row).map((r: any) => r.idMatPrima).filter(Boolean));
    // Usar articuloOptionsFiltered: active=1 en Vista EyF + inventario > 0 en sucursal
    const opciones = this.articuloOptionsFiltered
      .filter(m => !usadas.has(m.id) && m.id !== this.idMatPrimaParent)
      .map(m => ({ id: m.id, name: m.name, cantidad: (m as any).cantidad }));

    // Cargar salidas previas si la fila ya está guardada (modo edición).
    let salidasPrevias: { [idDatoExterno: number]: number } = {};
    if (row.id) {
      try {
        const previas = await lastValueFrom(this.salidasService.getByOrigen('MOLIENDA', row.id)).catch(() => []);
        for (const s of (Array.isArray(previas) ? previas : [])) {
          salidasPrevias[s.idDatoExterno] = (salidasPrevias[s.idDatoExterno] ?? 0) + s.cantidad;
        }
      } catch { /* si falla, abre sin pre-llenar */ }
    }

    this.openSalidaModal({
      articuloOptions: opciones,
      idSucursal: this.idSucursal,
      idArticuloActual: row.idMatPrima ?? null,
      salidasPrevias,
      onResolve: (res: { idArticulo: number; cantidad: number; empleado: string; lotes: any[] }) =>
        this.aplicarSalida(row, res),
    });
  }

  private aplicarSalida(row: any, res: { idArticulo: number; cantidad: number; empleado: string; lotes: any[] }) {
    const eraNuevoVacio = row.__isNew && row.idMatPrima == null;
    row.idMatPrima = res.idArticulo;
    row.cantidad   = res.cantidad;
    row.__salidasLotes = res.lotes;
    row.__empleadoSalida = res.empleado;
    row.__modified = true;
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.refreshCells({ force: true });
    if (eraNuevoVacio) setTimeout(() => this.addAutoRow(false), 0);
  }

  private async persistSalidas(row: any) {
    const idOrigen = row.id;
    const lotes = Array.isArray(row.__salidasLotes) ? row.__salidasLotes : null;
    if (!idOrigen || !lotes) return;
    try {
      const previas: any = await lastValueFrom(this.salidasService.getByOrigen('MOLIENDA', idOrigen)).catch(() => []);
      await Promise.all((Array.isArray(previas) ? previas : []).map((s: any) =>
        lastValueFrom(this.salidasService.delete(s.id))));
      const usuario = row.__empleadoSalida ?? '';
      const fecha = new Date().toISOString().split('T')[0];
      for (const l of lotes) {
        await lastValueFrom(this.salidasService.create({
          idDatoExterno: l.idDatoExterno,
          idMaterial: row.idMatPrima,
          cantidad: l.cantidad,
          fecha,
          usuario,
          idOrigen,
          tipoOrigen: 'MOLIENDA',
        }));
      }
    } catch (e) {
      console.error('Error guardando salidas MP (medición):', e);
    }
  }

  private async loadData() {
    try {
      const items = await lastValueFrom(
        this.productionService.getMedicionMatPrimas(this.idMedicion!)
      ).catch(() => [] as any[]);
      const mapped = (items as any[]).map((i: any) => ({
        id: i.id, idMatPrima: i.idMatPrima, cantidad: i.cantidad,
        __isNew: false, __modified: false,
      }));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = [...mapped];
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.autoSizeAllColumns();
        this.addAutoRow();
      }
      this.onCountChanged?.(this.idMedicion!, mapped.length);
    } catch (e) {
      console.error('Error cargando mat prima:', e);
    }
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    if (this.rowData.length) this.gridApi.setGridOption('rowData', this.rowData);
    this.addAutoRow();
  }

  private addAutoRow(focusNew = true) {
    if (this.rowData.some(r => r.__isNew && !r.idMatPrima)) return;
    const blankRow = { id: null, __tempId: `new_${Date.now()}`, __isNew: true, __modified: false, idMatPrima: null, cantidad: null };
    this.rowData = [...this.rowData, blankRow];
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      if (focusNew) {
        const lastIdx = this.rowData.length - 1;
        setTimeout(() => this.gridApi.startEditingCell({ rowIndex: lastIdx, colKey: 'idMatPrima' }), 80);
      }
    }
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged() { this.hasChanges = true; }

  reloadData() {
    if (this.idMedicion) this.loadData();
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMedicionMatPrima(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow!.id);
      this.selectedRow = null;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.onCountChanged?.(this.idMedicion!, this.rowData.filter(r => !r.__isNew).length);
    } catch (e) {
      console.error('Error eliminando mat prima:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }

  async saveChanges() {
    if (!this.idMedicion) return;
    // Descartar filas en blanco (sin mat prima)
    this.rowData = this.rowData.filter(r => !(r.__isNew && !r.idMatPrima));
    try {
      for (const row of this.rowData.filter(r => r.__isNew && r.idMatPrima)) {
        const created = await lastValueFrom(this.productionService.createMedicionMatPrima({
          idMedicion: this.idMedicion!,
          idMatPrima: row.idMatPrima,
          cantidad:   row.cantidad ?? undefined,
        }));
        row.id = created.id; row.__isNew = false; row.__modified = false;
        await this.persistSalidas(row);
      }
      for (const row of this.rowData.filter(r => r.__modified && !r.__isNew && r.id)) {
        await lastValueFrom(this.productionService.updateMedicionMatPrima(row.id, {
          idMatPrima: row.idMatPrima,
          cantidad:   row.cantidad ?? undefined,
        }));
        row.__modified = false;
        await this.persistSalidas(row);
      }
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.onCountChanged?.(this.idMedicion!, this.rowData.length);
    } catch (e) {
      console.error('Error guardando mat prima:', e);
      alerts.reqErrorToast('Error al guardar mat prima');
      throw e;
    }
  }
}
