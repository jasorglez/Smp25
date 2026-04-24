import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { forkJoin } from 'rxjs';
import { CatalogsService } from '../../../../services/catalogs.service';
import { MaterialsService } from '../../../../services/materials.service';
import { MaterialXModuloService } from '../../../../services/materialxmodulo.service';
import { SignalsService } from '../../../../services/signals.service';

interface CatalogItem {
  id: number;
  description: string;
  valueAddition: string;
  parentId: number;
  children?: CatalogItem[];
}

@Component({
  selector: 'app-catalogosproduccion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div class="col-md-12">
      <div class="card mt-3">
        <div class="card-header p-2">
          <ul class="nav nav-pills nav-level-2">
            <li class="nav-item" *ngFor="let tab of tabs">
              <a class="nav-link" [class.active]="activeTab === tab.key"
                 (click)="activeTab = tab.key" style="cursor:pointer;">
                {{ tab.label }}
              </a>
            </li>
          </ul>
        </div>

        <div class="card-body">

          <!-- TAB MOLIENDA -->
          <ng-container *ngIf="activeTab === 'molienda'">

            <div class="col-md-6 mb-2">
              <select class="form-select form-select-sm w-auto"
                      [(ngModel)]="selectedType"
                      (ngModelChange)="onTypeChange($event)">
                <option value="">-- Selecciona proceso --</option>
                <optgroup *ngFor="let item of tree()" [label]="item.valueAddition">
                  <option [value]="item.valueAddition">{{ item.description }}</option>
                  <option *ngFor="let child of item.children" [value]="child.valueAddition">
                    {{ child.description }}
                  </option>
                </optgroup>
              </select>
            </div>

            <p class="text-muted" *ngIf="!selectedType">
              Selecciona un proceso para ver los materiales
            </p>

            <ng-container *ngIf="selectedType">

              <!-- BOTONES CRUD -->
              <div class="d-flex gap-2 mb-2 col-md-6">
                <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi">
                  <i class="bi bi-plus-lg"></i> Agregar
                </button>
                <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
                  <i class="bi bi-floppy"></i> Guardar
                  <span *ngIf="hasUnsavedChanges"
                        class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
                  </span>
                </button>
                <button class="btn btn-sm btn-warning" (click)="revertChanges()">
                  <i class="bi bi-arrow-clockwise"></i> Deshacer
                </button>
                <button class="btn btn-sm btn-danger" (click)="deleteRow()" [disabled]="!selectedRow">
                  <i class="bi bi-trash"></i> Borrar
                </button>
              </div>

              <!-- GRID -->
              <div class="col-md-6">
                <ag-grid-angular
                  class="ag-theme-quartz small-text-ag-grid"
                  [rowData]="rowData()"
                  [columnDefs]="columnDefs"
                  [gridOptions]="gridOptions"
                  (gridReady)="onGridReady($event)"
                  (cellValueChanged)="onCellValueChanged($event)"
                  (rowClicked)="onRowClicked($event)"
                  (cellEditingStopped)="onCellEditingStopped($event)"
                  style="height: 300px; width: 100%;">
                </ag-grid-angular>
              </div>

            </ng-container>

          </ng-container>

          <p *ngIf="activeTab === 'preparacion1'">Preparacion 1 — en construcción</p>
          <p *ngIf="activeTab === 'preparacion2'">Preparacion 2 — en construcción</p>
          <p *ngIf="activeTab === 'cerveza'">Cerveza — en construcción</p>
          <p *ngIf="activeTab === 'envasado'">Envasado — en construcción</p>

        </div>
      </div>
    </div>
  `,
})
export class CatalogosProduccionComponent {
  private catalogsService   = inject(CatalogsService);
  private materialsService  = inject(MaterialsService);
  private mxmService        = inject(MaterialXModuloService);
  private signalsService    = inject(SignalsService);

  activeTab         = 'molienda';
  selectedType      = '';
  hasUnsavedChanges = false;
  selectedRow: any  = null;
  tree              = signal<CatalogItem[]>([]);
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private idRoot = 0;
  private materialesValues: string[] = [];
  private materialesDescToId = new Map<string, number>();
  private enterPressed = false;
  private editableColumnOrder = ['articulo'];

  tabs = [
    { key: 'molienda',     label: 'Molienda' },
    { key: 'preparacion1', label: 'Preparacion 1' },
    { key: 'preparacion2', label: 'Preparacion 2' },
    { key: 'cerveza',      label: 'Cerveza' },
    { key: 'envasado',     label: 'Envasado' },
  ];

  columnDefs: ColDef[] = [
    {
      headerName: 'Articulos',
      field: 'articulo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.materialesValues }),
    },
    {
      headerName: 'Valor',
      field: 'valor',
      width: 140,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  constructor() {
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (idRoot) {
        this.idRoot = idRoot;
        this.loadCatalog(idRoot);
        this.loadMateriales(idRoot);
      }
    });
  }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  onRowClicked(event: any)        { this.selectedRow = event.data; }
  onCellValueChanged(event: any)  {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  loadCatalog(idRoot: number) {
    this.catalogsService.getCatalogs(idRoot, 'MCATPRODU').subscribe((res: CatalogItem[]) => {
      const roots    = (res ?? []).filter(i => i.parentId === 0);
      const children = (res ?? []).filter(i => i.parentId !== 0);
      roots.forEach(r => r.children = children.filter(c => c.parentId === r.id));
      this.tree.set(roots);
    });
  }

  loadMateriales(idRoot: number) {
    this.materialsService.getMaterials2Fields(idRoot).subscribe((res: any) => {
      const list: any[] = res ?? [];
      this.materialesValues = list.map(m => m.description);
      this.materialesDescToId.clear();
      list.forEach(m => this.materialesDescToId.set(m.description, m.id));
    });
  }

  onTypeChange(type: string) {
    this.selectedType      = type;
    this.hasUnsavedChanges = false;
    this.selectedRow       = null;
    this.rowData.set([]);
    if (!type || !this.idRoot) return;
    this.loadGridData(type);
  }

  loadGridData(type: string) {
    this.mxmService.getByType(this.idRoot, type).subscribe((modulos: any[]) => {
      const rows = (modulos ?? []).map(m => ({
        id:        m.id,
        idArticulo: m.idArticulo,
        articulo:  this.getDescById(m.idArticulo),
        valor:     m.active,
      }));
      this.originalRowData = JSON.parse(JSON.stringify(rows));
      this.rowData.set(rows);
    });
  }

  private getDescById(id: number): string {
    for (const [desc, mid] of this.materialesDescToId) {
      if (mid === id) return desc;
    }
    return `(id: ${id})`;
  }

  add() {
    const newRow = { id: null, idArticulo: null, articulo: '', valor: false, __isNew: true };
    const updated = [newRow, ...this.rowData()];
    this.rowData.set(updated);
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'articulo' });
    }, 100);
  }

  async saveChanges() {
    const rows = this.rowData();
    const saves = rows
      .filter(r => r.__isNew || r.__modified)
      .map(r => {
        const payload = {
          idCompany:  this.idRoot,
          idArticulo: this.materialesDescToId.get(r.articulo) ?? r.idArticulo,
          cantidad:   1,
          type:       this.selectedType,
          active:     r.valor,
        };
        return r.__isNew
          ? this.mxmService.create(payload)
          : this.mxmService.update(r.id, payload);
      });

    if (saves.length === 0) return;
    forkJoin(saves).subscribe(() => {
      this.hasUnsavedChanges = false;
      this.loadGridData(this.selectedType);
    });
  }

  revertChanges() {
    this.rowData.set(JSON.parse(JSON.stringify(this.originalRowData)));
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
  }

  deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData.set(this.rowData().filter(r => r !== this.selectedRow));
      this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData().some(r => r.__isNew || r.__modified);
      return;
    }
    this.mxmService.delete(this.selectedRow.id).subscribe(() => {
      this.selectedRow = null;
      this.loadGridData(this.selectedType);
    });
  }
}
