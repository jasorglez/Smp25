import { Component, effect, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { ProductionService } from '../../../../../services/production.service';
import { SignalsService } from '../../../../../services/signals.service';
import { OhBloqueDetailComponent } from './oh-bloque-detail.component';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-oh-bloque',
  standalone: true,
  imports: [CommonModule, AgGridAngular, OhBloqueDetailComponent],
  template: `
    <div class="col-12">
      <div class="row g-2">
        <div class="col-auto">
          <div class="d-flex flex-column gap-1">
            <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="save()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i>
              <span *ngIf="hasChanges"
                    class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
              </span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="revert()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-sm btn-danger" (click)="delete()" [disabled]="!selectedRow">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="col">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            style="width:100%; height:80vh;"
            [rowData]="rows"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            (gridReady)="onGridReady($event)"
            (selectionChanged)="onSelectionChanged($event)"
            (cellValueChanged)="onCellChanged($event)">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
})
export class OhBloqueComponent {
  private productionService = inject(ProductionService);
  private signalsService    = inject(SignalsService);
  private readonly cdr      = inject(ChangeDetectorRef);

  gridApi!: GridApi;
  rows: any[] = [];
  private original: any[] = [];
  hasChanges = false;
  selectedRow: any = null;
  idCompany = 0;

  private bloqueOptions: { id: number; bloque: string; productoIds: number[] }[] = [];
  private productosOptions: { id: number; producto: string; categoria: string }[] = [];
  private activeExpandedNodeId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) {
        this.idCompany = id;
        this.loadBloques().then(() => this.loadData());
      }
    });
  }

  readonly colDefs: ColDef[] = [
    {
      field: 'fecha', headerName: 'Fecha', width: 160, editable: true,
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = new Date(p.value);
        return isNaN(d.getTime()) ? p.value : d.toLocaleDateString('es-MX');
      },
      valueSetter: (p: any) => { p.data.fecha = p.newValue; p.data.__modified = true; return true; },
    },
    {
      field: 'bloques',
      headerName: 'Bloques',
      flex: 1,
      editable: false,
      cellStyle: (p: any) => p.data?.__isNew ? {} : { cursor: 'pointer', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: '600' },
      cellRenderer: (p: any) => {
        if (p.data?.__isNew) return '';
        try {
          const items = JSON.parse(p.data?.bloqueIds ?? '[]') as { bloque: string; enabled: boolean }[];
          const enabled = items.filter(r => r.enabled).map(r => r.bloque);
          return enabled.length ? enabled.join(', ') : '<span style="color:#999;font-weight:400">Click para configurar</span>';
        } catch { return '<span style="color:#999;font-weight:400">Click para configurar</span>'; }
      },
      onCellClicked: (event: any) => {
        if (!event.data?.__isNew) this.toggleDetail(event.node);
      },
    },
  ];

  readonly gridOptions: any = {
    getRowId: (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight: 25, rowHeight: 22,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    masterDetail: true,
    detailRowHeight: Math.max(200, window.innerHeight * 0.8 - 25 - 22),
    isRowMaster: (data: any) => data?.id != null || data?.__isNew === false,
    detailCellRenderer: OhBloqueDetailComponent,
    detailCellRendererParams: () => ({
      context: {
        bloqueOptions: this.bloqueOptions,
        productosOptions: this.productosOptions,
        onBloqueChanged: (id: number, tempId: any, json: string) => this.onBloqueChanged(id, tempId, json),
      },
    }),
  };

  private toggleDetail(node: any) {
    if (this.activeExpandedNodeId === node.id) {
      node.setExpanded(false);
      this.activeExpandedNodeId = null;
      this.gridApi.forEachNode(n => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }
    this.collapseActive();
    this.gridApi.forEachNode(n => { if (n.id !== node.id) n.setRowHeight(0); });
    this.activeExpandedNodeId = node.id;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  private collapseActive() {
    if (!this.activeExpandedNodeId) return;
    const prevId = this.activeExpandedNodeId;
    this.gridApi.forEachNode(n => {
      if (n.id === prevId) n.setExpanded(false);
      n.setRowHeight(undefined);
    });
    this.activeExpandedNodeId = null;
    this.gridApi.onRowHeightChanged();
  }

  onBloqueChanged(id: number, tempId: any, json: string) {
    const row = this.rows.find(r => (id && r.id === id) || (tempId && r.__tempId === tempId));
    if (!row) return;
    row.bloqueIds = json;
    row.__modified = true;
    this.hasChanges = true;
    const node = this.gridApi.getRowNode(String(id ?? tempId));
    if (node) this.gridApi.refreshCells({ rowNodes: [node], columns: ['bloques'], force: true });
    this.collapseActive();
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.gridApi.setGridOption('rowData', this.rows);
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellChanged(e: any) { e.data.__modified = true; this.hasChanges = true; }

  private async loadBloques() {
    if (!this.idCompany) return;
    const [bloques, productos] = await Promise.all([
      lastValueFrom(this.productionService.getMoliendaBloqueEFByCompany(this.idCompany)),
      lastValueFrom(this.productionService.getProductosTerminadosEF(this.idCompany)),
    ]);
    this.bloqueOptions = (bloques ?? []).map((b: any) => ({
      id: b.id,
      bloque: b.bloque,
      productoIds: (() => { try { return JSON.parse(b.productoIds ?? '[]'); } catch { return []; } })(),
    }));
    this.productosOptions = productos ?? [];
  }

  private async loadData() {
    if (!this.idCompany) return;
    const data = await lastValueFrom(this.productionService.getOhBloqueByCompany(this.idCompany));
    this.original = JSON.parse(JSON.stringify(data ?? []));
    this.rows = (data ?? []).map((r: any) => ({ ...r, __isNew: false, __modified: false }));
    this.gridApi?.setGridOption('rowData', this.rows);
    this.cdr.detectChanges();
  }

  add() {
    const newRow = { __tempId: Date.now(), __isNew: true, idCompany: this.idCompany, fecha: new Date().toISOString().slice(0, 10), bloqueIds: null, active: true };
    this.rows = [newRow, ...this.rows];
    this.hasChanges = true;
    this.gridApi.setGridOption('rowData', this.rows);
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fecha' }), 50);
  }

  async save() {
    const newRows = this.rows.filter(r => r.__isNew);
    const modRows = this.rows.filter(r => r.__modified && !r.__isNew && r.id);
    await Promise.all([
      ...newRows.map(r => lastValueFrom(this.productionService.createOhBloque({ idCompany: r.idCompany, fecha: r.fecha, bloqueIds: r.bloqueIds, active: true }))),
      ...modRows.map(r => lastValueFrom(this.productionService.updateOhBloque(r.id, { fecha: r.fecha, bloqueIds: r.bloqueIds }))),
    ]);
    await this.loadData();
    this.hasChanges = false;
  }

  revert() {
    this.rows = JSON.parse(JSON.stringify(this.original));
    this.hasChanges = false;
    this.selectedRow = null;
    this.collapseActive();
    this.gridApi.setGridOption('rowData', this.rows);
  }

  async delete() {
    const row = this.selectedRow;
    if (!row) return;
    if (row.__isNew) {
      this.rows = this.rows.filter(r => r !== row);
    } else {
      await lastValueFrom(this.productionService.deleteOhBloque(row.id));
      this.rows = this.rows.filter(r => r.id !== row.id);
      this.original = this.original.filter(r => r.id !== row.id);
    }
    this.selectedRow = null;
    this.hasChanges = this.rows.some(r => r.__isNew || r.__modified);
    this.collapseActive();
    this.gridApi.setGridOption('rowData', this.rows);
  }
}
