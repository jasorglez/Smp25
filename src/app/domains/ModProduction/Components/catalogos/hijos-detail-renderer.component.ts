import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-community';
import { CatalogProductionService, CatalogProductionItem } from '../../../../services/catalog-production.service';
import { SignalsService } from '../../../../services/signals.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-hijos-detail-renderer',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding:6px 10px 8px 10px; background:#eef3fb; border-left:4px solid #4a90d9;">
      <div class="d-flex justify-content-end gap-1 mb-1">
        <button class="btn btn-sm btn-success" (click)="addRow()" title="Agregar">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button class="btn btn-sm btn-primary position-relative" (click)="save()"
                [disabled]="!hasChanges" title="Guardar">
          <i class="bi bi-floppy"></i>
          <span *ngIf="hasChanges"
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
          </span>
        </button>
        <button class="btn btn-sm btn-warning" (click)="revert()" title="Deshacer">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button class="btn btn-sm btn-danger" (click)="deleteRow()"
                [disabled]="!selected" title="Borrar">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (rowClicked)="onRowClicked($event)"
        style="width:100%;">
      </ag-grid-angular>
    </div>
  `
})
export class HijosDetailRendererComponent implements ICellRendererAngularComp {
  private catalogService = inject(CatalogProductionService);
  private signalsService = inject(SignalsService);

  private params: any;
  rowData: CatalogProductionItem[] = [];
  private original: CatalogProductionItem[] = [];
  selected: CatalogProductionItem | null = null;
  hasChanges = false;
  private gridApi!: GridApi;
  private tempId = 0;

  readonly colDefs: ColDef[] = [
    {
      field: 'description',
      headerName: 'Grupo',
      flex: 1,
      editable: true,
      valueSetter: (p: any) => {
        p.data.description = (p.newValue || '').toUpperCase();
        p.data.__modified = true;
        this.hasChanges = true;
        return true;
      }
    }
  ];

  readonly gridOptions: any = {
    headerHeight: 28,
    rowHeight: 28,
    rowSelection: 'single',
    domLayout: 'autoHeight',
    animateRows: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew }
  };

  agInit(params: any): void {
    this.params = params;
    this.load();
  }

  refresh(): boolean { return false; }

  private get idRoot(): number {
    return this.signalsService.getRootSelectedBySidebar()() ?? 0;
  }

  load(): void {
    const idPadre = this.params?.data?.id;
    if (!idPadre || !this.idRoot) return;
    this.catalogService.getAll(this.idRoot, idPadre).subscribe({
      next: (items) => {
        this.rowData = (items ?? []).map(i => ({ ...i, __isNew: false, __modified: false }));
        this.original = JSON.parse(JSON.stringify(this.rowData));
        this.hasChanges = false;
        if (this.gridApi && !this.gridApi.isDestroyed())
          this.gridApi.setGridOption('rowData', this.rowData);
      },
      error: () => { this.rowData = []; }
    });
  }

  onGridReady(event: any): void {
    this.gridApi = event.api;
  }

  onRowClicked(event: any): void {
    this.selected = event.data;
    if (this.params?.onHijoSelected) this.params.onHijoSelected(event.data);
  }

  addRow(): void {
    const newRow: CatalogProductionItem & { _tempId?: string } = {
      description: '',
      idCompany: this.idRoot,
      idMasterCatalog: this.params?.data?.id,
      type: 'CATALOGO',
      active: 1,
      vigente: true,
      __isNew: true,
      __modified: false,
      _tempId: `tmp_${this.tempId++}`
    };
    this.rowData = [...this.rowData, newRow];
    this.hasChanges = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: this.rowData.length - 1, colKey: 'description' });
      }, 50);
    }
  }

  async save(): Promise<void> {
    const toCreate = this.rowData.filter(r => r.__isNew && r.description?.trim());
    const toUpdate = this.rowData.filter(r => !r.__isNew && r.__modified && r.id);
    try {
      await Promise.all([
        ...toCreate.map(r => lastValueFrom(this.catalogService.create({
          description: r.description.trim().toUpperCase(),
          idCompany: this.idRoot,
          idMasterCatalog: this.params.data.id,
          type: 'CATALOGO',
          active: 1,
          vigente: true
        }))),
        ...toUpdate.map(r => lastValueFrom(this.catalogService.update(r.id!, {
          description: r.description.trim().toUpperCase(),
          idCompany: this.idRoot,
          idMasterCatalog: this.params.data.id,
          type: 'CATALOGO'
        })))
      ]);
      this.load();
    } catch (e) {
      console.error('[HijosDetail] Error al guardar:', e);
    }
  }

  revert(): void {
    this.rowData = JSON.parse(JSON.stringify(this.original));
    this.hasChanges = false;
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow(): Promise<void> {
    if (!this.selected) return;
    if ((this.selected as any).__isNew) {
      const tid = (this.selected as any)._tempId;
      this.rowData = this.rowData.filter((r: any) => r._tempId !== tid);
      this.selected = null;
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.catalogService.delete(this.selected.id!));
      this.selected = null;
      if (this.params?.onHijoSelected) this.params.onHijoSelected(null);
      this.load();
    } catch (e) {
      console.error('[HijosDetail] Error al borrar:', e);
    }
  }
}
