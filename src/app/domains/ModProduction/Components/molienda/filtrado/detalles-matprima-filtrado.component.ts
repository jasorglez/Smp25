import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SignalsService } from 'app/services/signals.service';
import { DetallesArticuloFiltradoComponent } from './detalles-articulo-filtrado.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalles-matprima-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #f3f0ff;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #4a148c;">Detalle de Materia Prima</strong>
        <div class="d-flex gap-1">
          <button class="btn btn-success" (click)="addRow()" [disabled]="!gridApi" title="Agregar">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasChanges && !hasChildChanges()" title="Guardar cambios">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasChanges || hasChildChanges()"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
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
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; position: relative; }
    :host ::ng-deep .fully-bote-assigned { background: #dee2e6 !important; color: #6c757d !important; }
    :host ::ng-deep .fully-bote-assigned .ag-cell { color: #6c757d !important; }
  `]
})
export class DetallesMatprimaFiltradoComponent {
  private productionService = inject(ProductionService);
  private signalsService = inject(SignalsService);


  private internalParams: any;
  private idMolienda: number | null = null;
  private idMatPrimaMolienda: number | null = null;
  private articuloOptions: { id: number; name: string }[] = [];
  private originalRowData: any[] = [];

  private activeExpandedNodeId: string | null = null;

  gridApi!: GridApi;
  rowData: any[] = [];
  hasChanges = false;
  selectedRow: any = null;

  colDefs: ColDef[] = [
    {
      field: 'fechaMolienda',
      headerName: 'Fecha molienda',
      editable: true,
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
      valueSetter: (p: any) => {
        let val = p.newValue;
        if (val instanceof Date) {
          val = `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
        } else if (typeof val === 'string' && val.includes('T')) {
          val = val.substring(0, 10);
        }
        p.data.fechaMolienda = val;
        p.data.__modified = true;
        this.hasChanges = true;
        return true;
      },
    },
    {
      field: 'usuario',
      headerName: 'Usuario',
      editable: false,
      cellStyle: { backgroundColor: '#f0f0f0', color: '#6c757d' },
    },
    {
      field: 'idMatPrima',
      headerName: 'Materia Prima',
      editable: false,
      cellStyle: { cursor: 'pointer' },
      cellRenderer: (params: any) => {
        const count = params.data?.articuloCount ?? 0;
        const link = `color:#4a148c; text-decoration:underline; cursor:pointer;`;
        return `<span style="${link}">${count}</span>`;
      },
      onCellClicked: (event: any) => this.toggleArticuloDetail(event.node),
    },
    {
      field: 'jugo',
      headerName: 'Jugo',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '',
      valueSetter: (p: any) => {
        p.data.jugo = p.newValue;
        p.data.rendimiento = this.calcRendimiento(p.newValue, p.data.cantidadSum ?? 0);
        p.data.__modified = true;
        this.hasChanges = true;
        return true;
      },
    },
    {
      field: 'rendimiento',
      headerName: '% Rendimiento',
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057' },
      valueFormatter: (p: any) => {
        if (p.value == null) return 'N/A';
        return `${Number(p.value).toFixed(2)}%`;
      },
    },
  ];

  gridOptions: any = {
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 22,
    rowSelection: 'single',
    autoSizeStrategy: { type: 'fitCellContents' },
    rowClassRules: {
      'new-row-highlight':    (p: any) => !!p.data?.__isNew,
      'fully-bote-assigned':  (p: any) => !p.data?.__isNew
                                         && p.data?.jugo != null
                                         && p.data?.boteAsignado >= p.data?.jugo,
    },
    defaultColDef: { resizable: true, sortable: true },
    postSortRows: (params: any) => {
      const rows: any[] = params.nodes;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].data?.__isNew) rows.unshift(rows.splice(i, 1)[0]);
      }
    },
    masterDetail: true,
    detailRowHeight: Math.max(100, Math.max(200, window.innerHeight * 0.8 - 45) - 102),
    isRowMaster: () => true,
    detailCellRenderer: DetallesArticuloFiltradoComponent,
    detailCellRendererParams: () => ({
      context: {
        articuloOptions: this.articuloOptions,
        idMatPrimaParent: this.idMatPrimaMolienda,
        onArticuloCountChanged: (idMatDetalle: number, count: number, cantidadSum: number) =>
          this.onArticuloCountChanged(idMatDetalle, count, cantidadSum),
      },
    }),
  };

  agInit(params: any) {
    this.internalParams = params;
    this.idMolienda = params?.data?.id ?? null;
    this.idMatPrimaMolienda = params?.data?.matPrima ?? null;
    this.articuloOptions = params?.context?.articuloOptions ?? [];
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  onSelectionChanged(event: any) {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }


  private openDetailNode(node: any) {
    this.gridApi.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    this.activeExpandedNodeId = node.id;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  toggleArticuloDetail(node: any) {
    if (this.activeExpandedNodeId === node.id) {
      node.setExpanded(false);
      this.activeExpandedNodeId = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }

    if (this.activeExpandedNodeId) {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === this.activeExpandedNodeId) n.setExpanded(false);
        n.setRowHeight(undefined);
      });
    }

    this.gridApi.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    this.activeExpandedNodeId = node.id;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  async loadData() {
    if (!this.idMolienda) { this.rowData = []; return; }
    try {
      const [items, counts, sums, boteSums] = await Promise.all([
        lastValueFrom(this.productionService.getMoliendaMatDetalleByMolienda(this.idMolienda)),
        lastValueFrom(this.productionService.getMoliendaMatArticuloCountsByMolienda(this.idMolienda)),
        lastValueFrom(this.productionService.getMoliendaMatArticuloSumsByMolienda(this.idMolienda)),
        lastValueFrom(this.productionService.getMoliendaBoteSumsByMolienda(this.idMolienda)),
      ]);
      const mapped = (Array.isArray(items) ? items : []).map(i => {
        const cantidadSum = (sums as Record<number, number>)[i.id] ?? 0;
        const boteAsignado = (boteSums as Record<number, number>)[i.id] ?? 0;
        const row = { ...this.mapRow(i), articuloCount: (counts as Record<number, number>)[i.id] ?? 0, cantidadSum, boteAsignado };
        row.rendimiento = this.calcRendimiento(row.jugo, cantidadSum);
        return row;
      });
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = mapped;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', mapped);
      this.notifyParentHasDetail(mapped.length > 0);
    } catch (e) {
      console.error('Error cargando detalle matprima:', e);
    }
  }

  private mapRow(i: any): any {
    return {
      id: i.id,
      idMolienda: i.idMolienda,
      fechaMolienda: i.fechaMolienda ? String(i.fechaMolienda).split('T')[0] : null,
      usuario: i.usuario ?? '',
      idMatPrima: i.idMatPrima ?? null,
      jugo: i.jugo ?? null,
      rendimiento: i.rendimiento ?? null,
      __isNew: false,
      __modified: false,
    };
  }

  private toPayload(row: any) {
    return {
      idMolienda: this.idMolienda,
      fechaMolienda: row.fechaMolienda || null,
      usuario: row.usuario || null,
      idMatPrima: row.idMatPrima ?? null,
      jugo: row.jugo ?? null,
      rendimiento: row.rendimiento ?? null,
    };
  }

  addRow() {
    const today = new Date().toISOString().substring(0, 10);
    const usuario = this.signalsService.getDisplayName()() ?? '';
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true,
      idMolienda: this.idMolienda,
      fechaMolienda: today,
      usuario,
      idMatPrima: null,
      jugo: null,
      rendimiento: null,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fechaMolienda' }), 80);
    }
  }

  hasChildChanges(): boolean {
    return this.rowData.some(r => {
      const fn = r.__articuloHasChanges;
      return fn ? fn() : !!r.__pendingArticulosDirty;
    });
  }

  async saveChanges() {
    // Discard empty rows (auto-inserted but jugo never filled)
    this.rowData = this.rowData.filter(r => !(r.__isNew && r.jugo == null));
    const newRows = this.rowData.filter(r => r.__isNew);
    const modRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modRows.length && !this.hasChildChanges()) return;
    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.productionService.createMoliendaMatDetalle(this.toPayload(row)));
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaMatDetalle(row.id, this.toPayload(row)));
        row.__modified = false;
      }
      this.hasChanges = false;

      // Save all child article grids (expanded or collapsed)
      for (const row of this.rowData) {
        const hasChanges = row.__articuloHasChanges ? row.__articuloHasChanges() : !!row.__pendingArticulosDirty;
        if (hasChanges && row.__articuloSave) await row.__articuloSave();
      }

      alerts.reqSuccessToast('Guardado');
      const expandedId = this.activeExpandedNodeId;
      await this.loadData();
      if (expandedId && this.gridApi && !this.gridApi.isDestroyed()) {
        setTimeout(() => {
          const node = this.gridApi.getRowNode(expandedId);
          if (node) this.openDetailNode(node);
        }, 50);
      }
    } catch (e) {
      console.error('Error guardando detalle matprima:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    // Clear child cached state before replacing rowData
    this.rowData.forEach(r => {
      r.__pendingArticulos = undefined;
      r.__pendingArticulosDirty = false;
      r.__articuloHasChanges = undefined;
      r.__articuloSave = undefined;
    });
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    this.activeExpandedNodeId = null;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.forEachNode((n: any) => { n.setExpanded(false); n.setRowHeight(undefined); });
      this.gridApi.onRowHeightChanged();
      this.gridApi.setGridOption('rowData', this.rowData);
    }
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
      const node = this.gridApi?.getRowNode(String(this.selectedRow.id));
      if (node && this.activeExpandedNodeId === node.id) {
        node.setExpanded(false);
        this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
        this.activeExpandedNodeId = null;
      }
      await lastValueFrom(this.productionService.deleteMoliendaMatDetalle(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      this.selectedRow = null;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.notifyParentHasDetail(this.rowData.length > 0);
    } catch (e) {
      console.error('Error eliminando:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }

  private calcRendimiento(jugo: number | null, cantidadSum: number): number | null {
    if (jugo == null || cantidadSum <= 0) return null;
    return (jugo / cantidadSum) * 100;
  }

  onArticuloCountChanged(idMatDetalle: number, count: number, cantidadSum: number = 0) {
    const node = this.gridApi?.getRowNode(String(idMatDetalle));
    if (node) {
      node.data.articuloCount = count;
      node.data.cantidadSum = cantidadSum;
      node.data.rendimiento = this.calcRendimiento(node.data.jugo, cantidadSum);
      this.gridApi.refreshCells({ rowNodes: [node], columns: ['idMatPrima', 'rendimiento'], force: true });
    }
  }

  private notifyParentHasDetail(hasDetail: boolean) {
    this.internalParams?.context?.onMatDetailChanged?.(this.idMolienda, hasDetail);
  }
}
