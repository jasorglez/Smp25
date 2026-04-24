import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { forkJoin } from 'rxjs';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { ConfiguracionPageComponent } from '../configuracion/configuracion-page/configuracion-page.component';
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
  imports: [CommonModule, FormsModule, AgGridAngular, SelectWithTooltipEditorV2Component, ConfiguracionPageComponent],
  styles: [`
    .toast-mini {
      display: inline-block;
      background: #198754;
      color: #fff;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 6px;
      animation: fadeInOut 1.5s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-4px); }
      15%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
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

          <!-- ── TAB MOLIENDA ── -->
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
              <div *ngIf="toastMsg()" class="toast-mini">{{ toastMsg() }}</div>

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

          <!-- ── TAB PREPARACIÓN 1 ── -->
          <ng-container *ngIf="activeTab === 'preparacion1'">

            <div class="col-md-6 mb-2">
              <select class="form-select form-select-sm w-auto"
                      [(ngModel)]="selectedType1"
                      (ngModelChange)="onTypeChange1($event)">
                <option value="">-- Selecciona categoría --</option>
                <option *ngFor="let cat of categorias1" [value]="cat.key">{{ cat.label }}</option>
              </select>
            </div>

            <p class="text-muted" *ngIf="!selectedType1">
              Selecciona una categoría para ver los materiales
            </p>

            <!-- Jarabe: tabla específica con usarEnJarabe -->
            <app-configuracion-page *ngIf="selectedType1 === 'P1_JARABE'"></app-configuracion-page>

            <!-- Otras categorías: grid genérico via mxmService -->
            <ng-container *ngIf="selectedType1 && selectedType1 !== 'P1_JARABE'">
              <div *ngIf="toastMsg1()" class="toast-mini">{{ toastMsg1() }}</div>

              <div class="d-flex gap-2 mb-2 col-md-6">
                <button class="btn btn-sm btn-success" (click)="add1()" [disabled]="!gridApi1">
                  <i class="bi bi-plus-lg"></i> Agregar
                </button>
                <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges1()" [disabled]="!hasUnsavedChanges1">
                  <i class="bi bi-floppy"></i> Guardar
                  <span *ngIf="hasUnsavedChanges1"
                        class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
                  </span>
                </button>
                <button class="btn btn-sm btn-warning" (click)="revertChanges1()">
                  <i class="bi bi-arrow-clockwise"></i> Deshacer
                </button>
                <button class="btn btn-sm btn-danger" (click)="deleteRow1()" [disabled]="!selectedRow1">
                  <i class="bi bi-trash"></i> Borrar
                </button>
              </div>

              <div class="col-md-6">
                <ag-grid-angular
                  class="ag-theme-quartz small-text-ag-grid"
                  [rowData]="rowData1()"
                  [columnDefs]="columnDefs1"
                  [gridOptions]="gridOptions1"
                  (gridReady)="onGridReady1($event)"
                  (cellValueChanged)="onCellValueChanged1($event)"
                  (rowClicked)="onRowClicked1($event)"
                  (cellEditingStopped)="onCellEditingStopped1($event)"
                  style="height: 300px; width: 100%;">
                </ag-grid-angular>
              </div>
            </ng-container>

          </ng-container>

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

  activeTab = 'molienda';
  private idRoot = 0;
  private materiales: any[] = [];
  private materialesIdToDesc = new Map<number, string>();

  // ── Molienda ──
  selectedType      = '';
  hasUnsavedChanges = false;
  selectedRow: any  = null;
  toastMsg          = signal('');
  tree              = signal<CatalogItem[]>([]);
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private enterPressed = false;
  private editableColumnOrder = ['idArticulo'];

  // ── Preparación 1 ──
  readonly categorias1 = [
    { key: 'P1_JARABE',    label: 'Jarabe' },
    { key: 'P1_REFRESCO',  label: 'Refresco' },
    { key: 'P1_SIDRAS',    label: 'Sidras' },
    { key: 'P1_ALCOHOLES', label: 'Alcoholes' },
    { key: 'P1_COCTELES',  label: 'Cocteles' },
    { key: 'P1_VINOS',     label: 'Vinos' },
    { key: 'P1_LICORES',   label: 'Licores' },
  ];

  selectedType1      = '';
  hasUnsavedChanges1 = false;
  selectedRow1: any  = null;
  toastMsg1          = signal('');
  rowData1           = signal<any[]>([]);
  private originalRowData1: any[] = [];
  gridApi1!: GridApi;
  private enterPressed1 = false;
  private editableColumnOrder1 = ['idArticulo'];

  tabs = [
    { key: 'molienda',     label: 'Molienda' },
    { key: 'preparacion1', label: 'Preparacion 1' },
    { key: 'preparacion2', label: 'Preparacion 2' },
    { key: 'cerveza',      label: 'Cerveza' },
    { key: 'envasado',     label: 'Envasado' },
  ];

  // ── Columnas Molienda ──
  columnDefs: ColDef[] = [
    {
      headerName: 'Articulos',
      field: 'idArticulo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(this.rowData().map((r: any) => r.idArticulo).filter(Boolean));
        return {
          options: this.materiales
            .filter(m => !usados.has(m.id))
            .map(m => ({ id: m.id, description: m.articulo })),
        };
      },
      valueFormatter: (p: any) => this.materialesIdToDesc.get(p.value) ?? '',
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

  // ── Columnas Preparación 1 ──
  columnDefs1: ColDef[] = [
    {
      headerName: 'Articulos',
      field: 'idArticulo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(this.rowData1().map((r: any) => r.idArticulo).filter(Boolean));
        return {
          options: this.materiales
            .filter(m => !usados.has(m.id))
            .map(m => ({ id: m.id, description: m.articulo })),
        };
      },
      valueFormatter: (p: any) => this.materialesIdToDesc.get(p.value) ?? '',
    },
    {
      headerName: 'Valor',
      field: 'valor',
      width: 140,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  gridOptions1 = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed1 = true;
          setTimeout(() => { if (this.gridApi1) this.gridApi1.stopEditing(); }, 0);
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

  // ──────────────────── Molienda ────────────────────

  onGridReady(params: GridReadyEvent)      { this.gridApi = params.api; }
  onRowClicked(event: any)                 { this.selectedRow = event.data; }
  onCellValueChanged(event: any) {
    if (!event.data.__isNew) { event.data.__modified = true; this.hasUnsavedChanges = true; }
  }
  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] }), 100);
    }
  }

  private showToast(msg: string)  { this.toastMsg.set(msg);  setTimeout(() => this.toastMsg.set(''),  1500); }

  loadCatalog(idRoot: number) {
    this.catalogsService.getCatalogs(idRoot, 'MCATPRODU').subscribe((res: CatalogItem[]) => {
      const roots    = (res ?? []).filter(i => i.parentId === 0);
      const children = (res ?? []).filter(i => i.parentId !== 0);
      roots.forEach(r => r.children = children.filter(c => c.parentId === r.id));
      this.tree.set(roots);
    });
  }

  loadMateriales(idRoot: number) {
    this.materialsService.getMaterialsxview(idRoot).subscribe((res: any) => {
      this.materiales = res ?? [];
      this.materialesIdToDesc.clear();
      this.materiales.forEach(m => this.materialesIdToDesc.set(m.id, m.articulo));
    });
  }

  onTypeChange(type: string) {
    this.selectedType = type; this.hasUnsavedChanges = false; this.selectedRow = null; this.rowData.set([]);
    if (!type || !this.idRoot) return;
    this.loadGridData(type);
  }

  loadGridData(type: string) {
    this.mxmService.getByType(this.idRoot, type).subscribe((modulos: any[]) => {
      const rows = (modulos ?? []).map(m => ({ id: m.id, idArticulo: m.idArticulo, valor: m.active }));
      this.originalRowData = JSON.parse(JSON.stringify(rows));
      this.rowData.set(rows);
    });
  }

  add() {
    this.rowData.set([{ id: null, idArticulo: null, valor: false, __isNew: true }, ...this.rowData()]);
    this.hasUnsavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' }), 0);
  }

  saveChanges() {
    const saves = this.rowData().filter(r => r.__isNew || r.__modified).map(r => {
      const payload = { idCompany: this.idRoot, idArticulo: r.idArticulo, cantidad: 1, type: this.selectedType, active: r.valor };
      return r.__isNew ? this.mxmService.create(payload) : this.mxmService.update(r.id, payload);
    });
    if (!saves.length) return;
    forkJoin(saves).subscribe(() => { this.hasUnsavedChanges = false; this.showToast('Guardado'); this.loadGridData(this.selectedType); });
  }

  revertChanges() { this.rowData.set(JSON.parse(JSON.stringify(this.originalRowData))); this.hasUnsavedChanges = false; this.selectedRow = null; }

  deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData.set(this.rowData().filter(r => r !== this.selectedRow)); this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData().some(r => r.__isNew || r.__modified); return;
    }
    this.mxmService.delete(this.selectedRow.id).subscribe(() => { this.selectedRow = null; this.showToast('Borrado'); this.loadGridData(this.selectedType); });
  }

  // ──────────────────── Preparación 1 ────────────────────

  onGridReady1(params: GridReadyEvent)      { this.gridApi1 = params.api; }
  onRowClicked1(event: any)                 { this.selectedRow1 = event.data; }
  onCellValueChanged1(event: any) {
    if (!event.data.__isNew) { event.data.__modified = true; this.hasUnsavedChanges1 = true; }
  }
  onCellEditingStopped1(event: any) {
    if (!this.enterPressed1) return;
    this.enterPressed1 = false;
    const idx = this.editableColumnOrder1.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder1.length - 1) {
      setTimeout(() => this.gridApi1.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder1[idx + 1] }), 100);
    }
  }

  private showToast1(msg: string) { this.toastMsg1.set(msg); setTimeout(() => this.toastMsg1.set(''), 1500); }

  onTypeChange1(type: string) {
    this.selectedType1 = type; this.hasUnsavedChanges1 = false; this.selectedRow1 = null; this.rowData1.set([]);
    if (!type || !this.idRoot) return;
    this.loadGridData1(type);
  }

  loadGridData1(type: string) {
    this.mxmService.getByType(this.idRoot, type).subscribe((modulos: any[]) => {
      const rows = (modulos ?? []).map(m => ({ id: m.id, idArticulo: m.idArticulo, valor: m.active }));
      this.originalRowData1 = JSON.parse(JSON.stringify(rows));
      this.rowData1.set(rows);
    });
  }

  add1() {
    this.rowData1.set([{ id: null, idArticulo: null, valor: false, __isNew: true }, ...this.rowData1()]);
    this.hasUnsavedChanges1 = true;
    setTimeout(() => this.gridApi1.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' }), 0);
  }

  saveChanges1() {
    const saves = this.rowData1().filter(r => r.__isNew || r.__modified).map(r => {
      const payload = { idCompany: this.idRoot, idArticulo: r.idArticulo, cantidad: 1, type: this.selectedType1, active: r.valor };
      return r.__isNew ? this.mxmService.create(payload) : this.mxmService.update(r.id, payload);
    });
    if (!saves.length) return;
    forkJoin(saves).subscribe(() => { this.hasUnsavedChanges1 = false; this.showToast1('Guardado'); this.loadGridData1(this.selectedType1); });
  }

  revertChanges1() { this.rowData1.set(JSON.parse(JSON.stringify(this.originalRowData1))); this.hasUnsavedChanges1 = false; this.selectedRow1 = null; }

  deleteRow1() {
    if (!this.selectedRow1) return;
    if (this.selectedRow1.__isNew) {
      this.rowData1.set(this.rowData1().filter(r => r !== this.selectedRow1)); this.selectedRow1 = null;
      this.hasUnsavedChanges1 = this.rowData1().some(r => r.__isNew || r.__modified); return;
    }
    this.mxmService.delete(this.selectedRow1.id).subscribe(() => { this.selectedRow1 = null; this.showToast1('Borrado'); this.loadGridData1(this.selectedType1); });
  }
}
